package validator

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// IsUUID reports whether s is a valid UUID string.
func IsUUID(s string) bool {
	return uuidRe.MatchString(s)
}

// IsValidEmail reports whether s is a well-formed email address.
func IsValidEmail(s string) bool {
	_, err := mail.ParseAddress(s)
	return err == nil
}

// IsValidPhone reports whether s looks like a usable phone number
// (digits, spaces, +, and dashes; at least 7 digits).
func IsValidPhone(s string) bool {
	if s == "" {
		return false
	}
	digits := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits++
			continue
		}
		if r == ' ' || r == '+' || r == '-' || r == '(' || r == ')' {
			continue
		}
		return false
	}
	return digits >= 7
}

// IsInList reports whether value is one of the allowed strings (exact, case-sensitive).
func IsInList(value string, allowed ...string) bool {
	for _, a := range allowed {
		if a == value {
			return true
		}
	}
	return false
}

// Required returns a validation error message when the field is empty.
func Required(field, value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

// OneOf returns a validation error message when value is not allowed.
func OneOf(field, value string, allowed ...string) error {
	if !IsInList(value, allowed...) {
		return fmt.Errorf("%s must be one of: %s", field, strings.Join(allowed, ", "))
	}
	return nil
}

// Positive returns a validation error when v <= 0.
func Positive(field string, v int64) error {
	if v <= 0 {
		return fmt.Errorf("%s must be greater than zero", field)
	}
	return nil
}

// NonNegative returns a validation error when v < 0.
func NonNegative(field string, v int64) error {
	if v < 0 {
		return fmt.Errorf("%s must not be negative", field)
	}
	return nil
}

// MaxLen returns a validation error when len(value) > max.
func MaxLen(field string, value string, max int) error {
	if len(value) > max {
		return fmt.Errorf("%s must not exceed %d characters", field, max)
	}
	return nil
}
