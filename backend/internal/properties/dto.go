package properties

import (
	"time"

	"github.com/google/uuid"

	"rental-settlement/backend/pkg/validator"
)

// CreatePropertyRequest is the create property payload.
type CreatePropertyRequest struct {
	PropertyName     string `json:"property_name"`
	PropertyType     string `json:"property_type"`
	AddressLine1     string `json:"address_line1"`
	AddressLine2     string `json:"address_line2"`
	Locality         string `json:"locality"`
	City             string `json:"city"`
	State            string `json:"state"`
	PostalCode       string `json:"postal_code"`
	Bedrooms         *int   `json:"bedrooms"`
	Bathrooms        *int   `json:"bathrooms"`
	FurnishingStatus string `json:"furnishing_status"`
	Description      string `json:"description"`
}

// UpdatePropertyRequest is the update property payload.
type UpdatePropertyRequest struct {
	PropertyName     string  `json:"property_name"`
	PropertyType     string  `json:"property_type"`
	AddressLine1     *string `json:"address_line1"`
	AddressLine2     *string `json:"address_line2"`
	Locality         *string `json:"locality"`
	City             *string `json:"city"`
	State            *string `json:"state"`
	PostalCode       *string `json:"postal_code"`
	Bedrooms         *int    `json:"bedrooms"`
	Bathrooms        *int    `json:"bathrooms"`
	FurnishingStatus *string `json:"furnishing_status"`
	Description      *string `json:"description"`
	Status           string  `json:"status"`
}

// PropertyDTO is the public property representation.
type PropertyDTO struct {
	ID               uuid.UUID `json:"id"`
	LandlordID       uuid.UUID `json:"landlord_id"`
	PropertyName     string    `json:"property_name"`
	PropertyType     string    `json:"property_type"`
	AddressLine1     *string   `json:"address_line1"`
	AddressLine2     *string   `json:"address_line2"`
	Locality         *string   `json:"locality"`
	City             *string   `json:"city"`
	State            *string   `json:"state"`
	PostalCode       *string   `json:"postal_code"`
	Bedrooms         *int      `json:"bedrooms"`
	Bathrooms        *int      `json:"bathrooms"`
	FurnishingStatus *string   `json:"furnishing_status"`
	Description      *string   `json:"description"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

func validateCreate(req CreatePropertyRequest) map[string]any {
	details := map[string]any{}
	if err := validator.Required("property_name", req.PropertyName); err != nil {
		details["property_name"] = err.Error()
	}
	if err := validator.OneOf("property_type", req.PropertyType, TypeApartment, TypeHouse, TypeVilla, TypePG, TypeOther); err != nil {
		details["property_type"] = err.Error()
	}
	if req.FurnishingStatus != "" {
		if err := validator.OneOf("furnishing_status", req.FurnishingStatus, Furnished, SemiFurnished, Unfurnished); err != nil {
			details["furnishing_status"] = err.Error()
		}
	}
	return details
}

func toDTO(p *Property) *PropertyDTO {
	return &PropertyDTO{
		ID:               p.ID,
		LandlordID:       p.LandlordID,
		PropertyName:     p.PropertyName,
		PropertyType:     p.PropertyType,
		AddressLine1:     p.AddressLine1,
		AddressLine2:     p.AddressLine2,
		Locality:         p.Locality,
		City:             p.City,
		State:            p.State,
		PostalCode:       p.PostalCode,
		Bedrooms:         p.Bedrooms,
		Bathrooms:        p.Bathrooms,
		FurnishingStatus: p.FurnishingStatus,
		Description:      p.Description,
		Status:           p.Status,
		CreatedAt:        p.CreatedAt,
	}
}
