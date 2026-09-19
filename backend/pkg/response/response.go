package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SuccessBody is the standard success envelope.
type SuccessBody struct {
	Success bool `json:"success"`
	Data    any  `json:"data,omitempty"`
	Meta    any  `json:"meta,omitempty"`
}

// ErrorBody is the standard error envelope.
type ErrorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type errorEnvelope struct {
	Success bool      `json:"success"`
	Error   ErrorBody `json:"error"`
}

// OK writes a 200 success response with data and optional meta.
func OK(c *gin.Context, data any, meta any) {
	c.JSON(http.StatusOK, SuccessBody{Success: true, Data: data, Meta: meta})
}

// Created writes a 201 success response.
func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, SuccessBody{Success: true, Data: data})
}

// NoContent writes a 204 response.
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// Error writes a JSON error response with the given status and code.
func Error(c *gin.Context, status int, code string, message string, details map[string]any) {
	c.AbortWithStatusJSON(status, errorEnvelope{
		Success: false,
		Error: ErrorBody{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}

// AppError is a typed error carrying an HTTP status and an error code.
type AppError struct {
	Status  int
	Code    string
	Message string
	Details map[string]any
	Err     error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return e.Message
}

func (e *AppError) Unwrap() error { return e.Err }

// NewError builds an *AppError.
func NewError(status int, code string, message string) *AppError {
	return &AppError{Status: status, Code: code, Message: message}
}

// WrapError builds an *AppError from an existing error.
func WrapError(status int, code string, message string, err error) *AppError {
	return &AppError{Status: status, Code: code, Message: message, Err: err}
}

// Abort writes an *AppError into the response. Unknown errors become 500.
func Abort(c *gin.Context, err error) {
	if apiErr, ok := err.(*AppError); ok {
		Error(c, apiErr.Status, apiErr.Code, apiErr.Message, apiErr.Details)
		return
	}
	Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Something went wrong", nil)
}
