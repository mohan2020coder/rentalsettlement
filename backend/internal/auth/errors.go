package auth

// Module-specific error codes for the authentication module.
// They remain declarative: handlers translate them into responses via
// response.Abort, keeping business rules out of the HTTP layer.
const (
	ErrInvalidCredentials = "INVALID_CREDENTIALS"
	ErrEmailTaken         = "EMAIL_TAKEN"
	ErrUserDisabled       = "USER_DISABLED"
	ErrInvalidRefresh     = "INVALID_REFRESH_TOKEN"
	ErrRefreshRevoked     = "REFRESH_TOKEN_REVOKED"
	ErrRefreshExpired     = "REFRESH_TOKEN_EXPIRED"
)
