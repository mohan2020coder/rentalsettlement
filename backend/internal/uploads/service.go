package uploads

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"rental-settlement/backend/internal/audit"
	"rental-settlement/backend/internal/billing"
	"rental-settlement/backend/pkg/storage"
)

// MaxUploadBytes caps how large a single uploaded object may be (8 MB).
const MaxUploadBytes = 8 * 1024 * 1024

// AllowedMime lists content types the generic upload endpoint accepts.
var AllowedMime = []string{"image/jpeg", "image/png", "image/webp"}

// ErrInvalidUpload is returned for uploads that fail validation.
var ErrInvalidUpload = errors.New("invalid upload")

// Service implements generic media uploads backed by the storage layer.
type Service struct {
	storage      storage.Service
	billing      *billing.Service
	entitlements *billing.EntitlementService
	audit        *audit.Service
}

// NewService builds the upload service.
func NewService(st storage.Service, billingSvc *billing.Service, entitlements *billing.EntitlementService, auditSvc *audit.Service) *Service {
	return &Service{storage: st, billing: billingSvc, entitlements: entitlements, audit: auditSvc}
}

// Upload validates the payload, enforces the user's storage allowance and
// stores the object, returning the storage key in a result.
func (s *Service) Upload(ctx context.Context, userID uuid.UUID, data []byte, mimeType string) (*UploadResult, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("%w: empty file", ErrInvalidUpload)
	}
	if len(data) > MaxUploadBytes {
		return nil, fmt.Errorf("%w: file exceeds maximum allowed size of %d bytes", ErrInvalidUpload, MaxUploadBytes)
	}
	if err := storage.ValidateUpload(storage.UploadPolicy{AllowedMime: AllowedMime}, int64(len(data)), mimeType); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidUpload, err)
	}

	usage, err := s.billing.UsageSnapshot(ctx, userID)
	if err != nil {
		return nil, err
	}
	current := usage[billing.MetricStorageBytes]
	if err := s.entitlements.CanUploadStorage(ctx, userID, current, int64(len(data))); err != nil {
		return nil, err
	}

	key, err := s.storage.Upload(ctx, data, mimeType)
	if err != nil {
		return nil, err
	}

	_ = s.billing.RecordUsage(ctx, userID, billing.MetricStorageBytes, int64(len(data)), nil, nil)
	_ = s.audit.Record(ctx, audit.Entry{
		ActorID:    &userID,
		Action:     audit.ActionMediaUploaded,
		EntityType: "media",
		Metadata:   map[string]any{"file_size": len(data), "mime_type": mimeType, "file_path": key},
	})

	return &UploadResult{FilePath: key, MimeType: mimeType, Size: int64(len(data))}, nil
}