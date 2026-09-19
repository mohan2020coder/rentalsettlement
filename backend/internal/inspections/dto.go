package inspections

import "time"

// CreateInspectionRequest carries the optional notes and any extra room names.
type CreateInspectionRequest struct {
	Notes string   `json:"notes"`
	Rooms []string `json:"rooms"`
}

// SaveItemRequest sets an item's observed condition and notes.
type SaveItemRequest struct {
	Condition string `json:"condition"`
	Notes     string `json:"notes"`
}

// AddMediaRequest registers an attachment previously uploaded to storage.
type AddMediaRequest struct {
	RoomID     string `json:"room_id"`
	ItemID     string `json:"item_id"`
	FilePath   string `json:"file_path"`
	MimeType   string `json:"mime_type"`
	FileSize   int64  `json:"file_size"`
	SHA256Hash string `json:"sha256_hash"`
	CapturedAt string `json:"captured_at"`
}

// InspectionSummary is the list representation of an inspection.
type InspectionSummary struct {
	ID          string    `json:"id"`
	TenancyID   string    `json:"tenancy_id"`
	Kind        string    `json:"kind"`
	Status      string    `json:"status"`
	ConductedBy *string   `json:"conducted_by"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

func toSummary(i *Inspection) InspectionSummary {
	by := ""
	if i.ConductedBy != nil {
		by = i.ConductedBy.String()
	}
	return InspectionSummary{
		ID:          i.ID.String(),
		TenancyID:   i.TenancyID.String(),
		Kind:        i.Kind,
		Status:      i.Status,
		ConductedBy: nullableStringPtr(by),
		CreatedBy:   i.CreatedBy.String(),
		CreatedAt:   i.CreatedAt,
	}
}

func toSummaries(list []Inspection) []InspectionSummary {
	out := make([]InspectionSummary, 0, len(list))
	for i := range list {
		out = append(out, toSummary(&list[i]))
	}
	return out
}

func nullableStringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
