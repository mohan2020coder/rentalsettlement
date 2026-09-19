package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters (OWASP-compatible interactive settings).
const (
	argonTime    = 2
	argonMemory  = 19456 // KiB
	argonThreads = 1
	argonKeyLen  = 32
	argonSaltLen = 16
)

var errInvalidHash = errors.New("invalid password hash format")

// hashPassword hashes a plain-text password with Argon2id.
func hashPassword(plain string) (string, error) {
	return HashPassword(plain)
}

// HashPassword hashes a plain-text password with Argon2id. It is exported so
// companion tooling (demo seeders, CLI user management) can reuse the format.
func HashPassword(plain string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(plain), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	encoded := base64.RawStdEncoding.EncodeToString(salt)
	keyEncoded := base64.RawStdEncoding.EncodeToString(key)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads, encoded, keyEncoded), nil
}

// verifyPassword checks a plain-text password against an encoded hash.
func verifyPassword(hash, plain string) (bool, error) {
	parts := strings.Split(hash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errInvalidHash
	}
	var memory, timeCost uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads); err != nil {
		return false, errInvalidHash
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}
	key, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}
	actual := argon2.IDKey([]byte(plain), salt, timeCost, memory, threads, uint32(len(key)))
	return subtle.ConstantTimeCompare(actual, key) == 1, nil
}
