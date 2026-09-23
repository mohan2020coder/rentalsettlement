package properties

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/storage"
	"rental-settlement/backend/pkg/validator"
)

// Service implements property business rules.
type Service struct {
	repo         *Repository
	userRepo     *users.Repository
	billing      *billing.Service
	entitlements *billing.EntitlementService
	audit        *audit.Service
}

// NewService builds the property service.
func NewService(repo *Repository, userRepo *users.Repository, billingSvc *billing.Service, entitlements *billing.EntitlementService, auditSvc *audit.Service) *Service {
	return &Service{repo: repo, userRepo: userRepo, billing: billingSvc, entitlements: entitlements, audit: auditSvc}
}

// Create validates the request, checks the plan limit, and creates a property.
func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreatePropertyRequest) (*PropertyDTO, error) {
	if details := validateCreate(req); len(details) > 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: details}
	}

	user, err := s.userRepo.ByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user.Role != users.RoleLandlord {
		return nil, response.NewError(403, "FORBIDDEN", "Only landlords can create properties")
	}

	current, err := s.repo.CountByLandlord(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.entitlements.CanCreateProperty(ctx, userID, current); err != nil {
		return nil, err
	}

	prop := &Property{
		LandlordID:           userID,
		PropertyName:         strings.TrimSpace(req.PropertyName),
		PropertyType:         req.PropertyType,
		AddressLine1:         nullableString(req.AddressLine1),
		AddressLine2:         nullableString(req.AddressLine2),
		Locality:             nullableString(req.Locality),
		City:                 nullableString(req.City),
		State:                nullableString(req.State),
		PostalCode:           nullableString(req.PostalCode),
		Bedrooms:             req.Bedrooms,
		Bathrooms:            req.Bathrooms,
		FurnishingStatus:     nullableString(req.FurnishingStatus),
		Description:          nullableString(req.Description),
		Status:               StatusActive,
		Listed:               req.Listed,
		MonthlyRentMinor:     req.MonthlyRentMinor,
		SecurityDepositMinor: req.SecurityDepositMinor,
		Currency:             defaultCurrency(req.Currency),
		Photos:               buildPhotos(req.Photos),
	}
	if len(prop.Photos) > 0 {
		cover := prop.Photos[0].FilePath
		prop.Photo = &cover
	}
	if err := s.repo.Create(ctx, prop); err != nil {
		return nil, err
	}

	_ = s.billing.RecordUsage(ctx, userID, billing.MetricPropertyCount, 1, &prop.ID, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		Action:     audit.ActionPropertyCreated,
		EntityType: "property",
		EntityID:   &prop.ID,
	})

	return toDTO(prop), nil
}

// List returns the caller's properties.
func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]PropertyDTO, error) {
	props, err := s.repo.ListByLandlord(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]PropertyDTO, 0, len(props))
	for i := range props {
		out = append(out, *toDTO(&props[i]))
	}
	return out, nil
}

// Get returns one property if the caller owns it, it is an active marketplace
// listing, or the caller is party to a tenancy on it.
func (s *Service) Get(ctx context.Context, userID uuid.UUID, propertyID uuid.UUID) (*PropertyDTO, error) {
	p, err := s.repo.ByID(ctx, propertyID)
	if err != nil {
		return nil, err
	}
	if p.LandlordID != userID {
		accessible := p.Listed && p.Status == StatusActive
		if !accessible {
			ok, terr := s.repo.HasTenancyMember(ctx, userID, propertyID)
			if terr != nil {
				return nil, terr
			}
			accessible = ok
		}
		if !accessible {
			return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this property")
		}
	}
	return toDTO(p), nil
}

// Update applies mutable property fields, enforcing ownership.
func (s *Service) Update(ctx context.Context, userID uuid.UUID, propertyID uuid.UUID, req UpdatePropertyRequest) (*PropertyDTO, error) {
	p, err := s.repo.ByID(ctx, propertyID)
	if err != nil {
		return nil, err
	}
	if p.LandlordID != userID {
		return nil, response.NewError(403, "FORBIDDEN", "You do not have access to this property")
	}
	if req.PropertyName != "" {
		p.PropertyName = strings.TrimSpace(req.PropertyName)
	}
	if req.Photo != nil && *req.Photo != "" {
		if err := storage.ValidateKey(*req.Photo); err != nil {
			return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"photo": "photo must reference platform storage"}}
		}
	}
	if req.Photos != nil {
		for i, key := range *req.Photos {
			if err := storage.ValidateKey(key); err != nil {
				return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"photos": fmt.Sprintf("photo at index %d must reference platform storage", i)}}
			}
		}
	}
	if req.PropertyType != "" {
		if err := validator.OneOf("property_type", req.PropertyType, TypeApartment, TypeHouse, TypeVilla, TypePG, TypeOther); err != nil {
			return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"property_type": err.Error()}}
		}
		p.PropertyType = req.PropertyType
	}
	if req.Status != "" {
		if err := validator.OneOf("status", req.Status, StatusActive, StatusInactive); err != nil {
			return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"status": err.Error()}}
		}
	}
	applyOptionalStrings(p, req)

	if p.Listed && p.MonthlyRentMinor <= 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: map[string]any{"listed": "a monthly rent is required to list the property on the marketplace"}}
	}

	if req.Photos != nil {
		keys := make([]string, 0, len(*req.Photos))
		for _, key := range *req.Photos {
			if key != "" {
				keys = append(keys, key)
			}
		}
		if err := s.repo.ReplacePhotos(ctx, p.ID, keys); err != nil {
			return nil, err
		}
		p.Photos = buildPhotos(keys)
		switch {
		case len(keys) > 0:
			cover := keys[0]
			p.Photo = &cover
		default:
			p.Photo = nil
		}
	}

	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		Action:     audit.ActionPropertyUpdated,
		EntityType: "property",
		EntityID:   &p.ID,
		Metadata:   map[string]any{"listed": p.Listed},
	})
	return toDTO(p), nil
}

// ListListed returns the tenant-facing catalog of available properties.
// Only ACTIVE properties that the landlord explicitly listed are shown.
func (s *Service) ListListed(ctx context.Context, filter ListingFilter) ([]ListingDTO, error) {
	props, err := s.repo.ListListed(ctx, filter)
	if err != nil {
		return nil, err
	}
	out := make([]ListingDTO, 0, len(props))
	for i := range props {
		out = append(out, *toListingDTO(&props[i]))
	}
	return out, nil
}

func applyOptionalStrings(p *Property, req UpdatePropertyRequest) {
	assign := func(dst **string, v *string) {
		if v != nil {
			*dst = v
		}
	}
	assign(&p.AddressLine1, req.AddressLine1)
	assign(&p.AddressLine2, req.AddressLine2)
	assign(&p.Locality, req.Locality)
	assign(&p.City, req.City)
	assign(&p.State, req.State)
	assign(&p.PostalCode, req.PostalCode)
	assign(&p.FurnishingStatus, req.FurnishingStatus)
	assign(&p.Description, req.Description)
	if req.Photo != nil {
		if *req.Photo == "" {
			p.Photo = nil
		} else {
			v := *req.Photo
			p.Photo = &v
		}
	}
	if req.Bedrooms != nil {
		p.Bedrooms = req.Bedrooms
	}
	if req.Bathrooms != nil {
		p.Bathrooms = req.Bathrooms
	}
	if req.Listed != nil {
		p.Listed = *req.Listed
	}
	if req.MonthlyRentMinor != nil {
		p.MonthlyRentMinor = *req.MonthlyRentMinor
	}
	if req.SecurityDepositMinor != nil {
		p.SecurityDepositMinor = *req.SecurityDepositMinor
	}
	if req.Currency != nil {
		p.Currency = defaultCurrency(*req.Currency)
	}
}

func defaultCurrency(c string) string {
	c = strings.ToUpper(strings.TrimSpace(c))
	if c == "" {
		return "INR"
	}
	return c
}

func nullableString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// buildPhotos maps storage keys to ordered PropertyPhoto rows.
func buildPhotos(keys []string) []PropertyPhoto {
	if len(keys) == 0 {
		return []PropertyPhoto{}
	}
	photos := make([]PropertyPhoto, 0, len(keys))
	for i, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		photos = append(photos, PropertyPhoto{FilePath: key, SortOrder: i})
	}
	return photos
}
