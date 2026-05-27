# Changelog

All notable changes to SkyFlow-ScholarSynch 2.0 are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-05-27

### Summary
Full implementation of all modules and transactions defined in the Software Design Description (SDD) for SkyFlow-ScholarSynch 2.0. This release adds dependency tracking, Gantt chart visualization, interactive column mapping, conflict resolution, sync rate-limiting, comment email alerts, Microsoft 365 integration, Stripe multi-tenant billing, Google Doc/PDF export, and a Google Classroom frontend panel.

---

## Module 1 — Kanban / Sheet Sync Enhancements

### [1.1] Interactive Column Mapping

**Added**
- `backend/src/routes/column-mapping.routes.ts` — REST endpoints for saving, fetching, and soft-deleting column mappings (`GET/POST/DELETE /api/column-mappings`)
- `backend/src/migrations/034_column_mappings.sql` — `column_mappings` table with `synced_sheet_id`, `project_id`, `sheet_column`, `kanban_column`, uniqueness constraint on `(synced_sheet_id, sheet_column)`
- `frontend/src/components/sync/ColumnMappingPanel.tsx` — React component featuring:
  - Dropdown mapping of sheet columns to Kanban columns (`todo`, `in_progress`, `review`, `done`, `blocked`)
  - Duplicate detection and validation feedback (banner/toast)
  - Preview mode that shows read-only mapping before saving
  - Save & Apply Mapping button that calls the backend

**Backend validation rules**
- Rejects duplicate sheet columns in the same mapping set
- Rejects duplicate Kanban target columns
- Validates that `kanban_column` is one of the five valid values

---

### [1.2] Conflict Resolution Dialog

**Added**
- `backend/src/routes/conflict.routes.ts` — Endpoints:
  - `GET /api/conflicts?project_id=` — detects conflicts by comparing `tasks.status` / `tasks.due_date` against matched `sheet_tasks` rows
  - `GET /api/conflicts/log?project_id=` — retrieves past resolution history
  - `POST /api/conflicts/resolve` — applies `keep_sheet`, `keep_kanban`, or `merged` resolution and writes to `conflict_logs`
- `backend/src/migrations/035_sync_and_conflict_logs.sql` — `conflict_logs` table recording `field_name`, `sheet_value`, `kanban_value`, `merged_value`, `resolution`, `resolved_by`, `resolved_at`
- `frontend/src/components/sync/ConflictResolutionDialog.tsx` — React component featuring:
  - **Conflicts tab**: lists every detected status / due-date conflict with Sheet vs Kanban values side-by-side
  - **Log tab**: paginated resolution history table (task, field, resolution type, resolver, date)
  - Resolution buttons: Use Sheet / Use Kanban / Merge
  - Toast confirmation after each resolution

---

### [1.3] Manual Sync Rate-Limiter

**Added**
- `backend/src/routes/sync.routes.ts` — Endpoints:
  - `GET /api/sync/status?project_id=` — returns last sync timestamp, cooldown state, remaining seconds
  - `GET /api/sync/logs?project_id=` — last 20 sync attempts with status and count
  - `POST /api/sync/trigger` — triggers sync via `WorkspaceSyncService`; enforces 30-second cooldown, logs all attempts including rate-limited ones
- `backend/src/migrations/035_sync_and_conflict_logs.sql` — `sync_logs` table with `status` (`success`, `failed`, `rate_limited`, `in_progress`), `synced_count`, `triggered_by`, `error_message`
- `frontend/src/components/sync/SyncControlPanel.tsx` — React component featuring:
  - **Sync Now** button that becomes "Wait Ns" during cooldown
  - Live countdown timer (client-side) counting down remaining seconds
  - Cooldown warning modal when user clicks during cooldown
  - Last sync timestamp display with triggering user name
  - Collapsible sync history log with status badges

---

### [1.4] Task Comment Email Alert

**Added**
- `backend/src/services/email.service.ts` — `sendCommentAlertEmail()` function with branded HTML email template linking back to the task
- `backend/src/routes/comment.routes.ts` — Updated `POST /api/tasks/:taskId/comments`:
  - After creating a comment, sends email alert to `assigned_to` (primary assignee) if different from commenter
  - Also iterates `assigned_to_ids` (multi-assignee) and sends alerts to all other assignees
  - Email sends are fire-and-forget (non-blocking) so they never delay the API response
  - Uses Resend API; gracefully falls back to console log when `RESEND_API_KEY` is not set

---

## Module 2 — SaaS Integrations

### [2.1] Microsoft 365 / Excel Online Sync

**Added**
- `backend/src/services/microsoft365.service.ts` — Full Microsoft Graph API service:
  - OAuth 2.0 authorization URL builder, code exchange, token refresh
  - `listWorkbooks()` — searches OneDrive for `.xlsx` files
  - `listWorksheets()` — lists worksheets in a workbook
  - `getWorksheetData()` — reads used range and parses headers + rows
  - `syncWorksheetToTasks()` — upserts tasks in PostgreSQL from Excel data with field-mapping support
- `backend/src/routes/ms365.routes.ts` — Endpoints under `/api/ms365/*`:
  - `GET /status` — connected state and MS user email
  - `GET /auth` — returns OAuth authorization URL
  - `POST /callback` — exchanges code, stores tokens with expiry
  - `DELETE /disconnect` — removes stored tokens
  - `GET /workbooks`, `GET /worksheets`, `GET /headers`
  - `POST /sync` — triggers sync and saves config
  - `GET /config` — retrieves saved sync configuration
- `backend/src/migrations/038_ms365_tokens.sql` — `ms365_tokens` table (access/refresh tokens with expiry) and `ms365_sync_configs` table (workbook/worksheet/field mapping per project)
- `frontend/src/components/integrations/Microsoft365Settings.tsx` — React component featuring:
  - Connect / Disconnect flow with OAuth redirect
  - Workbook and worksheet selector (loaded from Graph API)
  - Field mapping form (Title, Status, Due Date → Excel column headers)
  - Sync button with loading state and result feedback
  - Last synced timestamp display

**Environment variables required**
```
MS365_CLIENT_ID=
MS365_CLIENT_SECRET=
MS365_TENANT_ID=common   # or specific tenant GUID
```

---

### [2.2] Google Classroom Integration Frontend

**Added**
- `frontend/src/components/integrations/ClassroomIntegrationPanel.tsx` — React component featuring:
  - Detects existing Google OAuth connection (reuses Drive/Sheets auth)
  - Course selector dropdown populated from `GET /classroom/courses`
  - Student roster table (name + email) with expandable scroll area
  - Checkbox confirmation before import to prevent accidental bulk imports
  - Calls `POST /classroom/import` and reports imported count
  - Refresh courses button

**Note**: Backend `classroom.service.ts` and classroom routes already existed; this adds the missing frontend panel documented in the SDD.

---

### [2.3] Stripe Multi-Tenant Billing

**Added**
- `backend/src/routes/billing.routes.ts` — Endpoints:
  - `GET /api/billing/plans` — plan catalog (Free / Standard / Pro / Enterprise) with pricing, seat counts, and features
  - `GET /api/billing/subscription?organization_id=` — current plan, status, seat usage
  - `GET /api/billing/history?organization_id=` — billing event log
  - `POST /api/billing/checkout` — creates Stripe Checkout Session (redirect flow)
  - `POST /api/billing/portal` — creates Stripe Customer Portal session
  - `POST /api/billing/webhook` — Stripe webhook handler; processes `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`
- `backend/src/migrations/036_billing_subscriptions.sql` — `subscriptions` table (plan, status, Stripe IDs, seats, cycle, period dates) and `billing_events` table (invoices, receipts, event log)
- `frontend/src/components/billing/BillingDashboard.tsx` — React component featuring:
  - Current plan card with seat usage meter and renewal date
  - Monthly / Annual billing cycle toggle (annual shows 20% discount)
  - Plan comparison cards (Free / Standard / Pro / Enterprise) with feature lists
  - Upgrade button → Stripe Checkout redirect; Enterprise → mailto link
  - Manage Subscription button → Stripe Customer Portal redirect
  - Billing history table with invoice links
- `frontend/src/app/billing/page.tsx` — `/billing` route with checkout result banners (success / cancel)

**Plans defined**

| Plan       | Monthly  | Annual    | Seats |
|------------|----------|-----------|-------|
| Free       | ₱0       | ₱0        | 5     |
| Standard   | ₱1,200   | ₱11,520   | 20    |
| Pro        | ₱3,000   | ₱28,800   | 100   |
| Enterprise | Contact  | Contact   | ∞     |

**Environment variables required**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STANDARD_MONTHLY=price_...
STRIPE_PRICE_STANDARD_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

---

### [2.4] Google Doc / PDF Export

**Added**
- `backend/src/routes/export.routes.ts` — Endpoints:
  - `GET /api/export/reports?project_id=` — report history with metadata
  - `POST /api/export/generate` — assembles report data from tasks table; optionally creates Google Doc via existing `GoogleDocsService` when Google OAuth is available
- `backend/src/migrations/037_report_history.sql` — `report_history` table (`report_type`, `format`, `title`, `sprint_label`, date range, `google_doc_id`, `google_doc_url`, `status`)
- `frontend/src/components/reports/ReportExportPanel.tsx` — React component featuring:
  - Report type selector: Sprint Summary, Team Performance, Task Status, Dependency Report, Custom
  - Format toggle: PDF / Google Doc
  - Optional filters: Sprint Label, Date From, Date To
  - One-click generate with loading state
  - Report history table with Open Doc (Google Docs URL) and Download (JSON data export) actions
- `frontend/src/app/reports/page.tsx` — `/reports` route with project selector

**Report types**
- `sprint_summary` — task snapshot for a sprint period
- `team_performance` — assignee breakdown with progress percentages
- `task_status` — grouped by status with WBS codes
- `dependency_report` — tasks with their dependency chains
- `custom` — all tasks within an optional date range

---

## Module 3 — Notifications & Activity

### [3.1] Real-Time Notifications & Activity Feeds

**Status**: Already fully implemented in previous release (NotificationBell + SSE + Socket.io).

**Verified existing coverage**
- `NotificationBell.tsx` — real-time bell with unread badge, dropdown feed in reverse chronological order, mark as read / read all, empty state ("No recent activity")
- `notification.service.ts` — `notifyTaskAssignment()`, `notifyNewComment()`, `create()`, `markAsRead()`, `markAllAsRead()`
- `sse.routes.ts` / `sse.service.ts` — SSE stream per user ID, `pushNotification()`, `broadcastComment()`
- `activity.routes.ts` / `activity.service.ts` — full audit log of all task and project actions

No changes required. SDD requirement met by existing implementation.

---

### [3.3] Automated Assignment Alerts & Reminders (Consultation Hub)

**Status**: Already fully implemented in the ScholarSync subsystem.

**Verified existing coverage**
- `consultation.routes.ts` — creates consultation entries with metadata (date, attendees, gaps, minutes), pending / validated state machine
- `ScholarSync booking page` — Consultation Entry Form for inputting metadata
- External Leader review section — approve/reject consultation entries
- Follow-up tracking with `open`, `overdue`, `resolved` statuses
- `ss_consultation` / `ss_follow_up` tables — persistent storage

No changes required. SDD requirement met by existing implementation.

---

## Module 4 — Task Management & Visualization

### [4.1] Dependency Tracking

**Added**
- `backend/src/routes/dependency.routes.ts` — Endpoints:
  - `GET /api/tasks/:taskId/dependencies` — returns `blocking` (tasks that depend on this) and `blockedBy` (tasks this depends on)
  - `GET /api/projects/:projectId/dependencies` — all dependency edges for a project (used by graph/Gantt views)
  - `POST /api/tasks/:taskId/dependencies` — creates a dependency with cycle detection via recursive CTE
  - `DELETE /api/dependencies/:dependencyId` — removes a dependency link
- `backend/src/migrations/033_task_dependencies.sql` — `task_dependencies` table with `task_id`, `depends_on_task_id`, `dependency_type` (`finish_to_start`, `start_to_start`, `finish_to_finish`, `start_to_finish`), uniqueness constraint, self-reference guard
- `frontend/src/components/tasks/DependencyDialog.tsx` — React modal featuring:
  - "Blocked By" section listing tasks that must complete first (with delete button)
  - "Blocking" section listing tasks this task blocks
  - Add Dependency form: task selector (all tasks in project) + dependency type dropdown
  - Circular dependency error displayed inline (detected server-side)

**Cycle detection**: Uses a PostgreSQL recursive CTE to walk the existing dependency graph before inserting, returning an error if a cycle would be formed.

**Dependency types supported**
- Finish → Start (FS) — most common; predecessor must finish before successor starts
- Start → Start (SS)
- Finish → Finish (FF)
- Start → Finish (SF)

---

### [4.2] Timeline Visualization of Progress (Gantt Chart)

**Added**
- `backend/src/routes/gantt.routes.ts` — `GET /api/projects/:projectId/gantt` returning tasks with dates, assignee names (aggregated), and all dependency edges; supports `?priority=`, `?assignee=`, `?sprint=` query filters
- `frontend/src/components/gantt/GanttChart.tsx` — Full Gantt chart component featuring:
  - Three zoom levels: **Day**, **Week** (default), **Month** — adjustable via toolbar
  - Task bars color-coded by status (todo=slate, in_progress=sky, review=amber, done=emerald, blocked=red)
  - Priority border indicators (left-side colored stripe per task row)
  - Progress overlay on each bar (semi-transparent fill proportional to `progress` %)
  - WBS code display in left panel
  - Collapse / expand parent tasks (chevron toggle)
  - Filter panel: Priority dropdown + Assignee dropdown
  - Dependency edge count displayed in legend
  - Empty state when no tasks have dates set
  - Responsive scroll: left panel fixed at 280px, right panel horizontally scrollable
- `frontend/src/app/gantt/page.tsx` — `/gantt` route with project selector

---

## Infrastructure & Routing

### [Server] New routes registered in `server.ts`

```typescript
app.use('/api', dependencyRoutes);   // Module 4.1
app.use('/api', ganttRoutes);        // Module 4.2
app.use('/api', columnMappingRoutes); // Module 1.1
app.use('/api', conflictRoutes);      // Module 1.2
app.use('/api', syncRoutes);          // Module 1.3
app.use('/api', billingRoutes);       // Module 2.3
app.use('/api', ms365Routes);         // Module 2.1
app.use('/api', exportRoutes);        // Module 2.4
```

### [Pages] New frontend routes

| Route | Component | Module |
|---|---|---|
| `/gantt` | `GanttChart` | 4.2 |
| `/integrations` | MS365 + Classroom + Sync controls | 1.1, 1.2, 1.3, 2.1, 2.2 |
| `/billing` | `BillingDashboard` | 2.3 |
| `/reports` | `ReportExportPanel` | 2.4 |

### [Migrations] New SQL files

| File | Purpose |
|---|---|
| `033_task_dependencies.sql` | Task dependency graph |
| `034_column_mappings.sql` | Sheet→Kanban column mappings |
| `035_sync_and_conflict_logs.sql` | Sync rate-limit logs + conflict resolution logs |
| `036_billing_subscriptions.sql` | Stripe subscription + billing event history |
| `037_report_history.sql` | Generated report metadata |
| `038_ms365_tokens.sql` | MS365 OAuth tokens + sync configs |

---

## Environment Variables Added

```env
# Microsoft 365 Integration (Module 2.1)
MS365_CLIENT_ID=
MS365_CLIENT_SECRET=
MS365_TENANT_ID=common

# Stripe Billing (Module 2.3)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STANDARD_MONTHLY=
STRIPE_PRICE_STANDARD_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
```

---

## [Unreleased] — 2026-05-28 · Design Integration Pass

### Summary
Seamless integration of all new SDD module pages and components into the existing ScholarFlow frosted-glass, gradient, CSS-variable design system. New features are now first-class citizens in sidebar navigation and the dashboard.

---

### Navigation & Dashboard

**Sidebar — `components/layout/AppLayout.tsx`**
- Added 4 nav links (desktop sidebar + mobile menu):
  - **Timeline** (`/gantt`), **Reports** (`/reports`), **Integrations** (`/integrations`) — all roles
  - **Billing** (`/billing`) — admin/manager only
- Added `Plug`, `CreditCard` to lucide-react imports

**Dashboard — `app/dashboard/page.tsx`**
- 4 new QuickAction shortcuts: Timeline, Reports, Integrations, Billing
- Extended `QuickAction` gradient map with `orange` and `violet` keys
- "What's New" summary card added to right column linking all 4 new pages

---

### Page Files — Auth Loading & Gradient Titles

All 4 new pages now load `user`, `organizations`, `selectedOrg` from `localStorage` and pass them to `<AppLayout>`, fixing the blank sidebar when navigating directly.

| Page | Gradient | Notes |
|---|---|---|
| `app/gantt/page.tsx` | `from-sky-600 to-cyan-600` | max-w-7xl layout, styled project selector |
| `app/integrations/page.tsx` | `from-violet-600 to-purple-600` | Frosted pill tab switcher, violet active gradient |
| `app/billing/page.tsx` | `from-emerald-600 to-teal-600` | `<Suspense>` wrapper for `useSearchParams`, frosted banners |
| `app/reports/page.tsx` | `from-amber-600 to-orange-600` | Consistent project/org selectors |

---

### Component Restyling — 9 Files

**Design tokens applied uniformly:**
- Card: `bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-lg`
- Button (primary): `bg-gradient-to-r from-blue-500 to-cyan-500 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 rounded-xl`
- Modal: `bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40`
- Header band: `bg-white/30 border-b border-white/40`

| Component | Highlight |
|---|---|
| `GanttChart.tsx` | Zoom buttons → gradient active; legend → frosted |
| `DependencyDialog.tsx` | Modal → `bg-white/95 backdrop-blur-md`; list items softer red/amber |
| `SyncControlPanel.tsx` | Sync → cyan→teal gradient; cooldown modal → frosted; log rows → `bg-gray-50/80` |
| `ColumnMappingPanel.tsx` | Save + Add Row → gradient buttons |
| `ConflictResolutionDialog.tsx` | Tabs → frosted pill, amber active; conflict rows → `bg-amber-50/70` |
| `BillingDashboard.tsx` | Plan cards → hover lift `-translate-y-0.5`; upgrade → gradient |
| `Microsoft365Settings.tsx` | Connect/Sync → gradient; connected banner → `bg-emerald-50/80` |
| `ClassroomIntegrationPanel.tsx` | Roster → `bg-gray-50/80`; confirm box → `bg-amber-50/70`; Import → gradient |
| `ReportExportPanel.tsx` | Type/format chips → gradient active; Generate → gradient |

---

## [1.0.0] — Initial Release (prior to this document)

- SkyFlow Kanban board with drag-and-drop, WBS codes, multi-assignee
- ScholarSync consultation booking, courses, groups, journals
- Google OAuth (Drive, Sheets, Calendar, Classroom backend)
- JWT authentication, organization/project/team management
- Real-time notifications via SSE and Socket.io
- Activity audit log
- Gemini AI insights
- Analytics dashboard (Recharts)
- Resend email invitations
