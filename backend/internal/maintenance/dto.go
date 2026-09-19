package maintenance

// ReportRequest is the open-a-request payload.
type ReportRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Priority    string `json:"priority"`
}

// UpdateStatusRequest is the status transition payload.
type UpdateStatusRequest struct {
	Status  string `json:"status"`
	Comment string `json:"comment"`
}

// AddMediaRequest registers a previously uploaded attachment.
type AddMediaRequest struct {
	FilePath   string `json:"file_path"`
	MimeType   string `json:"mime_type"`
	FileSize   int64  `json:"file_size"`
	SHA256Hash string `json:"sha256_hash"`
}
