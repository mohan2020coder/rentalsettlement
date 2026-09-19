package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path"
	"time"

	"github.com/google/uuid"
)

// Service is the storage abstraction for uploaded media (inspection photos,
// maintenance photos). In development it uses the local filesystem; in
// production it can be backed by S3-compatible object storage.
type Service interface {
	// Upload stores data and returns a server-generated storage key.
	Upload(ctx context.Context, data []byte, mimeType string) (string, error)
	// Open returns a reader for the given storage key.
	Open(ctx context.Context, key string) (io.ReadCloser, error)
	// Size returns the byte size of the stored object, if known.
	Size(ctx context.Context, key string) (int64, error)
	// Delete removes the object.
	Delete(ctx context.Context, key string) error
}

// Common errors.
var (
	ErrNotFound   = errors.New("object not found")
	ErrInvalidKey = errors.New("invalid storage key")
	ErrNoService  = errors.New("no storage service configured")
)

// ValidateKey ensures a storage key is safe to use as a path segment and does
// not attempt path traversal.
func ValidateKey(key string) error {
	if key == "" {
		return ErrInvalidKey
	}
	if path.IsAbs(key) || key == "." || key == ".." {
		return ErrInvalidKey
	}
	if path.Clean(key) != key {
		return ErrInvalidKey
	}
	return nil
}

// extForMime maps a mime type to a safe file extension. Unknown types fall
// back to a generic extension. The extension is derived server-side only.
func extForMime(mimeType string) string {
	switch mimeType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "video/mp4":
		return ".mp4"
	case "video/quicktime":
		return ".mov"
	case "application/pdf":
		return ".pdf"
	default:
		return ".bin"
	}
}

// timestampedKey builds a key like media/2026/09/<uuid>.jpg.
func timestampedKey(kind, mimeType string) (string, error) {
	if kind == "" {
		kind = "media"
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	return fmt.Sprintf("%s/%04d/%02d/%s%s", kind, now.Year(), now.Month(), id.String(), extForMime(mimeType)), nil
}

// UploadPolicies describes file upload validation rules shared across modules.
type UploadPolicy struct {
	MaxBytes int64
	// AllowedMime lists permitted content types. Empty means all.
	AllowedMime []string
}

// ValidateUpload checks size and mime type against a policy.
func ValidateUpload(policy UploadPolicy, size int64, mimeType string) error {
	if policy.MaxBytes > 0 && size > policy.MaxBytes {
		return fmt.Errorf("file exceeds maximum allowed size of %d bytes", policy.MaxBytes)
	}
	if len(policy.AllowedMime) > 0 {
		ok := false
		for _, m := range policy.AllowedMime {
			if m == mimeType {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("file type %s is not allowed", mimeType)
		}
	}
	return nil
}
