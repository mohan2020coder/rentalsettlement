// Package evidence assembles a downloadable PDF dossier for a tenancy. The
// settlement is informational; the dossier lets both parties keep an agreed,
// append-only record of everything relevant in one place.
package evidence

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/deductions"
	"rental-settlement/backend/internal/inspections"
	"rental-settlement/backend/internal/maintenance"
	"rental-settlement/backend/internal/settlements"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/money"
)

// Service builds evidence dossiers from the stored entities.
type Service struct {
	db        *gorm.DB
	tenancies *tenancies.Service
	audit     *audit.Service
}

// NewService builds the evidence service.
func NewService(db *gorm.DB, tenancySvc *tenancies.Service, auditSvc *audit.Service) *Service {
	return &Service{db: db, tenancies: tenancySvc, audit: auditSvc}
}

type propertyRef struct {
	PropertyName string
}

// Generate assembles the dossier for a tenancy as PDF bytes.
func (s *Service) Generate(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) ([]byte, string, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, "", err
	}

	pdf, err := s.render(ctx, tenancyID)
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("evidence-%s.pdf", tenancyID.String()[:8])
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionEvidenceDownloaded,
		EntityType: "evidence",
		EntityID:   &tenancyID,
	})
	return pdf, filename, nil
}

// render queries all tenancy records and lays them out in a paginated PDF.
func (s *Service) render(ctx context.Context, tenancyID uuid.UUID) ([]byte, error) {
	var tenancy tenancies.Tenancy
	if err := s.db.WithContext(ctx).Where("id = ?", tenancyID).First(&tenancy).Error; err != nil {
		return nil, err
	}
	var prop propertyRef
	_ = s.db.WithContext(ctx).Table("properties").
		Select("property_name").
		Where("id = ?", tenancy.PropertyID).
		Scan(&prop).Error

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetTitle("Rental Settlement Evidence Dossier", true)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	section := func(title string) {
		pdf.Ln(3)
		pdf.SetFont("Arial", "B", 13)
		pdf.SetFillColor(230, 230, 230)
		pdf.CellFormat(0, 8, title, "", 1, "L", true, 0, "")
		pdf.SetFont("Arial", "", 10)
	}
	line := func(format string, args ...any) {
		pdf.Ln(1.5)
		pdf.CellFormat(0, 5, fmt.Sprintf(format, args...), "", 1, "L", false, 0, "")
	}

	// Header
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 10, "Rental Settlement Evidence Dossier", "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(0, 6, "Generated "+nowText()+" - for record keeping; not a mandate to move money", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Tenancy summary
	section("Tenancy")
	line("Tenancy ID: %s", tenancy.ID)
	line("Property: %s", firstNonEmpty(prop.PropertyName, tenancy.PropertyID.String()))
	line("Status: %s", tenancy.Status)
	line("Monthly rent: %s", money.FormatMinor(tenancy.MonthlyRentMinor, tenancy.Currency))
	line("Security deposit: %s", money.FormatMinor(tenancy.SecurityDepositMinor, tenancy.Currency))
	if tenancy.StartDate != nil {
		line("Term: %s to %s", tenancy.StartDate.Format("2006-01-02"), dateOrDash(tenancy.EndDate))
	}
	line("Notice period (days): %d", tenancy.NoticePeriodDays)

	// Landlord & tenant
	section("Parties")
	type userRef struct {
		Name  string
		Email string
	}
	var landlord, tenant userRef
	_ = s.db.WithContext(ctx).Table("users").
		Select("name, email").
		Where("id = ?", tenancy.LandlordID).
		Scan(&landlord).Error
	if tenancy.TenantID != nil {
		_ = s.db.WithContext(ctx).Table("users").
			Select("name, email").
			Where("id = ?", *tenancy.TenantID).
			Scan(&tenant).Error
	}
	line("Landlord: %s (%s)", landlord.Name, landlord.Email)
	if tenancy.TenantID != nil {
		line("Tenant: %s (%s)", tenant.Name, tenant.Email)
	}

	// Agreement
	section("Rental agreement")
	var versions []struct {
		VersionNumber int
		TermsString   string
	}
	_ = s.db.WithContext(ctx).
		Raw(`SELECT version_number AS version_number FROM rental_agreement_versions WHERE tenancy_id = ? ORDER BY version_number DESC`, tenancyID).
		Scan(&versions).Error
	latest := 0
	for _, v := range versions {
		latest = v.VersionNumber
		break
	}
	var termsJSON []byte
	if latest > 0 {
		_ = s.db.WithContext(ctx).
			Raw(`SELECT terms_json::text AS terms_string FROM rental_agreement_versions WHERE tenancy_id = ? AND version_number = ?`, tenancyID, latest).
			Row().Scan(&termsJSON)
	}
	line("Latest agreed version: %d", latest)
	line("Terms: %s", truncate(string(termsJSON), 500))

	// Inspections
	section("Inspections")
	var inspectionsList []inspections.Inspection
	if err := s.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at asc").
		Find(&inspectionsList).Error; err != nil {
		return nil, err
	}
	for i := range inspectionsList {
		insp := &inspectionsList[i]
		line("%s: status=%s, conducted=%s", insp.Kind, insp.Status, timeText(insp.ConductedAt))
		var rooms []inspections.Room
		s.db.WithContext(ctx).Where("inspection_id = ?", insp.ID).Order("sort_order asc").Find(&rooms)
		for r := range rooms {
			line("  Room: %s", rooms[r].Name)
			var items []inspections.Item
			s.db.WithContext(ctx).Where("room_id = ?", rooms[r].ID).Find(&items)
			for it := range items {
				cond := "not set"
				if items[it].Condition != nil {
					cond = *items[it].Condition
				}
				line("    - %s: %s", items[it].Name, cond)
			}
		}
		var media []inspections.Media
		s.db.WithContext(ctx).Where("inspection_id = ?", insp.ID).Find(&media)
		if len(media) > 0 {
			line("  Media: %d attachment(s)", len(media))
		}
	}

	// Maintenance
	section("Maintenance requests")
	var maintenanceList []maintenance.MaintenanceRequest
	if err := s.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("reported_at asc").
		Find(&maintenanceList).Error; err != nil {
		return nil, err
	}
	for i := range maintenanceList {
		m := &maintenanceList[i]
		line("%s [%s/%s] -> %s", m.Title, m.Category, m.Priority, m.Status)
	}

	// Deductions & disputes
	section("Deduction claims")
	var claims []deductions.DeductionClaim
	if err := s.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at asc").
		Find(&claims).Error; err != nil {
		return nil, err
	}
	for i := range claims {
		c := &claims[i]
		line("%s: %s (%s), status=%s", c.Title, money.FormatMinor(c.ClaimedAmountMinor, c.Currency), c.Category, c.Status)
		var disputes []deductions.Dispute
		s.db.WithContext(ctx).Where("deduction_claim_id = ?", c.ID).Order("created_at asc").Find(&disputes)
		for d := range disputes {
			line("  Dispute: %s", disputes[d].Status)
			var events []deductions.DisputeEvent
			s.db.WithContext(ctx).Where("dispute_id = ?", disputes[d].ID).Order("created_at asc").Find(&events)
			for e := range events {
				ev := &events[e]
				line("    %s: %s", ev.Action, amountLine(ev.NewAmountMinor))
			}
		}
	}

	// Settlement
	section("Settlement")
	var settlement settlements.Settlement
	if err := s.db.WithContext(ctx).Where("tenancy_id = ?", tenancyID).First(&settlement).Error; err == nil {
		line("Status: %s (version %d)", settlement.Status, settlement.VersionNumber)
		line("Recorded deposit: %s", money.FormatMinor(settlement.RecordedDepositMinor, settlement.Currency))
		line("Total deductions: %s", money.FormatMinor(settlement.TotalDeductionMinor, settlement.Currency))
		line("Remaining refund/balance: %s", money.FormatMinor(settlement.RemainingAmountMinor, settlement.Currency))
		var sItems []settlements.Item
		s.db.WithContext(ctx).Where("settlement_id = ?", settlement.ID).Find(&sItems)
		for i := range sItems {
			line("  - %s: %s", sItems[i].Title, money.FormatMinor(sItems[i].AmountMinor, settlement.Currency))
		}
		var sEvents []settlements.Event
		s.db.WithContext(ctx).Where("settlement_id = ?", settlement.ID).Order("created_at asc").Find(&sEvents)
		for i := range sEvents {
			line("  event[%s]: %s", timeText(&sEvents[i].CreatedAt), sEvents[i].Action)
		}
	} else {
		line("None generated")
	}

	// Audit trail
	section("Full audit trail")
	var logs []audit.AuditLog
	if err := s.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at asc").
		Find(&logs).Error; err != nil {
		return nil, err
	}
	for i := range logs {
		l := &logs[i]
		line("%s  %-34s %-22s", l.CreatedAt.Format("2006-01-02 15:04"), l.Action, actorOrDash(l.ActorID))
	}

	pdf.Ln(6)
	pdf.SetFont("Arial", "I", 8)
	pdf.CellFormat(0, 5, fmt.Sprintf("Page %d", pdf.PageNo()), "", 0, "C", false, 0, "")

	var buf bytesBuffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.b, nil
}

func actorOrDash(id *uuid.UUID) string {
	if id == nil {
		return "(system)"
	}
	return id.String()[:8]
}

func amountLine(amount *int64) string {
	if amount == nil {
		return ""
	}
	return fmt.Sprintf("%d", *amount)
}

func dateOrDash(t *time.Time) string {
	if t == nil {
		return "-"
	}
	return t.Format("2006-01-02")
}

func timeText(t *time.Time) string {
	if t == nil {
		return "-"
	}
	return t.Format("2006-01-02 15:04")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return strings.TrimSpace(s[:n]) + "..."
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func nowText() string { return time.Now().UTC().Format("2006-01-02 15:04") }

// bytesBuffer is a minimal io.Writer backed by a byte slice.
type bytesBuffer struct{ b []byte }

func (b *bytesBuffer) Write(p []byte) (int, error) {
	b.b = append(b.b, p...)
	return len(p), nil
}
