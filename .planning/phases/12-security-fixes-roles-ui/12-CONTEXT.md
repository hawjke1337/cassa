# Phase 12: Security Fixes & Roles UI - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Закрыть IDOR, soft delete bypass, отсутствие AuditLog. Добавить rate limiting на все write operations. Администратор управляет ролями и правами через UI на /settings/roles. Soft delete клиентов и магазинов через UI.

</domain>

<decisions>
## Implementation Decisions

### Roles UI layout

- No preset roles — all custom, user creates from scratch
- Multiple roles per user per store (permissions merge as union)
- Claude's Discretion: table+drawer vs cards, permission matrix layout (category rows + toggles vs flat checklist)

### Permission matrix

- Claude's Discretion: choose the clearest layout for ~20-30 permissions
- Categories: POS, Orders, Inventory, Reports, Settings (as in existing `requirePermission` calls)
- Each permission is a checkbox with clear label

### Audit log

- Scope: everything auditable — all create/update/delete across all entities
- UI: both dedicated /settings/audit-log page AND inline history on relevant entity pages
- Retention: configurable via UI settings (admin sets retention period in days/months)
- Filterable by: date range, action type, user, entity type
- Owner-only access to full audit log page

### Rate limiting

- Toast notification with countdown timer on rate limit hit
- Apply to ALL write operations (not just createSale/createReceive/createOrder)
- In-memory storage (Map) — consistent with Phase 1 login rate limiting
- Claude's Discretion: threshold values per endpoint type (adjust for POS transaction rates)

### Soft delete UI

- "Delete" button (not "Archive") with confirmation dialog explaining data is preserved
- Deleted entities always visible in lists with "Archived" badge, grayed out
- No toggle to hide — always shown with visual distinction
- Claude's Discretion: store deletion guard (block if stock > 0 vs warn but allow)

### Claude's Discretion

- Roles page layout pattern (table+drawer consistent with existing settings, or cards)
- Permission matrix visual design
- Rate limit threshold values per endpoint
- Store deletion guard behavior
- Audit log cleanup scheduler implementation
- IDOR fix patterns (middleware vs per-action check)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security (Phase 1 patterns)

- `.planning/phases/01-security/01-CONTEXT.md` — Phase 1 security decisions: JWT 15-min, in-memory rate limiting, password rules, permission validation patterns
- `src/lib/permissions.ts` — requirePermission/checkPermission implementation, permission string format
- `src/lib/db.ts` — Existing soft delete extension (covers findMany/findFirst but NOT findUnique — SEC2-02)

### Auth & roles schema

- `prisma/schema.prisma` — Role, Permission, RolePermission, UserRole models (lines 100-140)
- `src/actions/settings.ts` — Existing settings server actions pattern

### Settings UI patterns

- `src/app/(dashboard)/settings/users/` — Existing user management UI (reference for roles page layout)
- `src/app/(dashboard)/settings/fees/` — Fee settings pattern (form+preview)
- `src/app/(dashboard)/settings/stores/` — Store management pattern

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `requirePermission(permission, storeId?)` — Already used in all actions, pattern for IDOR checks
- `checkPermission(permission, storeId?)` — Non-throwing variant for conditional UI
- Soft delete extension in db.ts — Needs findUnique added for SEC2-02
- Settings page layout — Table with sidebar navigation, dialog-based forms
- `permissionsVersion` field on Store model — Already exists for JWT invalidation

### Established Patterns

- Server actions in `src/actions/*.ts` with `requirePermission` at top
- Settings pages at `src/app/(dashboard)/settings/*`
- Form components with shadcn/ui (Dialog, Form, Input, Select, Checkbox)
- Toast notifications via sonner

### Integration Points

- `/settings/roles` — New route under existing settings navigation
- `/settings/audit-log` — New route under settings
- `db.ts` — Add findUnique to soft delete extension
- All server actions — Add rate limiting middleware/wrapper
- All server actions with ID params — Add IDOR storeId checks

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 12-security-fixes-roles-ui_
_Context gathered: 2026-04-11_
