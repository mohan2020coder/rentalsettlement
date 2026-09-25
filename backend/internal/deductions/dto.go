package deductions

// ProposeClaimRequest is the landlord claim payload.
type ProposeClaimRequest struct {
	Category           string `json:"category"`
	Title              string `json:"title"`
	Description        string `json:"description"`
	ClaimedAmountMinor int64  `json:"claimed_amount_minor"`
	Currency           string `json:"currency"`
}

// DisputeRequest opens structured negotiation.
type DisputeRequest struct {
	Category string `json:"category"`
	Reason   string `json:"reason"`
}

// CounterOfferRequest proposes a revised amount.
type CounterOfferRequest struct {
	NewAmountMinor int64  `json:"new_amount_minor"`
	Reason         string `json:"reason"`
}

// AddEvidenceRequest registers an attachment previously uploaded to storage.
type AddEvidenceRequest struct {
	FilePath   string `json:"file_path"`
	MimeType   string `json:"mime_type"`
	FileSize   int64  `json:"file_size"`
	SHA256Hash string `json:"sha256_hash"`
}
