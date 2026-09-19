package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Local is a filesystem-backed storage.Service suitable for development.
type Local struct {
	root string
}

// NewLocal creates a Local storage root, ensuring the directory exists.
func NewLocal(root string) (*Local, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	return &Local{root: root}, nil
}

// Upload writes data under a generated key.
func (l *Local) Upload(ctx context.Context, data []byte, mimeType string) (string, error) {
	key, err := timestampedKey("media", mimeType)
	if err != nil {
		return "", err
	}
	abs, err := l.resolve(key)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(abs, data, 0o644); err != nil {
		return "", err
	}
	return key, nil
}

// Open returns a reader for the given key.
func (l *Local) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	abs, err := l.resolve(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return f, nil
}

// Size returns the byte size of the stored object.
func (l *Local) Size(ctx context.Context, key string) (int64, error) {
	abs, err := l.resolve(key)
	if err != nil {
		return 0, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return info.Size(), nil
}

// Delete removes the stored object.
func (l *Local) Delete(ctx context.Context, key string) error {
	abs, err := l.resolve(key)
	if err != nil {
		return err
	}
	err = os.Remove(abs)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (l *Local) resolve(key string) (string, error) {
	if err := ValidateKey(key); err != nil {
		return "", err
	}
	clean := filepath.FromSlash(key)
	abs := filepath.Join(l.root, clean)
	// Ensure the resolved path stays inside the root.
	rel, err := filepath.Rel(l.root, abs)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path traversal blocked")
	}
	return abs, nil
}
