package money

import "fmt"

// Currency symbols are kept in one place. Only INR is used in MVP seeds but the
// layout generalizes to other currencies.
func symbol(currency string) string {
	switch currency {
	case "INR":
		return "₹"
	case "USD":
		return "$"
	default:
		return currency + " "
	}
}

// FormatMinor renders a minor-unit amount (e.g. INR paise) as a human readable
// string, e.g. FormatMinor(9000000, "INR") -> "₹90,000".
func FormatMinor(amountMinor int64, currency string) string {
	negative := amountMinor < 0
	if negative {
		amountMinor = -amountMinor
	}
	whole := amountMinor / 100
	frac := amountMinor % 100
	s := fmt.Sprintf("%s%d.%02d", symbol(currency), whole, frac)
	if negative {
		s = "-" + s
	}
	return s
}

// WholeMinor converts a rupee (integer) value into minor units.
func WholeMinor(whole int64) int64 {
	return whole * 100
}

// ValidateCurrency returns true for supported currency codes.
func ValidateCurrency(code string) bool {
	return code == "INR" || code == "USD"
}
