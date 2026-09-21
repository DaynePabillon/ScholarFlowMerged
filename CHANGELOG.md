# Changelog

All notable changes to SkyFlow-ScholarSynch 2.0 are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-09-14 · Task Visibility by Role, Roster Rename, Archive/Recycle & File-to-Description

Six stakeholder revisions tightening task visibility, sidebar clarity, the archive
lifecycle, task reuse, and description input.

### Rev 1 & 6 — Role-Based Task/Project Visibility (server-enforced)

**Problem**
Members received every task in the organization (the frontend only hid others'
tasks client-side), and managers ("team leaders") saw the entire org. Personal
assignments were not actually private.

**Changed**
- `backend/src/routes/organization.routes.ts` — `GET /:id/tasks` now scopes rows by
  the caller's org role. **Members** see only tasks assigned to them (`assigned_to`,
  `task_assignees`, or sheet `assignee_email`). **Managers** (team leaders) are scoped
  to the team(s)/project(s) they belong to or lead (teams via `team_group_members`
  matched by `user_id`/email; projects via `created_by`, `project_members`, or
  `team_groups.project_id`). **Admin/adviser** keep full visibility. Applied to both
  the `tasks` and `sheet_tasks` UNION branches.
- `backend/src/routes/project.routes.ts` — `GET /` scopes the project list the same
  way (admin/adviser see all; members/managers see created/member/team-linked projects).
- `backend/src/routes/team-group.routes.ts` — `GET /organizations/:orgId/team-groups`
  moves `manager` from the full-visibility branch into the scoped branch (own teams only).
- `frontend/src/components/tasks/MemberTaskView.tsx` — relaxed the client filter so
  secondary-assignee tasks are no longer hidden.

**Result**
A member sees only their own tasks everywhere (board, dashboard, table). A team
leader sees only their team's work. This also scopes the dashboard and boards for
those roles. A manager with no assigned team/project sees nothing until assigned one.

---

### Rev 2 — Rename Sidebar "Team" → "Roster"

**Problem**
The `/team` sidebar link was labelled "Team", colliding with the org switcher's
"Your Teams".

**Changed**
- `frontend/src/components/layout/AppLayout.tsx` — desktop and mobile nav label
  changed to "Roster" (route unchanged at `/team`).

---

### Rev 3 — Archive Done Tasks from the Board

**Problem**
The Archived section + restore existed, but the board's task cards never received
the archive handler, so there was no way to archive a Done card from the board.

**Changed**
- `frontend/src/components/tasks/ProfessionalKanban.tsx` — forwards `onArchiveTask`
  and `onDeleteTask` to `ProfessionalTaskCard` (card already supported them), so
  admins/managers get the hover Archive button. Members pass no handler (correct).

---

### Rev 4 — Recycle Completed/Archived Tasks into a New Project for a New Team

**Problem**
No way to reuse finished tasks as a template for a fresh project/team.

**Changed**
- `backend/src/routes/task.routes.ts` — new `POST /api/tasks/recycle` (admin/manager).
  In one transaction it resolves-or-creates the target project, resolves-or-creates the
  target team (and links it to the project via `team_groups.project_id`), then clones the
  selected tasks as fresh `todo` items — copying title/description/priority/weights,
  regenerating `wbs_code`, and clearing assignees, dates, progress and `is_absolute`.
- `frontend/src/components/tasks/RecycleTasksModal.tsx` — new modal to pick/create the
  project and team and submit.
- `frontend/src/components/tasks/{Manager,Admin}TaskView.tsx` — multi-select checkboxes
  and a "Recycle to new project" button in the Archived section.

---

### Rev 5 — Large Description + File-to-Text Auto-Fill

**Problem**
The description was a small 3-row textarea with no way to import content from a file.
(The `tasks.description` column was already `TEXT`, so capacity was never the limit.)

**Changed**
- `frontend/src/components/tasks/DescriptionEditor.tsx` — new reusable field: larger
  resizable textarea with a character count and a "Fill from file" control that extracts
  text in-browser from `.txt/.md/.csv` (FileReader), `.docx` (mammoth) and `.pdf`
  (pdfjs-dist); extracted text is appended and stays editable. No upload/storage.
- `frontend/src/components/tasks/{Manager,Admin}TaskView.tsx` — create/edit modals use
  `DescriptionEditor`.
- `frontend/package.json` — added `mammoth` and `pdfjs-dist@3.11.174`.
- `frontend/next.config.js` — added `webpack: resolve.alias.canvas = false` so pdfjs's
  optional Node `canvas` dependency isn't bundled for the browser.

**Result**
Task descriptions handle large content and can be populated from an uploaded document
without manual copy-paste.

---

### Follow-up — "View Tasks" Deep-Links to the Project's Tasks

**Problem**
The Projects page "View Tasks" link went to a generic `/tasks`, ignoring which
project was clicked.

**Changed**
- `frontend/src/app/projects/page.tsx` — the link is now `/tasks?project_id=<id>`.
- `frontend/src/app/tasks/page.tsx` — reads `project_id` from the URL and passes it as
  `initialProjectId` to the task views.
- `frontend/src/components/tasks/{Admin,Manager}TaskView.tsx` — seed `selectedProjectId`
  from `initialProjectId`, so the board/table/archive load pre-filtered to that project.
- `frontend/src/components/tasks/MemberTaskView.tsx` — filters the member's tasks to the
  project when the param is present.

**Result**
Clicking "View Tasks" on a project opens the Tasks page already filtered to that
project's tasks.

---

### Fix — Archiving a Task 500'd (`tasks_status_check` constraint)

**Problem**
Clicking Archive (`PATCH /api/tasks/:id/status` with `archived`, and the project
completion cascade) returned 500. The raw SQL file `022_kanban_role_enhancements.sql`
had re-created the `tasks_status_check` CHECK constraint **without** `'archived'`,
overriding the earlier inline `001_add_archived_status`. Every other status still
worked (they were all in 022's list), so only archiving failed.

**Changed**
- `backend/src/services/migration.service.ts` — new inline migration
  `058_fix_tasks_status_check_include_archived` drops and re-adds the constraint with
  the full status set (`todo, in_progress, review, done, completed, blocked, on_hold,
  archived`). The DROP runs outside the guarded block so archiving is unblocked even if
  the re-ADD ever fails on legacy data. Applies automatically on backend startup.

**Result**
Archiving works from the board and the archived section (requires a backend restart so
the migration runs).

---

### Fix — Editing an Archived Task Appeared to Do Nothing

**Problem**
Editing a task from the Archived section saved to the DB, but the archive grid never
refreshed (`handleUpdateTask` only called `fetchTasks()`, which excludes archived), so
the change looked like it didn't apply.

**Changed**
- `frontend/src/components/tasks/{Manager,Admin}TaskView.tsx` — after a successful edit,
  also `fetchArchivedTasks(0, false)` when the archive section is open.

---

### Change — Project Is Required (and Actually Used) When Creating a Task

**Problem**
The task-create form's Project field was optional **and ignored** — the endpoint always
filed new tasks under a "General Tasks" default project, regardless of the selection.

**Changed**
- `backend/src/routes/organization.routes.ts` — `POST /:id/tasks` now reads `project_id`,
  **requires** it (400 if missing), verifies it belongs to the org, and inserts the task
  into that project (the "General Tasks" auto-create fallback is removed). A **manager**
  may only create tasks in projects they're under (created / member / team-linked),
  else 403.
- `frontend/src/components/tasks/{Manager,Admin}TaskView.tsx` — Project field labelled
  required (`*`), placeholder "Select a project…", Create button disabled until a project
  is chosen, and a guard in `handleCreateTask`. The dropdown is already limited to the
  caller's own projects for managers (via the role-scoped `GET /api/projects`).

**Result**
Every new task lands in the project you pick, project is mandatory, and a team leader can
only assign to their own projects. (Multi-project assignment was considered but declined
in favor of keeping one task = one project.)

---

## [Unreleased] — 2026-06-22 · Kanban Performance, Overdue Handling & Course-Integrated Project Management

### Task 1 — Kanban Performance: Backend Task Filtering & Pagination

**Problem**
`GET /api/organizations/:id/tasks` returned every task in the org with no filtering
beyond an optional `team_id`. Done/completed/archived tasks piled up in the Kanban
forever, slowing the board and cluttering the UI.

**Changed**
- `backend/src/routes/organization.routes.ts` — added `status`, `exclude_status`,
  `project_id`, `limit`, and `offset` query params to the UNION ALL query. Both
  `tasks` and `sheet_tasks` branches are filtered identically. The UNION is wrapped
  in a subquery for consistent LIMIT/OFFSET pagination.
- `frontend/src/components/tasks/AdminTaskView.tsx` — new state: `selectedProjectId`,
  `showCompleted`, `completedCount`. `fetchTasks` now builds query params with
  `exclude_status=done,completed,archived` by default. Added project filter dropdown,
  "Show completed (N)" toggle, and paginated Archived section with "Load more" button.
- `frontend/src/components/tasks/ManagerTaskView.tsx` — same filter/pagination changes
  as AdminTaskView.

**Result**
Kanban loads only active tasks by default. Completed tasks are one toggle away,
archived tasks paginate 12 at a time. Project filter narrows the board to one project.

---

### Task 2 — Project Overdue Handling (`is_overdue` Computed Flag)

**Problem**
`projects.end_date` existed but was never compared to `NOW()`. Nothing indicated when
a project had blown past its deadline.

**Changed**
- `backend/src/routes/project.routes.ts` — added computed column
  `(p.end_date < NOW() AND p.status NOT IN ('completed','archived')) AS is_overdue`
  to both `GET /` and `GET /:id` queries.
- `frontend/src/app/projects/page.tsx` — added `is_overdue` to `Project` interface;
  red "Overdue" badge with `AlertCircle` icon on project cards; action banner
  (Mark Complete / Archive Project / Extend Deadline) for managers/admins on overdue
  projects.

---

### Task 3 — Cascade-Archive on Project Completion

**Problem**
Setting a project to `completed` or `archived` left its open tasks scattered across
the active Kanban indefinitely.

**Changed**
- `backend/src/routes/project.routes.ts` — `PUT /api/projects/:id` now detects when
  status changes to `completed`/`archived` and runs
  `UPDATE tasks SET status = 'archived' WHERE project_id = $1 AND status NOT IN
  ('done','completed','archived')`. Returns `cascaded_task_count` in the response.
- `frontend/src/app/projects/page.tsx` — added `handleQuickStatusUpdate` handler with
  `window.confirm` before submission; alerts the cascaded task count after success.
  Edit modal's `handleUpdate` also confirms before status changes to
  completed/archived.

---

### Task 4 — Course-Integrated Project Management

**Problem**
Project management (tasks, kanban, project status) lived on separate `/projects` and
`/tasks` pages with no path from a course group to its project. Since users must be
in an organization and a course, and course groups almost always correspond to group
projects, project management should be accessible inside the course context.

**Changed — Backend (`backend/src/routes/scholar.routes.ts`)**
- `GET /courses/:id/teams` — replaced plain `team_groups` SELECT with LEFT JOIN to
  `projects`, returning `project_id`, `project_name`, `project_status`,
  `project_task_total`, `project_task_done` per group.
- `GET /groups/:id/tasks` — replaced hard-coded `return res.json([])` stub with real
  implementation that queries SkyFlow `tasks` by the group's linked `project_id`,
  returns `{ tasks, project_id }`.
- `POST /groups/:id/create-project` — new endpoint (admin/adviser only via
  `verifyInstructor`). Auto-creates a SkyFlow project named
  `"<courseCode> — <groupName>"`, links it to `team_groups.project_id`, adds caller
  as project lead.

**Changed — Course Page (`frontend/src/app/scholar/courses/[id]/page.tsx`)**
- Extended `Group` type with `project_id`, `project_name`, `project_status`,
  `project_task_total`, `project_task_done`.
- Added `projectStatusBadge()` helper — colored status pill on all 3 group card
  render paths (adviser/admin/default).
- Added "Project" tab in group detail modal between Discussion and Journals.
  - No project: empty state + "Set Up Project" button (admin/adviser only).
  - With project: name, status badge, progress bar, "Open Full SkyFlow Board" link,
    "View Group Task List" button.

**Changed — Group Detail Page (`frontend/src/app/scholar/courses/[id]/groups/[groupId]/page.tsx`)**
- Replaced old `Task` type with `SkyFlowTask` shape matching the new endpoint.
- Tasks tab now shows: no-project-linked empty state, inline add-task row (title +
  priority + due date), task cards with left accent bar by status, inline status
  `<select>` with optimistic update, priority pill, due date, assignee badge,
  comment count, "Open" external link to SkyFlow.
- Removed old `showTaskModal` dialog entirely.

**Result**
Advisers/admins can create a project for a group directly from the course page.
Students see their group's tasks inline with status updates and task creation — no
need to navigate to separate SkyFlow pages.

---

## [Unreleased] — 2026-06-08 · Centralized Roles, Sync Rate-Limiter Fix, Calendar & Reports Polish

### Task 1 — Unified Roles Across SkyFlow & ScholarSync

**Problem**
SkyFlow (`organization_members.role`: admin/manager/member/adviser) and ScholarSync
(`ss_account.accountRole`: Student/Adviser/Admin/External Leader) were two separate
role systems for the same person, bridged only by a destructive trigger
(`trg_sync_academic_role`, migration 039) that *overwrote* a user's SkyFlow org role
whenever their academic role changed — e.g. an org "manager" who was also a
ScholarSync "Student" would silently get demoted to "member".

**Changed**
- `backend/src/services/migration.service.ts` — added migration
  `053_unify_roles_remove_overwrite_trigger` which drops the destructive
  `trg_sync_academic_role` trigger and `sync_academic_role_to_org()` function so the
  two role systems coexist instead of clobbering each other.
- `backend/src/routes/organization.routes.ts` — `GET /api/organizations/:id/members`
  now returns each member's `academic_role` via a correlated subquery against
  `ss_account` (matched by the `user_id` bridge from migration 038, falling back to
  a case-insensitive email match).
- `frontend/src/components/layout/AppLayout.tsx` — added `combinedRoleLabel()` helper
  that merges the SkyFlow org role badge with the cached ScholarSync role
  (`scholar_profile` in localStorage), e.g. **"Member & Student"**, **"Admin & Adviser"**.
  Applied to the org switcher button, org dropdown list, mobile menu, and the
  sidebar user-info footer badge.
- `frontend/src/components/team/{AdminTeamView,ManagerTeamView,MemberTeamView}.tsx` —
  added `academic_role` to the `TeamMember` interface and a `formatMemberRole()`
  helper so the Team page member list shows each person's unified role
  (e.g. "Member & Student") instead of just their SkyFlow role.

**Result**
A user can now be simultaneously recognized as, for example, a SkyFlow "Member" and a
ScholarSync "Student" — both roles are visible together everywhere roles are
displayed, and changing one no longer silently overwrites the other.

---

### Task 2 — Manual Sync Rate-Limiter: Fixed Cascading Lockout Bug

**Problem**
The cooldown logic in `POST /api/sync/trigger` and `GET /api/sync/status` determined
"the last sync time" by selecting the most recent `sync_logs` row for the project —
but blocked attempts themselves **insert a `rate_limited` row** (for the History
log). That row's fresh `created_at` was then picked up as the new "last sync"
reference on the very next check, which reset the 30-second cooldown window again.
The result: once a user was rate-limited, *every* subsequent click re-triggered the
limiter and inserted another `rate_limited` row — a perpetual lockout where the
"Sync Now" button could never re-enable itself (countdown effectively never reached
zero against the server's view of "last sync").

**Changed**
- `backend/src/routes/sync.routes.ts`
  - `GET /sync/status` and `POST /sync/trigger` now exclude `status = 'rate_limited'`
    rows when querying for the last sync timestamp
    (`WHERE project_id = $1 AND status != 'rate_limited'`), so only real sync
    attempts (`success` / `failed` / `in_progress`) anchor the cooldown window.
  - Added inline comments documenting each step of the spec'd flow: check last sync
    timestamp → enforce 30s cooldown → insert `rate_limited` log + return 429 with
    `remainingSeconds` → allow sync once the cooldown has genuinely expired.

**Verified existing (already correct, no change needed)**
- `frontend/src/components/sync/SyncControlPanel.tsx` already implements the full
  spec: live countdown timer, "Wait Xs" disabled button state, amber "Sync Rate
  Limit" warning popup ("Please wait N seconds before syncing again…"), "Last
  synced [time] by [user]" status indicator, and a History log with status badges.

**Result**
The cooldown now correctly expires 30 seconds after the last *real* sync — the
button re-enables, the countdown reaches zero, and the warning popup only appears
while genuinely within the cooldown window.

---

### Task 3 — Calendar/Date Pickers: Cap Selectable Date at Today

**Request**
"The latest date should be the current day when selecting a date" — date pickers
across the app should not let a user pick a date beyond today.

**Approach**
Surveyed all 18 files containing `<input type="date">` / `type="datetime-local"`.
Applied `max={today}` (`new Date().toISOString().split('T')[0]`) only to fields that
**record something that has already happened** — where a future date would be
nonsensical or a data-entry error. Left future-planning fields (task due dates,
project start/end dates, checkpoint deadlines, calendar event times, consultation
*slot* availability, announcement expiry) untouched, since those legitimately need
to accept future dates.

**Changed — `max={today}` added to:**
- `frontend/src/components/time/TimeTracker.tsx` — time-entry "Date" (can't log hours for a future day)
- `frontend/src/app/scholar/adviser/consultation-prep/[bookingId]/page.tsx` — "Consultation Date" (recording when a session occurred)
- `frontend/src/app/scholar/schedule/page.tsx` — adviser "Consultation Date" record field (`conDate`, line ~1841 — same retrospective use as above; the *slot creation* date fields at lines ~1283/1710 were left untouched since those schedule future availability)
- `frontend/src/app/scholar/adviser/consultation-hub/page.tsx` — "From"/"To" history filter date range (consultation records can't exist in the future)
- `frontend/src/app/scholar/courses/[id]/page.tsx` — "Journal Date" for member journal entries (capped to `todayJournalDate`, recording a reflection that already took place)

**Result**
Retrospective date fields now reject any date later than today directly in the
native date-picker UI, preventing accidental future-dated log entries while
preserving normal future-date entry for scheduling/planning fields.

---

### Task 4 — Reports: Sort Task Priorities in Descending Order

**Request**
"Project priorities for reports should be descending order from highest priority" —
PDF reports listing tasks should present higher-priority items first instead of in
arbitrary/insertion order.

**Root cause**
`generatePDF()` in `ReportExportPanel.tsx` rendered every report's task tables
(`tasks.map(...)`) directly from the array returned by the API, with no sort applied.
The "Priority Breakdown" table in the Task Status report also grouped by priority via
`Object.entries(priorityGroups)`, which iterates in first-seen insertion order rather
than by priority level. The project's `priority` column allows four levels —
`'low' | 'medium' | 'high' | 'critical'` (per the `CHECK` constraint in
`migration.service.ts`) — with no ranking applied anywhere in the report pipeline.

**Changed — `frontend/src/components/reports/ReportExportPanel.tsx`**
- Added a `PRIORITY_RANK` map (`{ critical: 4, high: 3, medium: 2, low: 1 }`) and a
  `priorityRank()` helper (case-insensitive, unknown values rank lowest) near the
  existing `primaryAssignee` helper.
- In `generatePDF()`, immediately after `const today = new Date();`, the `tasks`
  array is now re-sorted **once**, globally:
  `tasks = [...tasks].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))`
  — so every report type (Sprint Summary, Task Status, Team Performance, Dependency
  Report, Custom Report) lists tasks Critical → High → Medium → Low without needing
  per-table changes.
- Updated the Task Status report's "Priority Breakdown" table to sort its rows by
  priority level descending (`Object.entries(priorityGroups).sort((a, b) =>
  priorityRank(b[0]) - priorityRank(a[0]))`) instead of insertion order, so the
  breakdown table visually matches the descending-priority task lists below it.
- "Task Details by Member" in the Team Performance report re-sorts the global list
  alphabetically by assignee (`[...tasks].sort(...localeCompare...)`); because
  `Array.prototype.sort` is stable (ES2019+) and `tasks` is now pre-sorted by
  priority descending, each assignee's task group automatically retains
  highest-to-lowest priority ordering as a secondary sort — no extra code needed.

**Result**
Every PDF report now lists/groups tasks with the highest-priority items first
(Critical → High → Medium → Low), consistently across all five report types.

---

### Task 5 — Unify the Platform: Remove "SkyFlow" vs. "ScholarSync" Separation

**Request**
"I need the whole system to be unified, no more separation of the systems, have
everything as under scholarflow, arrange the features on the sidebar appropriately."

**Root cause**
Although Task 1 unified the *role* model, the product still visually presented
itself as two competing systems: the launchpad (`app/page.tsx`) rendered two
separately-branded cards ("SkyFlow" in a blue-indigo gradient vs. "ScholarSync" in
a sky-blue gradient, each with its own icon and feature carousel), the sidebar in
`AppLayout.tsx` grouped nav links by *which legacy subsystem they came from*
("SkyFlow" / "ScholarSync" / "Google Workspace" sections), and ~20 user-facing
strings across pages, components, alerts, theme names, and template data still
referred to "SkyFlow" or "ScholarSync" by name — reinforcing the impression of two
separate products bolted together rather than one cohesive "ScholarFlow" platform.

**Changed — Sidebar reorganized by function, not by origin (`components/layout/AppLayout.tsx`)**
- Replaced the three subsystem-based collapsible groups (SkyFlow / ScholarSync /
  Google Workspace) with four function-based groups that intermix features
  regardless of their legacy origin:
  - **Projects & Tasks** (`FolderKanban`): Dashboard, Boards, Tasks, Projects, Team,
    Timeline, Reports
  - **Academics** (`GraduationCap`): Academic Dashboard, Courses, role-conditional
    Consultation/Schedule, Consultation Hub
  - **Tools & Integrations** (`Plug`): Integrations, Workspace Sync, Calendar,
    Drive, Sheets, Analytics — e.g. "Workspace Sync" (a former ScholarSync feature)
    now sits alongside "Calendar"/"Drive" (former Google Workspace features)
  - **Administration** (`Shield`): all admin-only pages consolidated into one group
    — Accounts, Data Integrity, Adviser Availability, Semester Readiness, *and*
    Billing (previously scattered across two different system groups)
- Renamed state variables from `skyflowOpen`/`scholarOpen`/`workspaceOpen` to
  `projectsOpen`/`academicsOpen`/`toolsOpen`/`adminOpen`, with advisers defaulting
  to the Academics group expanded. Mirrored the same four groups in the mobile menu
  (and added "Data Integrity" there, which was previously desktop-only).
- Updated the `combinedRoleLabel` comment to describe the unified identity model
  without naming the legacy subsystems.

**Changed — Launchpad redesigned as one workspace, not two products (`app/page.tsx`)**
- Replaced the two competing-gradient cards ("SkyFlow" in blue-indigo with a
  `Cloud` icon vs. "ScholarSync" in sky-blue with a `GraduationCap` icon) with two
  cards that share **one consistent blue → indigo gradient family** (only the
  gradient stops are reordered between them) and the same icon-badge/button
  treatment, presented as two *areas* of a single platform:
  - "Projects & Tasks" (`FolderKanban` icon, "Boards, Team & Timelines")
  - "Academics" (`GraduationCap` icon, "Courses, Schedules & Consultations")
- Renamed the underlying feature-list constants `SKYFLOW_FEATURES` →
  `PROJECT_FEATURES` and `SCHOLAR_FEATURES` → `ACADEMIC_FEATURES`; removed the
  now-unused `Cloud` icon import.

**Changed — Removed "SkyFlow"/"ScholarSync" brand names from ~20 user-facing strings**
| File | Before → After |
|---|---|
| `app/landing/page.tsx` | Hero "SkyFlow" → "ScholarFlow"; CTA copy + footer copyright |
| `app/login/page.tsx` | Footer copyright "© 2025 SkyFlow" → "© 2025 ScholarFlow" |
| `components/auth/login-page.tsx` | Logo heading + "Sign in to SkyFlow" → "ScholarFlow" |
| `app/layout.tsx` | `<title>` metadata "SkyFlow - Project Management Platform" → "ScholarFlow - Unified Project & Academic Platform" |
| `app/invite/accept/page.tsx` | "SkyFlow Invitation" → "ScholarFlow Invitation" |
| `app/auth/callback/page.tsx` | "Welcome to SkyFlow!" → "Welcome to ScholarFlow!" |
| `app/settings/page.tsx` | "Customize your SkyFlow experience" → "...ScholarFlow experience" |
| `app/dashboard/page.tsx` | "Import from ScholarSync to get started" / "...to SkyFlow" → neutral "Academic Portal" / "your workspace" phrasing |
| `app/analytics/page.tsx` | "Import your class data from ScholarSync..." → "...from the Academic Portal..." |
| `app/scholar/courses/[id]/page.tsx` | "View Full Analytics in SkyFlow" → "...in ScholarFlow" |
| `app/scholar/workspace-sync/page.tsx` | "Into a course from your ScholarSync" → "Into one of your academic courses" |
| `components/organization/OrganizationGateway.tsx` | "...imports your team from ScholarSync..." / "← Back to ScholarSync" → "...from the Academic Portal..." / "← Back to Academics" |
| `components/tasks/{Admin,Manager}TaskView.tsx` | Sync-delete alert "...removed from SkyFlow upon the next synchronization" → "...removed from ScholarFlow..." |
| `components/teams/SheetTemplateModal.tsx` | Sample project name "SkyFlow Project Manager" → "Campus Project Tracker" |
| `components/sync/ConnectedSheetsPanel.tsx` | Default workspace folder name `'SkyFlow Default'` → `'ScholarFlow Default'` |
| `config/themes.ts` + `config/scholar/themes.ts` | Theme preset name "SkyFlow Classic" → "ScholarFlow Classic" |

Internal-only references (code comments, `console.log` debug lines, CSS class
names like `.scholar-theme`, localStorage key names like `ss_user`/`auth_token`,
and the `syncTokenFromScholarSync`/`syncTokenToScholarSync` utility functions in
`utils/tokenSync.ts`) were intentionally left untouched — renaming them risks
breaking the token-bridging logic and the scoped dark-mode CSS rules for no
user-visible benefit; they document *how* the legacy systems were merged, not
brand the product as separate.

**Result**
ScholarFlow now presents as one unified platform end-to-end: the sidebar groups
every feature by what it *does* (Projects & Tasks / Academics / Tools &
Integrations / Administration) instead of which legacy subsystem it came from,
the launchpad's two areas share one gradient language instead of competing
palettes, and no remaining user-facing text refers to "SkyFlow" or "ScholarSync"
as separate products — every visible mention now reads "ScholarFlow."

---

### Task 6 — Merged Role Picker: Scrollable Dropdown + Academic Role in One Place

**Problem**
On the Team → Role Management screen, the role-picker dropdown had no
`max-height`/`overflow-y-auto`, so when there wasn't enough room below the trigger
button it clipped/overflowed and the lower options (e.g. "Adviser") were
unreachable — "I cannot scroll through the different roles." Separately, setting
someone's *academic* role (Student/Adviser/Admin/External Leader) required leaving
the Team page entirely and visiting the standalone `/scholar/admin/accounts`
page — "it is also a hassle to give the user the roles for the academics."

**Changed**
- `frontend/src/components/team/RoleManagement.tsx`
  - Made the role dropdown scrollable: `w-72 max-h-96 overflow-y-auto` on the
    dropdown container, fixing the clipping/overflow issue.
  - Merged academic-role assignment into the SAME dropdown: added an
    `ACADEMIC_ROLE_CONFIG` map (Student / Adviser / Admin / External Leader, each
    with its own icon/color/description) and a second labeled section
    ("Academic Role") below the existing "Organization Role" section — both
    independently selectable, consistent with migration 053's "two role systems
    coexist independently" design.
  - Added an `academic_role` field to the `Member` interface and an
    `onAcademicRoleChange` prop; the trigger button now also shows a small
    badge with the member's current academic role (e.g. "Manager · 🎓 Student")
    so both roles are visible at a glance.
- `backend/src/routes/organization.routes.ts` — added
  `PATCH /api/organizations/:orgId/members/:memberId/academic-role`, gated by the
  SAME org-admin check as the existing role-change route (querying
  `organization_members` for `role = 'admin'` — **not** the academic-admin-gated
  `verifyAdmin` middleware, which would incorrectly 403 an org-admin who isn't
  also an academic Admin). It upserts `ss_account` by email (the same
  `ON CONFLICT ("accountEmail") DO UPDATE` pattern already used for the
  adviser-role cascade) and never touches `organization_members.role`, keeping
  the two role systems independent.
- `frontend/src/components/team/AdminTeamView.tsx` — threaded `academic_role`
  through from the already-available `GET /api/organizations/:id/members`
  response into `<RoleManagement>`'s `members` prop (it was being silently
  dropped despite already being on the `TeamMember` interface and returned by
  the API), and added a `handleAcademicRoleChange()` handler that calls the new
  endpoint and refreshes the member list.

**Result**
Admins can now scroll through every role option without anything clipping, and
can set both a person's organization role (Admin/Manager/Member/Adviser) *and*
their academic role (Student/Adviser/Admin/External Leader) from one unified
picker on the Team page — no more trip to a separate Academics admin page.

---

### Task 7 — Date Pickers: Fixed UTC-vs-Local-Timezone "Today" Bug

**Request**
"Date selector with calendar still allows picking a past date than the current,
I also need the time to be localized per user since I think it still uses UTC."

**Root cause**
Task 3's `max={today}` fix (above) computed "today" with
`new Date().toISOString().split('T')[0]` — but `toISOString()` always returns the
date in **UTC**, not the browser's local date. Depending on how far the user's
timezone is offset from UTC, the calculated "today" could be off by a full day:
- Users **ahead of UTC** (e.g. UTC+8 in the evening) get *tomorrow's* UTC date as
  "today", so the `max` cap doesn't actually block the day after their real today.
- Users **behind UTC** (e.g. UTC-5 late at night) get *yesterday's* UTC date, so
  the `max` cap incorrectly blocks them from picking their own actual today.

This is exactly the symptom reported — the cap looked like it was both "still
allowing a wrong date" and "still using UTC," because it was.

**Fix**
Added `frontend/src/lib/utils/date.ts` with timezone-safe helpers that read a
`Date`'s **local** accessors (`getFullYear`/`getMonth`/`getDate`/`getHours`/
`getMinutes`) instead of normalizing through UTC:
- `getLocalDateString(date?)` → `YYYY-MM-DD` in the browser's local timezone
- `getLocalDateTimeString(date?)` → `YYYY-MM-DDTHH:mm` in the local timezone
- `getTodayLocalDateString()` → today's date as `YYYY-MM-DD`, local timezone

Replaced every `new Date().toISOString().split('T')[0]` / `.slice(0, 10)`
occurrence used for date-picker `value`/`min`/`max` computation — 14 occurrences
across 7 files — with `getTodayLocalDateString()`:
- `frontend/src/components/time/TimeTracker.tsx` (initial state, reset-after-submit, `max`)
- `frontend/src/app/scholar/adviser/consultation-hub/page.tsx` ("From"/"To" filter `max`)
- `frontend/src/app/scholar/adviser/consultation-prep/[bookingId]/page.tsx` (Consultation Date `max`)
- `frontend/src/app/scholar/courses/[id]/page.tsx` (`todayJournalDate` state, journal-form `today` const, `max` fallback)
- `frontend/src/app/scholar/schedule/page.tsx` (Consultation Date record `max`)
- `frontend/src/components/tasks/AdminTaskView.tsx` (due-date picker `min` ×2)
- `frontend/src/components/tasks/ManagerTaskView.tsx` (due-date picker `min` ×2)

**Result**
"Today" in every date picker now always matches the date on the user's own wall
clock, regardless of their timezone offset from UTC — eliminating both the
off-by-one-day cap and the perceived "still uses UTC" behavior. (Display-side
time formatting elsewhere in the app, e.g. `toLocaleTimeString()`/`toLocaleDateString()`,
was already timezone-correct and required no changes.)

---

### Task 8 — Start Date: Block Creation Instead of Silently Dropping Non-Compliant Dates

**Request**
"Instead of removing the start date if it doesn't comply to the latest date
being the current day, don't allow the creation of it."

**Approach**
"Start Date" fields record when something *actually began* — a retrospective
fact, not a plan — so they fall under the same "latest date is today" rule as
Task 3/7's other retrospective fields. Rather than relying solely on the native
`max` attribute (which can let a stale/typed-in value slip through silently and
get nulled at submit time), explicit validation now runs at submission and
**blocks the create/update entirely** with a visible error message
("Start date cannot be later than today.") whenever the chosen start date is
later than the user's local today — computed via the same timezone-safe
`getTodayLocalDateString()` helper added in Task 7.

**Changed — `max={getTodayLocalDateString()}` cap + submit-time block on:**
- `frontend/src/components/tasks/AdminTaskView.tsx` — Create & Edit Task "Start Date" (`handleCreateTask`/`handleUpdateTask`)
- `frontend/src/components/tasks/ManagerTaskView.tsx` — Create & Edit Task "Start Date" (`handleCreateTask`/`handleUpdateTask`)
- `frontend/src/app/boards/page.tsx` — Create Task "Start Date" (`handleCreateTask`)
- `frontend/src/app/projects/page.tsx` — Create & Edit Project "Start Date" (`handleCreate`/`handleUpdate`)
- `frontend/src/app/scholar/schedule/page.tsx` — Consultation record "Consultation Date" (`handleSaveConsultation`)

**Result**
Picking a future start/consultation date now surfaces an explicit, blocking
error ("Start date cannot be later than today.") and prevents the
record from being created or updated — instead of the date being silently
stripped (`start_date || null`) and the record saved without it.

---

### Task 9 — Google Classroom Import Now Populates ScholarSync Academics

**Request**
"Find out how the academics part of the project works, especially how to add
courses and students enrolled in them, then make the google classroom
integration work with it."

**How ScholarSync academics works (research summary)**
- **Courses** live in `ss_courses` (`id`, `courseName`, `courseCode`,
  `courseSection`, `courseTerm`, `courseKey`, `courseAmount`, `courseAdviser`,
  `courseImportedBy`). `POST /api/courses` (Admin-only, `scholar.routes.ts`)
  creates a row with a random 8-character `courseKey`.
- **Enrollment** is a many-to-many link in `ss_enrollments` (`account_id`
  → `ss_account.account_id`, `course_id` → `ss_courses.id`, unique pair).
  `POST /api/enroll` lets a logged-in Student self-enroll by submitting a
  course's `courseKey`; it inserts the `ss_enrollments` row and increments
  `ss_courses.courseAmount`.
- **`GET /api/courses`** is role-scoped: Admins see every course, Advisers see
  courses where they're `courseAdviser` (or lead a `team_groups` row for that
  course), and Students see only courses they're enrolled in via
  `ss_enrollments` (with a `team_group_members`-email fallback for
  WBS-imported students).
- Previously, **`POST /api/classroom/import`** (`classroom.routes.ts`) only
  created SkyFlow `organization_invitations` (role `member`) and upserted
  `ss_account` rows (role `Student`) — it never touched `ss_courses` /
  `ss_enrollments`, so imported Classroom rosters were invisible to the
  academics side of the app.

**Changed**
- `backend/src/services/migration.service.ts` — added migration
  `055_ss_courses_classroom_link`, which adds a nullable
  `ss_courses."classroomCourseId"` column with a partial unique index, so a
  Classroom course can be matched/re-synced to its `ss_courses` row across
  multiple imports instead of creating duplicates.
- `backend/src/routes/classroom.routes.ts` — `POST /classroom/import` now
  additionally accepts `course_name` / `course_section` and:
  1. Looks up an `ss_courses` row by `classroomCourseId`; if none exists,
     creates one (`courseName`/`courseSection` from Classroom, `courseCode`
     from the section or `GC-<last 6 chars of course_id>`, `courseTerm` =
     current year, a freshly generated `courseKey`, `courseAdviser`/
     `courseImportedBy` set from the importing user).
  2. For each imported student, the `ss_account` upsert now returns
     `account_id`, which is used to insert an `ss_enrollments` row
     (`ON CONFLICT DO NOTHING`) linking the student to that course.
  3. Recomputes `ss_courses.courseAmount` from the live `ss_enrollments`
     count after the import, and returns `{ imported, skipped, total,
     enrolled, course }` (`course` = `{ id, courseName, courseCode,
     courseKey }` or `null` if no `course_id` was supplied).
- `frontend/src/components/integrations/ClassroomIntegrationPanel.tsx` —
  `handleImport` now sends `course_id`, `course_name`, and `course_section`
  for the selected Classroom course, and the success message reports the
  ScholarSync course students were enrolled into and how many enrollments
  were created (e.g. "Imported 12 student(s) from Google Classroom · Enrolled
  10 in ScholarSync course \"CS101\" (CS101-A)").

**Result**
Importing a Google Classroom roster now creates (or re-uses, on subsequent
imports) a matching ScholarSync course in `ss_courses` and enrolls each
imported student in `ss_enrollments` — so the course immediately appears in
`GET /api/courses` for Admins/Advisers, and enrolled students see it on their
ScholarSync dashboard, without any manual course creation or enrollment step.

> **Migration note:** `055_ss_courses_classroom_link` runs automatically on
> the next backend restart (same as the still-pending `054` migration).

---

### Task 10 — Org Admins Are Immediately Admins in ScholarSync Too

**Request**
"I want that if a user is an admin, they are immediately admin for both the
project management and consultation part of the system."

**Context**
SkyFlow `organization_members.role = 'admin'` (project management) and
ScholarSync `ss_account.accountRole = 'Admin'` (consultation/academics —
gates `verifyAdmin`/`verifyInstructor` in `scholar.routes.ts`, the
Consultation Hub, and validation workflows) are two independent role systems
(migration 053). Previously only the `'adviser'` role change cascaded into
`ss_account`; becoming an org admin did not.

**Changed**
- `backend/src/services/ssAccountSync.service.ts` (new) — exports
  `syncScholarSyncAdminRole(email, name, userId)`, which upserts
  `ss_account` with `"accountRole" = 'Admin'` for the given email
  (non-fatal if `ss_account` doesn't exist).
- `backend/src/routes/organization.routes.ts`:
  - `POST /api/organizations` — after the creator is inserted as
    `organization_members.role = 'admin'`, immediately syncs them to
    ScholarSync Admin.
  - `PATCH /:orgId/members/:memberId/role` — added an `else if (role ===
    'admin')` branch (alongside the existing `'adviser'` branch) that syncs
    the promoted member to ScholarSync Admin.
- `backend/src/routes/invitation.routes.ts` — `POST /invitations/accept`
  now syncs the accepting user to ScholarSync Admin if the invitation's role
  is `'admin'`.
- `backend/src/services/migration.service.ts` — added migration
  `056_backfill_admin_to_scholarsync`, which upserts `ss_account.accountRole
  = 'Admin'` (by email) for every user who is already an active org admin in
  any organization, so existing admins get consultation-side Admin access
  without waiting for a role change.

**Result**
Any user who is (or becomes) an org admin — via org creation, a role change,
or accepting an "admin" invitation — immediately has `ss_account.accountRole
= 'Admin'`, granting them Admin access on the consultation/academics side
(Consultation Hub, validation workflows, course management) with no extra
steps.

> **Migration note:** `056_backfill_admin_to_scholarsync` runs automatically
> on the next backend restart (same as the still-pending `054`/`055`
> migrations).

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

## [Unreleased] — 2026-05-28 · Bug Fixes & Adviser Role

### Summary
Six bug fixes: projects now load correctly in Timeline, Reports, and Integrations pages; task creation now includes a project selector; Google Classroom backend endpoints were fully implemented; and a new `adviser` role was added across the full stack.

---

### Bug Fix 1 — Projects not loading in Timeline, Reports, Integrations

**Root cause:** All three pages called `GET /api/projects` and read `res.data.projects` (undefined), while the backend returns a flat array.

**Fixed**
- `frontend/src/app/gantt/page.tsx` — parse response as `Array.isArray(res.data) ? res.data : []`; pass `?organization_id=` query param; read `selectedOrganization` from localStorage (not `orgs[0]`); added `handleOrgChange` that re-fetches projects
- `frontend/src/app/reports/page.tsx` — same fix; `orgId` state now correctly initialized from `selectedOrganization`
- `frontend/src/app/integrations/page.tsx` — same fix; Sync tab shows a proper empty state with link when no project exists

---

### Bug Fix 2 — Task creation missing project selector

**Fixed**
- `frontend/src/components/tasks/AdminTaskView.tsx`
  - Added `project_id: null` to `newTask` initial state
  - Added `projects` state and `fetchProjects()` function (fetches `GET /api/projects?organization_id=`)
  - Called `fetchProjects()` in `useEffect` alongside `fetchTasks` and `fetchMembers`
  - Added Project `<select>` field in the Create Task modal form
  - Added `project_id: null` to form reset after successful creation
- `frontend/src/components/tasks/ManagerTaskView.tsx` — identical changes applied

---

### Bug Fix 3 — Google Classroom backend missing

**Added**
- `backend/src/routes/classroom.routes.ts` — **new file** with three endpoints:
  - `GET /api/classroom/courses` — lists active courses for the authenticated user's Google account
  - `GET /api/classroom/courses/:courseId/students` — fetches roster for a course
  - `POST /api/classroom/import` — imports students as org member invitations via `organization_invitations` upsert
- `backend/src/services/google/classroom.service.ts` — replaced placeholder stub with real implementation using `getGoogleClients()` from `config/google`; kept legacy default export for `dashboard.routes.ts` backward compatibility
- `backend/src/routes/auth.routes.ts` — added `GET /api/auth/google/status` endpoint that checks `access_token` + `refresh_token` presence for the authenticated user; added `query` import from `config/database`
- `backend/src/config/google.ts` — restored two Classroom OAuth scopes:
  - `https://www.googleapis.com/auth/classroom.courses.readonly`
  - `https://www.googleapis.com/auth/classroom.rosters.readonly`
- `backend/src/server.ts` — registered `classroomRoutes` under `/api`

> **Note:** Classroom API must be enabled in Google Cloud Console → APIs & Services before OAuth will succeed with these scopes.

---

### Bug Fix 4 — Stripe (skipped)

Stripe configuration skipped by user request. Backend already returns `{ configured: false }` gracefully.

---

### Feature — Adviser Role

**Added `adviser` as a valid organization membership role with manager-level access.**

**Backend**
- `backend/src/routes/organization.routes.ts` — added `'adviser'` to role validation arrays in both the invite endpoint (line 184) and the role-change endpoint (line 826); advisers cannot send invites or change roles (admin-only remains unchanged)

**Frontend — type system**
- `frontend/src/config/themes.ts` — added `'adviser'` to `UserRole` type; added `roleThemes.adviser` (purple palette: primary `#7c3aed`, dark mode `#a78bfa`)
- Updated `Organization.role` and `Member.role` type declarations in **15 files**:
  - Pages: `tasks`, `gantt`, `reports`, `integrations`, `boards`, `billing`, `dashboard`, `analytics`, `drive`, `workspace-sync`, `settings`, `sheets`, `select-workspace`, `team`, `calendar`, `projects`
  - Components: `AppLayout`, `AdminTeamView`, `ManagerTeamView`, `MemberTeamView`, `RoleManagement`, `OrganizationGateway`

**Frontend — UI**
- `frontend/src/components/layout/AppLayout.tsx` — added `adviser: { label: 'Adviser', color: 'bg-purple-100 text-purple-700' }` to `getRoleBadge`; adviser gets manager-level sidebar access (all `role !== 'member'` gates pass)
- `frontend/src/app/tasks/page.tsx` — adviser role routes to `ManagerTaskView` (same as manager)
- `frontend/src/components/team/AdminTeamView.tsx` — added `'adviser'` to role-change dropdown options; added `🎓 Adviser` option in invite modal; added Adviser to member filter dropdown
- `frontend/src/components/team/RoleManagement.tsx` — added `adviser` entry in `ROLE_CONFIG` (purple color, "Can view all teams and manage tasks" description)

---

## [Unreleased] — 2026-05-29 · Gantt Fix, Dependency UI, Adviser Role & Real Reports

### Summary
Four targeted fixes: Gantt chart now shows tasks for all roles by smart-selecting the most populated project; dependency tracking is fully accessible from task cards and the table view; the ScholarSync "Advisers" role now maps to the dedicated `adviser` role in SkyFlow instead of `manager`/`admin`; and report downloads now produce real PDF and Word (.docx) files with role-appropriate content.

---

### Fix 1 — Gantt Chart: Tasks Not Visible for Manager/Member Roles

**Root cause:** `GET /api/projects` orders by `created_at DESC` (newest first). If the newest project had no tasks, manager/member users saw an empty chart because they couldn't see the dropdown to switch projects.

**Backend — `backend/src/routes/project.routes.ts`**
- Added scalar subquery `(SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count` to `GET /api/projects` response so the frontend can pick a populated project automatically

**Frontend — `frontend/src/app/gantt/page.tsx`**
- Updated `Project` interface to include `task_count?: number`
- Changed `fetchProjects` to prefer the first project with `task_count > 0` over `list[0]`; this ensures all roles land on a chart with visible bars without needing to change the dropdown

**Frontend — `frontend/src/components/gantt/GanttChart.tsx`**
- Added `error` state and `.catch` handler so API failures surface as an actionable error message instead of a silent empty state
- Added null guard (`if (!projectId) return`) to prevent fetching with an empty ID
- Added defensive `|| []` defaults on `tasks`, `dependencies`, `members`

**Backend — `backend/src/services/migration.service.ts`** (migration `051`)
- Expanded migration 051 from a single `progress_percent` add to a full safety-net block:
  - `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent NUMERIC DEFAULT 0`
  - `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1`
  - `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS wbs_code VARCHAR(100)`
  - `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP`
  - `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_absolute BOOLEAN DEFAULT FALSE`
  - `CREATE TABLE IF NOT EXISTS task_assignees (...)` with `UNIQUE(task_id, user_id)` and indexes
  - Ensures fresh installs without the raw SQL migration files still have all required columns

---

### Fix 2 — Dependency Tracking: Dialog Now Accessible From Task Views

**Root cause:** `DependencyDialog.tsx` and all four backend dependency endpoints were fully implemented but the dialog was never imported or rendered anywhere — it was an orphaned component with no trigger.

**`frontend/src/components/tasks/DependencyDialog.tsx`**
- Fixed data-shape bug: `GET /api/tasks` returns a flat array but the dialog read `tasksRes.data.tasks` (always `undefined`), so the "depends on" dropdown was always empty. Changed to `Array.isArray(tasksRes.data) ? tasksRes.data : (tasksRes.data.tasks || [])`.

**`frontend/src/components/tasks/ProfessionalTaskCard.tsx`**
- Added `onDependency?: () => void` prop
- Added `Link2` icon to lucide-react import
- Added sky-blue `Link2` hover button in the Quick Actions overlay (appears alongside Archive/Delete on hover, admin/manager role only)

**`frontend/src/components/tasks/ProfessionalKanban.tsx`**
- Added `onDependency?: (task: Task) => void` to `ProfessionalKanbanProps`
- Passed `role` and `onDependency` through to each `ProfessionalTaskCard`

**`frontend/src/components/tasks/AdminTaskView.tsx`**
- Imported `DependencyDialog` and `Link2`
- Added `dependencyTask` state (`Task | null`)
- Passed `onDependency={(task) => setDependencyTask(task as Task)}` to both Kanban boards (Advisor Board + Team Board)
- Added **Actions** column to the table view with a `Link2` icon button per row (only shown when `task.project_id` is set)
- Renders `<DependencyDialog>` as a modal overlay when `dependencyTask` is non-null

**`frontend/src/components/tasks/ManagerTaskView.tsx`**
- Identical changes: `DependencyDialog` import, `dependencyTask` state, `onDependency` on both Kanban boards, `Link2` added next to the existing Edit button in the table's Actions column

**Result:** Clicking the `🔗` icon on any task card (hover) or any table row opens the dependency dialog. The "Blocked By" and "Blocking" sections and the Add Dependency dropdown now fully populate.

---

### Fix 3 — ScholarSync Adviser Role Mapping

**Root cause:** When a ScholarSync user with `accountRole = 'Advisers'` logged in, three separate code paths mapped them to SkyFlow `'admin'` or `'manager'` rather than the intended `'adviser'` role. Additionally, when an admin changed a user's role in the ScholarSync Accounts panel, the cascade to `organization_members` also wrote `'manager'`.

**`backend/src/routes/auth.routes.ts`** (3 fixes)
- **First-time login** (`skyflowRole`): `Advisers → 'admin'` → `Advisers → 'adviser'`
- **Org membership sync** (`mappedRole`): `Advisers → 'manager'` → `Advisers → 'adviser'`
- **Existing-user backfill** on `/api/auth/me` (`backfillRole`): `Advisers → 'admin'` → `Advisers → 'adviser'`

**`backend/src/routes/scholar.routes.ts`** (1 fix)
- Admin role-change cascade (`orgRole`): `Advisers → 'manager'` → `Advisers → 'adviser'`

**No frontend changes needed** — `AppLayout`, `tasks/page.tsx`, and all Organization type declarations already handled `'adviser'` from the previous release. The ScholarSync auth middleware's `normalizeRole` already maps `'adviser' → 'advisers'` for route-level access control.

---

### Feature — Real PDF & Word Report Downloads

**Root cause:** `ReportExportPanel` generated a `.json` blob regardless of the format selected. No PDF or DOCX file was ever produced.

**Installed (frontend)**
- `jspdf` `^4.2.1` — client-side PDF generation
- `jspdf-autotable` `^5.0.8` — table plugin for jsPDF
- `docx` `^9.7.1` — Word document generation (OOXML)

**`frontend/src/components/reports/ReportExportPanel.tsx`** — rewritten

*Format options:*
| Format | Before | After |
|---|---|---|
| PDF | Downloaded `.json` | Downloads a real **`.pdf`** |
| Word (DOCX) | Not available | Downloads a real **`.docx`** |
| Google Doc | Attempted Google Docs | Unchanged; falls back to DOCX if not configured |

*Report content — tailored per type:*

| Report Type | Content |
|---|---|
| **Sprint Summary** | Blue header band; meta block (project, sprint, date range, generator); stats row (Total / Done / In Progress / In Review / Todo / Blocked); task table (WBS, title, status, priority, assignee, progress %, due date, estimated hours) |
| **Task Status Report** | Same as Sprint Summary — stats + full task table |
| **Team Performance** | Per-member summary table (total, completed, in-progress, in-review, remaining) followed by detail table sorted by assignee |
| **Dependency Report** | Task list with WBS, dates, and status; note directing users to the Link icon on task cards for managing dependency links |
| **Custom Report** | Complete task table with all available fields |

*Technical details:*
- All generation is **client-side** via dynamic `import()` — no SSR issues in Next.js `'use client'` components
- PDF: landscape A4, branded header band (`#1E40AF`), alternating row shading, status column coloured per status, page footer with page numbers
- DOCX: US Letter, Calibri font, `#1E40AF` heading colour, branded page header with page numbers, alternating row shading in tables
- `handleDownload` on history rows re-fetches task data and regenerates in the report's original format

**`frontend/src/app/reports/page.tsx`**
- Passes `projectName={projects.find(p => p.id === selectedProject)?.name}` to `<ReportExportPanel>` so the project name appears in generated files

---

### Fix 5 — PDF Reports: Actual Task Data Now Renders in Tables

**Root cause:** `jspdf-autotable` 5.0.8 ships an ESM `.mjs` build. When Next.js resolves the dynamic `import('jspdf-autotable')` in the browser, it imports the ESM module whose `default` export is the `autoTable` function — but in the browser ESM context this function silently no-ops when called with a freshly-created `jsPDF` instance (the instance hasn't been augmented by the plugin side-effect). Confirmed via Node.js testing: the functional `autoTable(doc, opts)` call works fine in CJS, but in Next.js browser ESM it produces an unaugmented doc with no table content. File sizes of 5.8–7.2 KB (header/meta only) vs. expected 15–30 KB (with data rows) confirmed the issue.

**Fix — `frontend/src/components/reports/ReportExportPanel.tsx`**
- Removed all `jspdf-autotable` imports and usage
- Added two new pure-function helpers:
  - **`truncateText(doc, text, maxW)`** — fits cell text to column width with ellipsis
  - **`drawPdfTable(doc, opts)`** — draws tables using only native jsPDF primitives:
    - `doc.setFillColor` + `doc.rect('F')` for header row (blue `#1E40AF`) and alternating row fills (`#F5F7FF`)
    - `doc.text` for all cell content with per-column width truncation
    - `doc.line` for row separator lines
    - Automatic page break detection: when `y + rowH > pageH - margin - 5`, adds new page and redraws header
- Changed jsPDF import from `(await import('jspdf')).default` to `const { jsPDF } = await import('jspdf')` (named export — more reliable across CJS/ESM contexts)
- Removed now-unused `STATUS_HEX` constant

**All 5 report types now produce PDFs with full table data:**

| Report Type | Table Content |
|---|---|
| Sprint Summary / Task Status / Custom | Stats row (Total/Done/In Progress/…) + 9-column task table with WBS, title, status, priority, assignee, progress, due date, hours |
| Team Performance | Per-member summary table (6 cols) + task detail table sorted by assignee (7 cols) |
| Dependency Report | 8-column task list with WBS, start/due dates, and status for dependency review |

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
