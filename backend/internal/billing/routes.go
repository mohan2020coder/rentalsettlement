package billing

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"rental-settlement/backend/pkg/authctx"
	"rental-settlement/backend/pkg/money"
	"rental-settlement/backend/pkg/response"
	"rental-settlement/backend/pkg/validator"
)

// Handler exposes billing endpoints.
type Handler struct {
	svc *Service
}

// NewHandler builds the billing handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ListPlans handles GET /api/v1/billing/plans.
func (h *Handler) ListPlans(c *gin.Context) {
	plans, err := h.svc.ListActivePlans(c.Request.Context())
	if err != nil {
		response.Abort(c, err)
		return
	}
	out := make([]PlanDTO, 0, len(plans))
	for _, p := range plans {
		out = append(out, planToDTO(&p))
	}
	response.OK(c, out, nil)
}

// Subscription handles GET /api/v1/billing/subscription.
func (h *Handler) Subscription(c *gin.Context) {
	sub, plan, err := h.svc.CurrentSubscription(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	pd := planToDTO(plan)
	renewable := sub.Status == SubActive || sub.Status == SubTrial
	response.OK(c, SubscriptionDTO{
		ID:        sub.ID,
		Plan:      pd,
		Status:    sub.Status,
		StartedAt: sub.StartedAt,
		ExpiresAt: sub.ExpiresAt,
		Provider:  sub.Provider,
		Renewable: renewable,
	}, nil)
}

// Usage handles GET /api/v1/billing/usage.
func (h *Handler) Usage(c *gin.Context) {
	usage, err := h.svc.UsageSnapshot(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, UsageDTO{
		PropertyCount:      usage[MetricPropertyCount],
		ActiveTenancyCount: usage[MetricActiveTenancyCount],
		StorageBytes:       usage[MetricStorageBytes],
	}, nil)
}

// ChangePlan handles POST /api/v1/billing/change-plan. Simulated for MVP.
func (h *Handler) ChangePlan(c *gin.Context) {
	var req ChangePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "INVALID_JSON", "Malformed request body", nil)
		return
	}
	req.PlanCode = strings.ToUpper(strings.TrimSpace(req.PlanCode))
	if err := validator.OneOf("plan_code", req.PlanCode, PlanFREE, PlanLandlord, PlanPropertyManager); err != nil {
		response.Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request", map[string]any{"plan_code": err.Error()})
		return
	}
	sub, err := h.svc.ChangeSubscription(c.Request.Context(), authctx.UserID(c), req.PlanCode)
	if err != nil {
		response.Abort(c, err)
		return
	}
	plan, err := h.svc.PlanByCode(c.Request.Context(), req.PlanCode)
	if err != nil {
		response.Abort(c, err)
		return
	}
	response.OK(c, SubscriptionDTO{
		ID:        sub.ID,
		Plan:      planToDTO(plan),
		Status:    sub.Status,
		StartedAt: sub.StartedAt,
		ExpiresAt: sub.ExpiresAt,
		Renewable: true,
	}, nil)
}

func planToDTO(p *Plan) PlanDTO {
	var features any
	if len(p.Features) > 0 {
		_ = json.Unmarshal(p.Features, &features)
	}
	return PlanDTO{
		ID:                 p.ID,
		Code:               p.Code,
		Name:               p.Name,
		Description:        p.Description,
		PriceMinor:         p.PriceMinor,
		PriceFormatted:     money.FormatMinor(p.PriceMinor, p.Currency),
		Currency:           p.Currency,
		BillingInterval:    p.BillingInterval,
		MaxProperties:      p.MaxProperties,
		MaxActiveTenancies: p.MaxActiveTenancies,
		MaxStorageMB:       p.MaxStorageMB,
		Features:           features,
		IsActive:           p.IsActive,
	}
}

// RegisterRoutes wires the authenticated billing routes.
func RegisterRoutes(group *gin.RouterGroup, db *gorm.DB) {
	repo := NewRepository(db)
	svc := NewService(repo)
	h := NewHandler(svc)
	g := group.Group("/billing")
	g.GET("/plans", h.ListPlans)
	g.GET("/subscription", h.Subscription)
	g.GET("/usage", h.Usage)
	g.POST("/change-plan", h.ChangePlan)
}
