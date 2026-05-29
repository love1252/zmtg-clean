# Institution Business Shell Phase 1 Design

## Goal

Build the first institution-side business module shell inside `/hospital` so the clean project moves beyond a static dashboard and becomes a navigable demo workspace for customers, appointments, and follow-up operations.

This phase is intentionally a frontend/domain boundary phase. It does not add real database models, real customer records, production authentication, formal RBAC, API routes, external integrations, AI calls, or persistent storage.

## Current State

The current `/hospital` page renders `InstitutionWorkspace` behind `DemoSessionGate`. It shows a polished institution dashboard, side navigation, mobile navigation, stats, AI suggestions, action queue, and journey lanes.

The navigation items are static buttons. They do not switch the main content. Demo data lives in `src/modules/workspace/domain/institution-dashboard.ts`, and the component owns most layout decisions.

## Scope

Add three institution business shells:

- Customer Center
- Appointment Center
- Smart Follow-up

Each shell should use static, typed domain data and render inside the existing `/hospital` workspace. The existing dashboard remains the default view.

The phase should also establish a clean pattern for future institution modules:

- Domain data stays in focused files under `src/modules/institution/domain/`.
- Feature panels live under `src/modules/institution/components/`.
- The workspace component owns navigation state and shared shell layout.
- Tests cover navigation, visible module content, and domain constraints.

## Non-Goals

Do not implement:

- PostgreSQL, Drizzle schema, migrations, or seed scripts.
- Real tenant lookup, tenant switching, or cross-tenant data access.
- Customer CRUD APIs.
- Appointment write flows.
- Follow-up execution engine.
- WeCom, SMS, webhook, OAuth, or API Key behavior.
- LocalStorage business persistence.
- AI provider calls or RAG retrieval.

## UX Design

The `/hospital` page should behave like a real operations console:

- Desktop sidebar navigation can switch between dashboard, customer center, appointment center, and smart follow-up.
- Mobile horizontal navigation exposes the same views.
- The active nav item is visually distinct.
- The top dashboard hero remains only on the dashboard view.
- Business module views use dense operational layouts rather than landing-page hero sections.

Customer Center should show:

- Segment summary cards.
- A searchable-looking customer list shell.
- Customer priority, lifecycle stage, next action, and owner.
- A right-side insight panel for tags, risk, and AI next-best-action copy.

Appointment Center should show:

- Today's appointment pipeline.
- Status groups such as pending confirmation, confirmed, arrived, and rescheduled.
- Appointment cards with customer, project, consultant, and time.
- Operational alerts for no-show risk and schedule conflicts.

Smart Follow-up should show:

- Follow-up journey overview.
- Task queue by customer stage.
- Follow-up templates or message suggestions.
- Risk reminders that clearly state they are demo guidance only.

## Architecture

Introduce an `institution` module for institution business shells:

```text
src/modules/institution/
  components/
    AppointmentCenterShell.tsx
    CustomerCenterShell.tsx
    SmartFollowUpShell.tsx
  domain/
    appointments.ts
    customers.ts
    followups.ts
  tests/
    InstitutionBusinessShells.test.tsx
    InstitutionBusinessDomain.test.ts
```

Update workspace files:

```text
src/modules/workspace/domain/institution-dashboard.ts
src/modules/workspace/components/InstitutionWorkspace.tsx
src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

`InstitutionWorkspace` should hold a small `activeView` state with a union type derived from nav item IDs. Navigation buttons update that state. The dashboard content should be extracted into an internal `DashboardView` function inside the same file unless the file becomes too large during implementation. If it grows beyond easy review, split the dashboard to `src/modules/workspace/components/InstitutionDashboardView.tsx`.

## Data Model Boundary

All demo business records must be typed and static:

- `CustomerSummary`
- `CustomerSegment`
- `AppointmentSummary`
- `AppointmentPipelineGroup`
- `FollowUpJourneySummary`
- `FollowUpTask`

Demo objects may include customer names, but they must be fictional and must not resemble real PII. Do not add phone numbers, ID numbers, medical record numbers, or real clinic identifiers.

## Security Boundary

This phase continues to rely on `DemoSessionGate` for role-level demo access. It must not create a real authorization model.

The UI copy should avoid implying that real API Keys, OAuth, Webhooks, customer records, or AI decisions are active. Any AI wording should be framed as demo suggestions.

## Testing

Add tests for:

- Institution nav items have stable IDs and exactly one default active dashboard item.
- Customer demo records include owner, lifecycle, priority, and next action.
- Appointment groups cover the expected status labels.
- Follow-up tasks include stage, due label, and suggested action.
- `/hospital` renders dashboard by default.
- Clicking Customer Center shows customer shell content.
- Clicking Appointment Center shows appointment shell content.
- Clicking Smart Follow-up shows follow-up shell content.

Existing login/session tests should keep passing.

## Verification

Run:

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

Browser verification:

- Open `http://localhost:5010/login`.
- Log in with `admin / admin123`.
- Confirm redirect to `/hospital`.
- Click Customer Center, Appointment Center, and Smart Follow-up on desktop.
- Check mobile width around `390px` for horizontal overflow and readable cards.

## Risks

- The workspace component may become too large. If that happens, split dashboard and view switching into smaller components during implementation.
- Static demo data can accidentally look like production data. Keep it obviously demo-oriented and avoid sensitive identifiers.
- Navigation state is client-side only. That is acceptable for this phase; URL-level routes can come later if the product direction needs deep linking.

## Open Decision

This design chooses client-side in-page view switching for speed and demo continuity. A later phase can promote these shells to separate routes such as `/hospital/customers`, `/hospital/appointments`, and `/hospital/followups` after real data and permission boundaries are designed.
