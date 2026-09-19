package config

import "errors"

var ErrMissingDatabaseURL = errors.New("DATABASE_URL is required")

// Validate performs a basic sanity check on required configuration values.
func (c *Config) Validate() []error {
	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, ErrMissingDatabaseURL)
	}
	if c.JWT.AccessSecret == "" {
		errs = append(errs, errors.New("JWT_ACCESS_SECRET is required"))
	}
	if c.JWT.RefreshSecret == "" {
		errs = append(errs, errors.New("JWT_REFRESH_SECRET is required"))
	}
	if c.Storage.Root == "" {
		errs = append(errs, errors.New("STORAGE_ROOT is required"))
	}
	return errs
}
