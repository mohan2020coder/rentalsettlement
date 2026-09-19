package settlements

// GenerateRequest builds a settlement draft.
type GenerateRequest struct {
	RecordedDepositMinor int64  `json:"recorded_deposit_minor"`
	Currency             string `json:"currency"`
}
