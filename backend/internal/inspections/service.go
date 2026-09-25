package inspections

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/notifications"
	"rental-settlement/backend/internal/properties"
	"rental-settlement/backend/internal/tenancies"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/storage"
)

// Service implements inspection business rules.
type Service struct {
	repo      *Repository
	tenancies *tenancies.Service
	propRepo  *properties.Repository
	billing   *billing.Service
	audit     *audit.Service
	notify    *notifications.Service
	storage   storage.Service
}

// NewService builds the inspection service.
func NewService(repo *Repository, tenancySvc *tenancies.Service, propRepo *properties.Repository, billingSvc *billing.Service, auditSvc *audit.Service, notify *notifications.Service, storageService storage.Service) *Service {
	return &Service{repo: repo, tenancies: tenancySvc, propRepo: propRepo, billing: billingSvc, audit: auditSvc, notify: notify, storage: storageService}
}

// propertyConfig derives the inspection checklist profile from the unit.
func propertyConfig(p *properties.Property) PropertyConfig {
	cfg := PropertyConfig{Furnished: p.FurnishingStatus != nil && (*p.FurnishingStatus == properties.Furnished || *p.FurnishingStatus == properties.SemiFurnished)}
	if p.Bedrooms != nil {
		cfg.Bedrooms = *p.Bedrooms
	}
	if p.Bathrooms != nil {
		cfg.Bathrooms = *p.Bathrooms
	}
	return cfg.normalize()
}

// Template previews the room/item checklist that would be scaffolded for a
// tenancy, given the unit type and the requested inspection kind.
func (s *Service) Template(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, kind string) (*InspectionTemplate, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	prop, err := s.propRepo.ByID(ctx, t.PropertyID)
	if err != nil {
		return nil, err
	}
	cfg := propertyConfig(prop)

	normKind := strings.ToUpper(strings.TrimSpace(kind))
	if normKind != KindMoveOut {
		normKind = KindMoveIn
	}

	furnishing := ""
	if prop.FurnishingStatus != nil {
		furnishing = *prop.FurnishingStatus
	}
	out := &InspectionTemplate{
		PropertyName:     prop.PropertyName,
		PropertyType:     prop.PropertyType,
		Bedrooms:         cfg.Bedrooms,
		Bathrooms:        cfg.Bathrooms,
		FurnishingStatus: furnishing,
		Kind:             normKind,
		Rooms:            make([]TemplateRoom, 0),
	}

	// A move-out inspection reuses the tree created at move-in (the creator
	// selects rooms once, not again). Fall back to the unit profile otherwise.
	if normKind == KindMoveOut {
		if moveIn := s.moveInFor(ctx, tenancyID); moveIn != nil {
			out.ReusedFromMoveIn = true
			rooms := make([]TemplateRoom, 0, len(moveIn.Rooms)+len(departureExtras))
			for _, r := range moveIn.Rooms {
				items := make([]string, 0, len(r.Items))
				for _, it := range r.Items {
					items = append(items, it.Name)
				}
				rooms = append(rooms, TemplateRoom{Name: r.Name, Items: items})
			}
			for _, d := range departureExtras {
				rooms = append(rooms, TemplateRoom{Name: d.name, Items: d.items})
			}
			out.Rooms = rooms
			return out, nil
		}
	}

	for _, d := range propertyRooms(cfg) {
		out.Rooms = append(out.Rooms, TemplateRoom{Name: d.name, Items: d.items})
	}
	if normKind == KindMoveOut {
		for _, d := range departureExtras {
			out.Rooms = append(out.Rooms, TemplateRoom{Name: d.name, Items: d.items})
		}
	}
	return out, nil
}

// moveInFor returns the newest move-in inspection for a tenancy, if any.
func (s *Service) moveInFor(ctx context.Context, tenancyID uuid.UUID) *Inspection {
	list, err := s.repo.ListByTenancy(ctx, tenancyID)
	if err != nil {
		return nil
	}
	var moveIn *Inspection
	for i := range list {
		if list[i].Kind == KindMoveIn {
			moveIn = &list[i]
			break
		}
	}
	if moveIn == nil {
		return nil
	}
	full, err := s.repo.ByID(ctx, moveIn.ID)
	if err != nil {
		return nil
	}
	return full
}

// CreateMoveIn builds a move-in inspection from the standard template for a
// tenancy. Either party may start it; it starts in DRAFT. The room/item
// checklist is derived from the unit profile (bedrooms/bathrooms/furnishing).
func (s *Service) CreateMoveIn(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, req CreateInspectionRequest) (*Inspection, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	prop, err := s.propRepo.ByID(ctx, t.PropertyID)
	if err != nil {
		return nil, err
	}
	rooms := buildTemplate(propertyConfig(prop), setStringSlice(req.Rooms), req.ExcludeRooms)
	insp := &Inspection{
		TenancyID: tenancyID,
		Kind:      KindMoveIn,
		Status:    StatusDraft,
		Notes:     nullableString(req.Notes),
		CreatedBy: userID,
	}
	if err := s.repo.Create(ctx, insp, rooms); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionInspectionCreated,
		EntityType: "inspection",
		EntityID:   &insp.ID,
		Metadata:   map[string]any{"kind": KindMoveIn},
	})
	_ = s.notify.Notify(ctx, otherParty(ctx, s, userID, tenancyID), notifications.TypeInspection, "Move-in inspection created",
		"A move-in inspection needs your attention", "inspection", &insp.ID)
	return s.repo.ByID(ctx, insp.ID)
}

// CreateMoveOut builds a move-out inspection reusing the agreed move-in
// structure plus a departure template. It also advances the tenancy status
// through the notice flow: ACTIVE -> NOTICE_GIVEN -> MOVE_OUT.
func (s *Service) CreateMoveOut(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID, req CreateInspectionRequest) (*Inspection, error) {
	t, err := s.tenancies.CheckAccess(ctx, userID, tenancyID)
	if err != nil {
		return nil, err
	}
	if t.Status == "SETTLED" || t.Status == "CANCELLED" {
		return nil, response.NewError(400, "INVALID_STATE", "Tenancy cannot start a move-out in its current state")
	}

	// Reflect the move-in structure (if any) and append departure rooms.
	moveIn := s.moveInFor(ctx, tenancyID)

	rooms := make([]Room, 0)
	if moveIn != nil {
		for _, r := range moveIn.Rooms {
			rooms = append(rooms, Room{Name: r.Name, SortOrder: r.SortOrder, Items: copyItems(r.Items)})
		}
	} else {
		// No move-in report exists; derive from the unit profile instead.
		prop, err := s.propRepo.ByID(ctx, t.PropertyID)
		if err != nil {
			return nil, err
		}
		rooms = buildTemplate(propertyConfig(prop), setStringSlice(req.Rooms), req.ExcludeRooms)
	}
	rooms = append(rooms, departureTemplate()...)

	insp := &Inspection{
		TenancyID: tenancyID,
		Kind:      KindMoveOut,
		Status:    StatusDraft,
		Notes:     nullableString(req.Notes),
		CreatedBy: userID,
	}
	if err := s.repo.Create(ctx, insp, rooms); err != nil {
		return nil, err
	}

	// Advance tenancy status through the move-out flow.
	target := "MOVE_OUT"
	if t.Status == "ACTIVE" {
		if _, err := s.tenancies.UpdateStatus(ctx, userID, tenancyID, "NOTICE_GIVEN"); err == nil {
			target = "NOTICE_GIVEN"
		}
	}
	now := time.Now().UTC()
	insp.ConductedAt = &now
	insp.ConductedBy = &userID
	_ = s.repo.Update(ctx, insp)

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionInspectionCreated,
		EntityType: "inspection",
		EntityID:   &insp.ID,
		Metadata:   map[string]any{"kind": KindMoveOut},
	})
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &tenancyID,
		Action:     audit.ActionTenancyMoveOut,
		EntityType: "tenancy",
		EntityID:   &tenancyID,
		Metadata:   map[string]any{"status": target},
	})

	return s.repo.ByID(ctx, insp.ID)
}

// Get returns an inspection if the caller is a tenancy party.
func (s *Service) Get(ctx context.Context, userID uuid.UUID, inspectionID uuid.UUID) (*Inspection, error) {
	insp, err := s.repo.ByID(ctx, inspectionID)
	if err != nil {
		return nil, err
	}
	if _, err := s.tenancies.CheckAccess(ctx, userID, insp.TenancyID); err != nil {
		return nil, err
	}
	return insp, nil
}

// List returns inspections for a tenancy (parties only).
func (s *Service) List(ctx context.Context, userID uuid.UUID, tenancyID uuid.UUID) ([]Inspection, error) {
	if _, err := s.tenancies.CheckAccess(ctx, userID, tenancyID); err != nil {
		return nil, err
	}
	return s.repo.ListByTenancy(ctx, tenancyID)
}

// SaveItem records the observed condition/notes for an item. Only editable in
// DRAFT.
func (s *Service) SaveItem(ctx context.Context, userID uuid.UUID, inspectionID, roomID, itemID uuid.UUID, req SaveItemRequest) (*Item, error) {
	insp, err := s.Get(ctx, userID, inspectionID)
	if err != nil {
		return nil, err
	}
	if insp.Status != StatusDraft {
		return nil, response.NewError(400, "INVALID_STATE", "Inspection items can only be edited while the inspection is a draft")
	}
	item, err := s.repo.ItemByID(ctx, itemID, roomID, inspectionID)
	if err != nil {
		return nil, err
	}
	item.Condition = nullableString(req.Condition)
	item.Notes = nullableString(req.Notes)
	if err := s.repo.SaveItem(ctx, item); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &insp.TenancyID,
		Action:     audit.ActionInspectionItemSaved,
		EntityType: "inspection_item",
		EntityID:   &item.ID,
		Metadata:   map[string]any{"condition": req.Condition},
	})
	return item, nil
}

// AddMedia records an attachment (uploaded earlier via the storage endpoint).
// It validates the file reference and accumulates STORAGE_BYTES usage.
func (s *Service) AddMedia(ctx context.Context, userID uuid.UUID, inspectionID uuid.UUID, req AddMediaRequest) (*Media, error) {
	insp, err := s.Get(ctx, userID, inspectionID)
	if err != nil {
		return nil, err
	}
	if req.FilePath == "" {
		return nil, response.NewError(400, "VALIDATION_ERROR", "file_path is required")
	}
	if err := storage.ValidateKey(req.FilePath); err != nil {
		return nil, response.NewError(400, "VALIDATION_ERROR", "file_path must reference platform storage")
	}

	m := &Media{
		InspectionID: inspectionID,
		RoomID:       optionalUUID(req.RoomID),
		ItemID:       optionalUUID(req.ItemID),
		UploadedBy:   userID,
		FilePath:     req.FilePath,
		MimeType:     req.MimeType,
		FileSize:     req.FileSize,
		SHA256Hash:   req.SHA256Hash,
		CapturedAt:   timePointer(req.CapturedAt),
	}
	if err := s.repo.CreateMedia(ctx, m); err != nil {
		return nil, err
	}

	_ = s.billing.RecordUsage(ctx, userID, billing.MetricStorageBytes, m.FileSize, &m.ID, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &insp.TenancyID,
		Action:     audit.ActionMediaUploaded,
		EntityType: "media",
		EntityID:   &m.ID,
		Metadata:   map[string]any{"file_size": m.FileSize},
	})
	return m, nil
}

// Confirm records the caller's agreement to the inspection. When the landlord
// and the tenant both confirm, the inspection flips to CONFIRMED.
func (s *Service) Confirm(ctx context.Context, userID uuid.UUID, inspectionID uuid.UUID) (*Inspection, error) {
	insp, err := s.Get(ctx, userID, inspectionID)
	if err != nil {
		return nil, err
	}
	if insp.Status == StatusConfirmed {
		return nil, response.NewError(400, "ALREADY_CONFIRMED", "Inspection already confirmed")
	}
	current, err := s.repo.Confirmations(ctx, inspectionID)
	if err != nil {
		return nil, err
	}
	for _, id := range current {
		if id == userID {
			return nil, response.NewError(400, "ALREADY_CONFIRMED", "You already confirmed this inspection")
		}
	}

	now := time.Now().UTC()
	if err := s.repo.AddConfirmation(ctx, inspectionID, userID); err != nil {
		return nil, err
	}

	t, _ := s.tenancies.CheckAccess(ctx, userID, insp.TenancyID)
	bothConfirmed := false
	if insp.Kind == KindMoveIn {
		if _, err := s.repo.Confirmations(ctx, inspectionID); err != nil {
			return nil, err
		}
		landlordConfirmed := contains(append(current, userID), t.LandlordID)
		tenantConfirmed := t.TenantID != nil && contains(append(current, userID), *t.TenantID)
		bothConfirmed = landlordConfirmed && tenantConfirmed
	} else {
		list, _ := s.repo.Confirmations(ctx, inspectionID)
		bothConfirmed = len(list) >= 2 && t.TenantID != nil && contains(list, t.LandlordID) && contains(list, *t.TenantID)
	}

	if bothConfirmed {
		insp.Status = StatusConfirmed
		insp.ConductedAt = &now
		_ = s.repo.Update(ctx, insp)
		if insp.Kind == KindMoveOut {
			_, _ = s.tenancies.UpdateStatus(ctx, t.LandlordID, insp.TenancyID, "MOVE_OUT")
		}
	} else {
		insp.Status = StatusPendingConfirmation
		_ = s.repo.Update(ctx, insp)
	}

	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		TenancyID:  &insp.TenancyID,
		Action:     audit.ActionInspectionConfirmed,
		EntityType: "inspection",
		EntityID:   &insp.ID,
	})
	_ = s.notify.Notify(ctx, t.LandlordID, notifications.TypeInspection, "Inspection confirmed",
		"A party confirmed an inspection", "inspection", &insp.ID)

	return s.repo.ByID(ctx, inspectionID)
}

func otherParty(ctx context.Context, s *Service, userID uuid.UUID, tenancyID uuid.UUID) uuid.UUID {
	t, err := s.tenancies.Get(ctx, userID, tenancyID)
	if err != nil {
		return uuid.Nil
	}
	if t.LandlordID == userID {
		if t.TenantID != nil {
			return *t.TenantID
		}
	}
	return t.LandlordID
}

func contains(list []uuid.UUID, id uuid.UUID) bool {
	for _, v := range list {
		if v == id {
			return true
		}
	}
	return false
}

func setStringSlice(rooms []string) []string {
	if len(rooms) == 0 {
		return nil
	}
	return rooms
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func optionalUUID(id string) *uuid.UUID {
	if id == "" {
		return nil
	}
	u, err := uuid.Parse(id)
	if err != nil {
		return nil
	}
	return &u
}

func timePointer(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil
	}
	return &t
}

func copyItems(items []Item) []Item {
	out := make([]Item, 0, len(items))
	for _, it := range items {
		out = append(out, Item{Name: it.Name})
	}
	return out
}
