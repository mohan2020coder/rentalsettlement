package uploads

// UploadResult is the response for a completed media upload. FilePath is the
// storage key for the object, safe to persist and to build a serve URL with.
type UploadResult struct {
	FilePath string `json:"file_path"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
}