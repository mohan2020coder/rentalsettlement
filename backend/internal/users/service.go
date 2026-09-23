package users

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/storage"
	"rental-settlement/backend/pkg/validator"
)

// Service implements user account business rules.
type Service struct {
	repo *Repository
}

// NewService builds the user service.
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Me returns the current user's profile.
func (s *Service) Me(ctx context.Context, userID uuid.UUID) (*UserDTO, error) {
	u, err := s.repo.ByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	dto := ToUserDTO(u)
	return &dto, nil
}

// UpdateProfile updates mutable profile fields.
func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*UserDTO, error) {
	details := map[string]any{}
	if req.Name == "" {
		details["name"] = "name is required"
	}
	if req.Phone != "" && !validator.IsValidPhone(req.Phone) {
		details["phone"] = "invalid phone number"
	}
	if req.Photo != "" {
		if err := storage.ValidateKey(req.Photo); err != nil {
			details["photo"] = "photo must reference platform storage"
		}
	}
	if len(details) > 0 {
		return nil, &response.AppError{Status: 400, Code: "VALIDATION_ERROR", Message: "Invalid request", Details: details}
	}

	u, err := s.repo.ByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	u.Name = strings.TrimSpace(req.Name)
	if req.Phone != "" {
		u.Phone = &req.Phone
	}
	if req.Photo != "" {
		u.ProfilePhoto = &req.Photo
	} else {
		u.ProfilePhoto = nil
	}
	if err := s.repo.Update(ctx, u); err != nil {
		return nil, err
	}
	dto := ToUserDTO(u)
	return &dto, nil
}
