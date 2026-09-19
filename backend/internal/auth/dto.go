package auth

import (
	"strings"

	"rental-settlement/backend/internal/users"
	"rental-settlement/backend/pkg/validator"
)

// RegisterRequest is the public shape of a registration payload.
type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Validate checks registration fields and returns human-readable errors.
func (r RegisterRequest) Validate() map[string]any {
	details := map[string]any{}
	if err := validator.Required("name", r.Name); err != nil {
		details["name"] = err.Error()
	}
	if r.Email == "" || !validator.IsValidEmail(r.Email) {
		details["email"] = "a valid email is required"
	}
	if err := validator.Required("password", r.Password); err != nil {
		details["password"] = err.Error()
	} else if len(r.Password) < 8 {
		details["password"] = "password must be at least 8 characters"
	}
	if err := validator.OneOf("role", strings.ToUpper(r.Role), users.RoleLandlord, users.RoleTenant); err != nil {
		details["role"] = "role must be LANDLORD or TENANT"
	}
	return details
}

// LoginRequest is the public shape of a login payload.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Validate checks login fields.
func (r LoginRequest) Validate() map[string]any {
	details := map[string]any{}
	if r.Email == "" || !validator.IsValidEmail(r.Email) {
		details["email"] = "a valid email is required"
	}
	if err := validator.Required("password", r.Password); err != nil {
		details["password"] = err.Error()
	}
	return details
}

// RefreshRequest carries an existing refresh token.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (r RefreshRequest) Validate() map[string]any {
	details := map[string]any{}
	if err := validator.Required("refresh_token", r.RefreshToken); err != nil {
		details["refresh_token"] = err.Error()
	}
	return details
}

// LogoutRequest optionally accepts the refresh token to revoke.
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// AuthResponse is returned by register/login/refresh.
type AuthResponse struct {
	AccessToken  string        `json:"access_token"`
	RefreshToken string        `json:"refresh_token"`
	ExpiresIn    int64         `json:"expires_in"`
	User         users.UserDTO `json:"user"`
}

// UserDTO is the public user representation.
type UserDTO = users.UserDTO
