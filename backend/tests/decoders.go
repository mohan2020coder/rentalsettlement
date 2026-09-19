package tests

import (
	"encoding/json"
	"net/http/httptest"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func jsonMarshal(v any) ([]byte, error) { return json.Marshal(v) }

func decode(resp *httptest.ResponseRecorder, target any) error {
	return json.Unmarshal(resp.Body.Bytes(), target)
}

func decodeData[T any](resp *httptest.ResponseRecorder) (T, error) {
	var envelope struct {
		Data T `json:"data"`
	}
	err := json.Unmarshal(resp.Body.Bytes(), &envelope)
	return envelope.Data, err
}

func mustData[T any](resp *httptest.ResponseRecorder) T {
	v, err := decodeData[T](resp)
	if err != nil {
		panic(err)
	}
	return v
}

func readBody(resp *httptest.ResponseRecorder) string {
	b := resp.Body.Bytes()
	resp.Body.Reset()
	resp.Body.Write(b)
	return string(b)
}

// Decode helpers for response envelopes.
type registerResponse struct {
	Data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		User         struct {
			ID uuid.UUID `json:"id"`
		} `json:"user"`
	} `json:"data"`
}

// keep datatypes imported for reuse across test files
var _ = datatypes.JSON{}
