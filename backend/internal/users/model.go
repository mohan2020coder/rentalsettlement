package users

import (
	"time"

	"github.com/google/uuid"
)

// UserRole constants.
const (
	RoleLandlord = "LANDLORD"
	RoleTenant   = "TENANT"
)

// User status constants.
const (
	StatusActive   = "ACTIVE"
	StatusDisabled = "DISABLED"
)

// User is the platform account holder (landlord or tenant).
type User struct {
	ID           uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Phone        *string   `json:"phone"`
	PasswordHash string    `gorm:"column:password_hash" json:"-"`
	Role         string    `json:"role"`
	ProfilePhoto *string   `gorm:"column:profile_photo" json:"profile_photo"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName maps the model to the users table.
func (User) TableName() string { return "users" }
