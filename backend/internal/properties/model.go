package properties

import (
	"time"

	"github.com/google/uuid"
)

// Property types.
const (
	TypeApartment = "APARTMENT"
	TypeHouse     = "HOUSE"
	TypeVilla     = "VILLA"
	TypePG        = "PG"
	TypeOther     = "OTHER"
)

// Furnishing statuses.
const (
	Furnished     = "FURNISHED"
	SemiFurnished = "SEMI_FURNISHED"
	Unfurnished   = "UNFURNISHED"
)

// Status values.
const (
	StatusActive   = "ACTIVE"
	StatusInactive = "INACTIVE"
)

// Property is a rental unit owned by a landlord.
type Property struct {
	ID                   uuid.UUID       `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	LandlordID           uuid.UUID       `gorm:"column:landlord_id;type:uuid" json:"landlord_id"`
	PropertyName         string          `gorm:"column:property_name" json:"property_name"`
	PropertyType         string          `gorm:"column:property_type" json:"property_type"`
	AddressLine1         *string         `gorm:"column:address_line1" json:"address_line1"`
	AddressLine2         *string         `gorm:"column:address_line2" json:"address_line2"`
	Locality             *string         `json:"locality"`
	City                 *string         `json:"city"`
	State                *string         `json:"state"`
	PostalCode           *string         `gorm:"column:postal_code" json:"postal_code"`
	Bedrooms             *int            `json:"bedrooms"`
	Bathrooms            *int            `json:"bathrooms"`
	FurnishingStatus     *string         `gorm:"column:furnishing_status" json:"furnishing_status"`
	Description          *string         `json:"description"`
	Status               string          `json:"status"`
	Listed               bool            `json:"listed"`
	MonthlyRentMinor     int64           `gorm:"column:monthly_rent_minor" json:"monthly_rent_minor"`
	SecurityDepositMinor int64           `gorm:"column:security_deposit_minor" json:"security_deposit_minor"`
	Currency             string          `json:"currency"`
	Photo                *string         `gorm:"column:photo" json:"photo"`
	Photos               []PropertyPhoto `gorm:"foreignKey:PropertyID;references:ID" json:"photos,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

func (Property) TableName() string { return "properties" }

// PropertyPhoto is a storage key of one photo attached to a property.
type PropertyPhoto struct {
	ID         uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	PropertyID uuid.UUID `gorm:"column:property_id;type:uuid" json:"property_id"`
	FilePath   string    `gorm:"column:file_path" json:"file_path"`
	SortOrder  int       `gorm:"column:sort_order" json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
}

func (PropertyPhoto) TableName() string { return "property_photos" }
