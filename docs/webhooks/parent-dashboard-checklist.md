# Parent Dashboard Webhook Audit

This checklist captures every parent-facing action surfaced in the dashboards and documents whether we currently emit an outbound webhook in addition to the existing WebSocket fan-out. Use this list as the source of truth while we retrofit webhook coverage.

> Legend  
> ✅ – Covered (webhook already dispatched)  
> ❌ – Missing webhook (follow-up required)  
> 🔄 – Partially covered (webhook exists but payload/trigger must be extended)

| Domain | Action | API Surface | WebSocket Event | Webhook Status | Notes / Follow-up |
| ------ | ------ | ----------- | --------------- | -------------- | ----------------- |
| Chores | Create chore | `POST /chores` (`controllers/chores.create`) | `chore:created` | ❌ | Add webhook payload containing chore id/title/frequency and actor |
| Chores | Update chore | `PATCH /chores/:id` (`controllers/chores.update`) | `chore:updated` | ❌ | Needs webhook when toggling active state or editing rewards |
| Assignments | Assign chore | `POST /assignments` (`controllers/assignments.create`) | `assignment:created` | ❌ | Include assignment id, chore id, target child, bidding flag |
| Assignments | Link assignments | `POST /assignments/link` (`controllers/assignments.link`) | `assignment:linked` | ❌ | WebSocket only; add webhook for automation use cases |
| Completions | Child submits completion | `POST /completions` (`controllers/completions.create`) | `completion:created` | ❌ | Should emit webhook so downstream systems can ingest pending approvals |
| Completions | Approve completion | `PATCH /completions/:id/approve` | `completion:approved` | ❌ | Webhook should include reward amounts and wallet deltas |
| Completions | Reject completion | `PATCH /completions/:id/reject` | `completion:rejected` | ❌ | Mirror approval payload with rejection reason |
| Star Purchases | Child requests stars | `POST /wallet/buy-stars` | `stars:purchase-requested` | ❌ | Add webhook for finance integrations |
| Star Purchases | Approve star purchase | `POST /wallet/buy-stars/:id/approve` | `stars:purchase-approved` | ❌ | Include conversion info and actor |
| Star Purchases | Reject star purchase | `POST /wallet/buy-stars/:id/reject` | `stars:purchase-rejected` | ❌ | Include rejection reason |
| Rewards | Create family reward | `POST /family/gifts` | `family-gift:created` | ❌ | Use for catalog sync |
| Rewards | Update family reward | `PATCH /family/gifts/:id` | `family-gift:updated` | ❌ | Include active flag and inventory |
| Rewards | Delete family reward | `DELETE /family/gifts/:id` | `family-gift:deleted` | ❌ | Alert downstream retail tooling |
| Rewards | Redeem reward | `POST /redemptions` | `reward:requested` | ❌ | Webhook should record child, cost, fulfillment status |
| Rewards | Fulfill reward | `POST /redemptions/:id/fulfill` | `reward:fulfilled` | ❌ | Include fulfillment metadata |
| Rewards | Reject reward | `POST /redemptions/:id/reject` | `reward:rejected` | ❌ | Include rejection reason |
| Payouts | Create payout | `POST /payouts` | `payout:created` | ❌ | Needed for bookkeeping integrations |
| Family | Update family settings | `PATCH /family` | `family:settings-updated` | ❌ | Should flag when holiday mode or budgets change |
| Family | Invite adult/child | `POST /family/invite` | `family:invite-created` | ❌ | Notify CRM / audit trail |
| Family | Accept invite / join | `POST /auth/child-join` et al. | Various | ❌ | Capture membership changes |
| Chat | Send message | `POST /chat` | `chat:message` | ❌ | Optional webhook for compliance / audit (confirm requirement) |
| Streaks | Update streak settings | `PATCH /family/streaks` (via family controller) | `streaks:settings-updated` | ❌ | Current controller shares family route |
| Gifts (Amazon) | Create gift template | `POST /gift-templates` | `gift-template:created` | ❌ | Request new provider integration |
| Affiliate | Update affiliate config | `PUT /affiliate` | `affiliate:config-updated` | ❌ | Should sync with marketing tooling |

## Next Steps

1. **Webhook Service** – Introduce a dedicated service (`api/src/services/webhookService.ts`) that accepts `(familyId, event, payload, actor)` and dispatches outbound HTTP POSTs (with retry/backoff via worker queue). Keep it multi-tenant aware (familyId scoping) and respect environment opt-out flags.
2. **Controller Coverage** – For each ❌ entry, call the webhook service alongside the existing WebSocket emission. Ensure payloads avoid PII yet carry enough identifiers for downstream systems.
3. **Configuration** – Add environment variables `WEBHOOK_ENABLED`, `WEBHOOK_URL`, `WEBHOOK_SECRET`, and document expected headers (`X-Choreblimey-Signature`, etc.).
4. **Testing** – Write integration tests that stub the webhook client and assert dispatch when API endpoints are hit. Cover both success and failure (retry) paths.
5. **Documentation** – Publish the webhook contract (event names, payload schema) for partners; update README/runbook once instrumentation lands.

This audit will be updated as the new tabbed dashboard migrates features. Any new parent-facing action must append to this table with webhook coverage before release.

