package inspections

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/response"
)

// Repository persists inspections and their structure.
type Repository struct {
	db *gorm.DB
}

// NewRepository builds an inspection repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts an inspection and its full room/item structure in one tx.
func (r *Repository) Create(ctx context.Context, insp *Inspection, rooms []Room) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(insp).Error; err != nil {
			return err
		}
		for i := range rooms {
			rooms[i].InspectionID = insp.ID
			if err := tx.Create(&rooms[i]).Error; err != nil {
				return err
			}
			for j := range rooms[i].Items {
				rooms[i].Items[j].RoomID = rooms[i].ID
				if err := tx.Create(&rooms[i].Items[j]).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// ByID loads an inspection with rooms, items, media and confirmations.
func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*Inspection, error) {
	var insp Inspection
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&insp).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "INSPECTION_NOT_FOUND", "Inspection not found")
		}
		return nil, err
	}
	if err := r.loadExtra(ctx, &insp); err != nil {
		return nil, err
	}
	return &insp, nil
}

func (r *Repository) loadExtra(ctx context.Context, insp *Inspection) error {
	var rooms []Room
	if err := r.db.WithContext(ctx).
		Where("inspection_id = ?", insp.ID).
		Order("sort_order asc, created_at asc").
		Find(&rooms).Error; err != nil {
		return err
	}
	for i := range rooms {
		var items []Item
		if err := r.db.WithContext(ctx).
			Where("room_id = ?", rooms[i].ID).
			Order("created_at asc").
			Find(&items).Error; err != nil {
			return err
		}
		rooms[i].Items = items
	}
	insp.Rooms = rooms

	var media []Media
	if err := r.db.WithContext(ctx).
		Where("inspection_id = ?", insp.ID).
		Order("uploaded_at asc").
		Find(&media).Error; err != nil {
		return err
	}
	insp.Media = media

	var confirmations []Confirmation
	if err := r.db.WithContext(ctx).
		Where("inspection_id = ?", insp.ID).
		Find(&confirmations).Error; err != nil {
		return err
	}
	insp.ConfirmedBy = make([]uuid.UUID, 0, len(confirmations))
	for _, c := range confirmations {
		insp.ConfirmedBy = append(insp.ConfirmedBy, c.UserID)
	}
	return nil
}

// ListByTenancy returns inspections for a tenancy, newest first.
func (r *Repository) ListByTenancy(ctx context.Context, tenancyID uuid.UUID) ([]Inspection, error) {
	var list []Inspection
	err := r.db.WithContext(ctx).
		Where("tenancy_id = ?", tenancyID).
		Order("created_at desc").
		Find(&list).Error
	return list, err
}

// Update persists an inspection row.
func (r *Repository) Update(ctx context.Context, insp *Inspection) error {
	return r.db.WithContext(ctx).Save(insp).Error
}

// ItemByID returns an item within a specific inspection (via room).
func (r *Repository) ItemByID(ctx context.Context, itemID, roomID, inspectionID uuid.UUID) (*Item, error) {
	var item Item
	err := r.db.WithContext(ctx).
		Joins("JOIN inspection_rooms r ON r.id = inspection_items.room_id").
		Joins("JOIN inspections i ON i.id = r.inspection_id").
		Where("inspection_items.id = ? AND r.id = ? AND i.id = ?", itemID, roomID, inspectionID).
		First(&item).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, response.NewError(404, "INSPECTION_ITEM_NOT_FOUND", "Inspection item not found")
		}
		return nil, err
	}
	return &item, nil
}

// SaveItem persists an inspection item.
func (r *Repository) SaveItem(ctx context.Context, item *Item) error {
	return r.db.WithContext(ctx).Save(item).Error
}

// AddItems inserts new items into a room (used by move-out templates).
func (r *Repository) AddItems(ctx context.Context, items []Item) error {
	if len(items) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&items).Error
}

// CreateMedia inserts an inspection media attachment.
func (r *Repository) CreateMedia(ctx context.Context, m *Media) error {
	return r.db.WithContext(ctx).Create(m).Error
}

// AddConfirmation records a party's confirmation.
func (r *Repository) AddConfirmation(ctx context.Context, inspectionID, userID uuid.UUID) error {
	c := Confirmation{InspectionID: inspectionID, UserID: userID, ConfirmedAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Create(&c).Error
}

// Confirmations returns the set of confirming user ids.
func (r *Repository) Confirmations(ctx context.Context, inspectionID uuid.UUID) ([]uuid.UUID, error) {
	var confirmations []Confirmation
	if err := r.db.WithContext(ctx).
		Where("inspection_id = ?", inspectionID).
		Find(&confirmations).Error; err != nil {
		return nil, err
	}
	out := make([]uuid.UUID, 0, len(confirmations))
	for _, c := range confirmations {
		out = append(out, c.UserID)
	}
	return out, nil
}
