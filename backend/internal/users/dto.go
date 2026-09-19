package users

import "github.com/google/uuid"

// UserDTO is the public representation of a user.
type UserDTO struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Phone        *string   `json:"phone"`
	Role         string    `json:"role"`
	ProfilePhoto *string   `json:"profile_photo"`
	Status       string    `json:"status"`
}

// ToUserDTO maps a user model to its public DTO.
func ToUserDTO(u *User) UserDTO {
	return UserDTO{
		ID:           u.ID,
		Name:         u.Name,
		Email:        u.Email,
		Phone:        u.Phone,
		Role:         u.Role,
		ProfilePhoto: u.ProfilePhoto,
		Status:       u.Status,
	}
}

// UpdateProfileRequest is the update profile payload.
type UpdateProfileRequest struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	Photo string `json:"photo"`
}
