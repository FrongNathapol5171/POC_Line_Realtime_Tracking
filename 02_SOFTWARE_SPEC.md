# Software Specification — Hospital Patient Journey Tracker

**Audience:** AI coding agent
**Stack:** Next.js (App Router, TypeScript) · Google Sheets backend · LINE Messaging API
**Status:** POC

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js App (Vercel/Node)              │
│                                                            │
│  UI (App Router pages)          API Routes (route.ts)      │
│  /register   (Page 1)  ───────► /api/patients              │
│  /nurse      (Page 2)  ───────► /api/patients/[hn]/advance │
│  /clinics    (Page 3)  ───────► /api/clinics               │
│  /dashboard  (Page 4)  ───────► /api/dashboard             │
│                                 /api/line/webhook          │
│                                 /api/help/resolve          │
│                                                            │
│            data-layer (lib/sheets.ts)  ── isolated         │
└───────────────┬───────────────────────────┬───────────────┘
                │                            │
                ▼                            ▼
        Google Sheets API            LINE Messaging API
        (datastore)                  (push + webhook + Flex)
```

Design rule: **all data access goes through `lib/sheets.ts`** (repository pattern) so the backend can later be swapped for a real DB without touching UI or API logic.

---

## 2. Tech Choices

| Concern | Choice |
|---|---|
| Framework | Next.js 14+ App Router, TypeScript |
| Styling | Tailwind CSS, minimal/clean, mobile-first |
| Data store | Google Sheets via `googleapis` (service account) |
| Messaging | LINE Messaging API (`@line/bot-sdk`) |
| QR | `qrcode` npm package (server-side data URL) |
| State (client) | React state / SWR for fetching |
| IDs/tokens | `crypto.randomUUID()` for one-time binding tokens |

Environment variables (`.env.local`):
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_OA_BASIC_ID=          # e.g. @123abcde for deep link
APP_BASE_URL=              # public URL for QR target if using a redirect page
ADMIN_ACCESS_CODE=         # simple gate for nurse/clinic/dashboard (POC)
```

---

## 3. Data Model (Google Sheets)

One spreadsheet, multiple tabs. Each tab = a table; row 1 = headers.

### Tab: `Patients`
| Column | Type | Notes |
|---|---|---|
| hn | string | Hospital Number (key) |
| lineUserId | string | filled after binding (nullable) |
| bindToken | string | one-time token in QR/message |
| bindTokenUsed | boolean | TRUE after binding |
| sequenceJson | string(JSON) | ordered array of clinicIds incl. BILLING |
| currentIndex | number | pointer into sequence (0-based) |
| status | enum | REGISTERED, BOUND, IN_PROGRESS, COMPLETED |
| needHelp | boolean | TRUE if patient tapped help |
| createdAt | ISO string | |
| updatedAt | ISO string | |

### Tab: `Clinics`
| Column | Type | Notes |
|---|---|---|
| clinicId | string | key (e.g., `clinic_a`) |
| name | string | display name |
| detail | string | e.g., "อยู่ชั้น 3 บริเวณโซน A" |
| displayOrder | number | optional default ordering |
| active | boolean | |

> `BILLING` is a reserved clinicId always appended last (seed it in Clinics with name "ชำระเงิน / Cashier").

### Tab: `Events`
| Column | Type | Notes |
|---|---|---|
| eventId | string | uuid |
| hn | string | |
| clinicId | string | which step |
| type | enum | REGISTERED, BOUND, ARRIVED, COMPLETED, HELP_REQUESTED, HELP_RESOLVED |
| timestamp | ISO string | used for dwell-time analytics |

### Tab: `HelpRequests`
| Column | Type | Notes |
|---|---|---|
| helpId | string | uuid |
| hn | string | |
| clinicId | string | current step when requested |
| status | enum | OPEN, RESOLVED |
| createdAt | ISO | |
| resolvedAt | ISO | |

---

## 4. API Endpoints

### `POST /api/patients` — Register + QR
Request:
```json
{ "hn": "HN0001", "clinicIds": ["clinic_a","clinic_b"] }
```
Logic:
1. Validate HN non-empty; clinicIds exist & active.
2. Append `BILLING` to the sequence (final, mandatory).
3. Generate `bindToken = uuid`.
4. Write Patients row (status=REGISTERED, currentIndex=0).
5. Build LINE deep link (see §6) embedding `bindToken`.
6. Generate QR data URL of that link.
Response:
```json
{ "hn":"HN0001", "qrDataUrl":"data:image/png;base64,...", "deepLink":"https://line.me/R/oaMessage/@oa/?..." }
```

### `POST /api/line/webhook` — LINE events
Handle two event kinds:
- **message** (text): extract `bindToken` (and/or HN) from text → find patient → if token valid & unused → set lineUserId, status=BOUND, bindTokenUsed=TRUE → log BOUND event → push Flex roadmap #1. Else fallback text.
- **postback** (data `action=help`): mark patient needHelp=TRUE, create HelpRequest(OPEN), log HELP_REQUESTED, reply ack text.

Must: verify LINE signature; respond 200 fast; be idempotent.

### `POST /api/patients/[hn]/advance` — Nurse marks complete
Request: `{ "clinicId": "clinic_a" }` (the clinic confirming completion)
Logic:
1. Load patient. Confirm `sequence[currentIndex] === clinicId` (guard out-of-order).
2. Log COMPLETED event for that clinic.
3. `currentIndex++`.
4. If `currentIndex >= sequence.length` → status=COMPLETED, push completion Flex.
   Else status=IN_PROGRESS, push updated roadmap Flex (current clinic done, next active).
5. Update updatedAt.

### `GET /api/patients?clinicId=clinic_a` — Nurse queue
Returns patients whose **current** step == clinicId (status not COMPLETED), with hn, status, needHelp.

### `GET/POST/PUT/DELETE /api/clinics` — Clinic master CRUD

### `GET /api/dashboard` — Aggregates
Returns: counts per status, per current clinic, open help requests, and series for the graphs in §7.

### `POST /api/help/resolve` — `{ "helpId": "..." }` → set RESOLVED, clear patient.needHelp.

---

## 5. Pages (UI)

### Page 1 `/register`
- HN text input.
- Clinic checkbox list (from `/api/clinics`).
- Reorderable selected list (numbered or drag); show Billing pinned at bottom (locked).
- "Generate QR" → calls `/api/patients` → shows QR + the resulting sequence.
- Print/large QR view for patient scanning.

### Page 2 `/nurse`
- Clinic selector (dropdown) or station preset.
- Table/list of HN at this clinic + status + needHelp badge.
- "Mark Complete" per row → `/api/patients/[hn]/advance`.
- Auto-refresh (SWR poll ~10s).

### Page 3 `/clinics`
- Table of clinics with inline add/edit/delete.
- Fields: name, detail (location text), active.
- Billing row read-only.

### Page 4 `/dashboard`
- KPI cards: active patients, completed today, open help requests.
- Graphs from §7.
- Need-help live list with "Resolve" button.

All non-patient pages gated by `ADMIN_ACCESS_CODE` (simple POC gate).

---

## 6. LINE Deep Link & Binding

**QR target (auto-place message):** use the LINE OA message deep link so scanning opens the chat with a prefilled message:
```
https://line.me/R/oaMessage/<LINE_OA_BASIC_ID>/?<URL-encoded message text>
```
Prefilled message text (encoded):
```
ลงทะเบียนผู้ป่วย HN: HN0001 | TOKEN: <bindToken>
```
> The patient just taps Send. The webhook then receives this text + their LINE userId, enabling HN ↔ userId mapping.

Fallback: if `oaMessage` prefill is unreliable on some clients, host a tiny redirect page at `APP_BASE_URL/b/<token>` that 302-redirects to the deep link.

---

## 7. Flex Message Spec (dynamic roadmap)

Build the bubble dynamically from `sequence` + clinic master. Each step row:
- icon: ✅ done · 🟦 current · ⬜ pending
- clinic name (bold)
- detail line (e.g., "อยู่ชั้น 3 บริเวณโซน A") in gray, smaller

Footer button: **"ต้องการความช่วยเหลือ / Need help"** → postback `action=help`.

Reference structure (pseudo-JSON the agent should generate programmatically):
```json
{
  "type": "flex",
  "altText": "สถานะการรักษา HN0001",
  "contents": {
    "type": "bubble",
    "header": { "type":"box","layout":"vertical","contents":[
      {"type":"text","text":"เส้นทางการรักษา","weight":"bold","size":"lg"},
      {"type":"text","text":"HN: HN0001","size":"sm","color":"#888888"}
    ]},
    "body": { "type":"box","layout":"vertical","spacing":"md","contents":[
      /* one box per step, generated in sequence order */
      {"type":"box","layout":"horizontal","contents":[
        {"type":"text","text":"✅","flex":0},
        {"type":"box","layout":"vertical","contents":[
          {"type":"text","text":"คลินิก A","weight":"bold"},
          {"type":"text","text":"อยู่ชั้น 3 บริเวณโซน A","size":"xs","color":"#888888"}
        ]}
      ]}
    ]},
    "footer": { "type":"box","layout":"vertical","contents":[
      {"type":"button","style":"primary","action":{
        "type":"postback","label":"ต้องการความช่วยเหลือ","data":"action=help"
      }}
    ]}
  }
}
```

Message trigger matrix:
| Event | Message |
|---|---|
| Binding success | Full roadmap, currentIndex=0 marked current |
| Clinic completed | Roadmap with that step ✅, next step current |
| Billing completed | Roadmap all ✅ |
| Journey end | Completion bubble ("เสร็จสิ้นทุกขั้นตอน") |

---

## 8. Suggested Dashboard Graphs (implement with a chart lib, e.g., Recharts)

1. **Funnel** — counts at each stage.
2. **Avg dwell time per clinic** — from Events (ARRIVED/COMPLETED deltas).
3. **Throughput line** — completions per hour today.
4. **Help requests by clinic** — bar.
5. **Active vs completed** — donut.
6. **Journey time distribution** — histogram.

---

## 9. Suggested Project Structure
```
app/
  register/page.tsx
  nurse/page.tsx
  clinics/page.tsx
  dashboard/page.tsx
  api/
    patients/route.ts
    patients/[hn]/advance/route.ts
    clinics/route.ts
    dashboard/route.ts
    line/webhook/route.ts
    help/resolve/route.ts
lib/
  sheets.ts        # all Google Sheets I/O (repository)
  line.ts          # LINE client + flex builders
  flex.ts          # buildRoadmapFlex(sequence, clinics, currentIndex)
  qr.ts            # deep link + QR generation
  types.ts
components/
  ClinicPicker.tsx
  SequenceList.tsx
  NurseQueue.tsx
  KpiCards.tsx
  Charts/*.tsx
```

---

## 10. Build Order (for the coding agent)
1. Scaffold Next.js + Tailwind + TypeScript.
2. `lib/sheets.ts` with Patients/Clinics/Events/HelpRequests accessors + seed Billing clinic.
3. Clinic master CRUD + `/clinics` page.
4. Registration `/register` + `/api/patients` + QR + deep link.
5. `lib/flex.ts` roadmap builder + `lib/line.ts` push.
6. `/api/line/webhook` (binding + help postback).
7. Nurse `/nurse` + advance endpoint + push updates.
8. Dashboard `/dashboard` + `/api/dashboard` + charts.
9. Edge cases & idempotency pass.

---

## 11. Acceptance Criteria
- Registering an HN with ≥1 clinic produces a scannable QR; Billing auto-appended last.
- Scanning QR opens LINE OA with prefilled binding message; sending it binds userId↔HN and delivers roadmap Flex.
- Nurse marking a clinic complete advances the patient and pushes an updated roadmap with that step ✅.
- Completing Billing produces the completion message.
- "Need help" from Flex appears on the dashboard and can be resolved.
- All data persists in Google Sheets; data layer is isolated in `lib/sheets.ts`.
