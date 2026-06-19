# Requirement Specification — Hospital Patient Journey Tracker (LINE OA)

**Document type:** Business + Functional Requirement Spec (BRD/FRD)
**Audience:** AI coding agent + stakeholders
**Status:** POC
**Version:** 1.0

---

## 1. Purpose

Build a web + backend system that tracks a patient's journey through hospital clinics and notifies the patient via **LINE Official Account (LINE OA) Flex Messages** at every checkpoint. The patient sees a visual roadmap (timeline) of clinics to visit; each time a clinic completes the patient, a fresh Flex Message updates the roadmap with that checkpoint marked done.

The system maps each patient's **HN (Hospital Number)** to their **LINE user ID** so the hospital can push the right message to the right person.

---

## 2. Scope (POC)

In scope:
- HN ↔ LINE userID mapping via QR-code deep link onboarding.
- Per-patient dynamic clinic sequence (timeline) defined at registration.
- LINE Flex Message roadmap that updates at every checkpoint.
- 4 web pages: Registration/QR, Nurse station, Clinic master config, Dashboard.
- Google Sheets as the datastore (POC only).
- Next.js full-stack app (frontend + API routes/backend).

Out of scope (POC):
- Integration with real HIS/EMR.
- Authentication/SSO (use a simple shared key or none for POC).
- Payment processing at cashier (status only).
- Multi-hospital / multi-tenant.

---

## 3. Actors

| Actor | Description |
|---|---|
| Customer Service (Registrar) | Registers patient, picks clinic sequence, generates QR. |
| Patient | Scans QR, lands in LINE OA, auto-sends a binding message, then receives roadmap updates. |
| Nurse / Clinic Staff | Sees queue of HN for their clinic, marks patient complete, triggers next message. |
| Admin | Configures clinic master data (name, floor/zone detail). |
| Monitor / Supervisor | Watches the dashboard, responds to "need help" requests. |

---

## 4. Core Business Flow (Journey)

```
Customer Service (Register + define sequence + QR)
        │
        ▼
Patient scans QR → opens LINE OA → auto-sends binding message
        │  (system maps LINE userID ↔ HN)
        ▼
Flex Message #1: full roadmap, all checkpoints pending
        │
        ▼
Clinic A  → nurse marks complete → Flex update (A = ✅)
        │
        ▼
Clinic B  → nurse marks complete → Flex update (A ✅, B ✅)
        │
        ▼
Billing / Cashier (always the final step) → Flex update (Billing ✅)
        │
        ▼
END → completion message
```

Rules:
- The journey **always starts** at registration (Customer Service).
- The journey **always ends** at Billing/Cashier (auto-appended as final step; not removable).
- A message is pushed **at every state transition**.
- Patient can tap **"Need help"** in any Flex Message → raises an alert on the Dashboard.

---

## 5. Functional Requirements

### FR-1 Registration & QR Generation (Web Page 1)
- FR-1.1 Input field for **HN code** (required, validated non-empty, trimmed).
- FR-1.2 Checkbox list of clinics (sourced from Clinic Master).
- FR-1.3 User can **order/sequence** selected clinics (drag-to-reorder or numbered).
- FR-1.4 **Billing/Cashier** is automatically appended as the last step and cannot be removed.
- FR-1.5 On submit: write patient record (HN + ordered clinic list + status=REGISTERED) to datastore.
- FR-1.6 Generate a **QR code** encoding a LINE deep link URL that, when scanned, opens the LINE OA and **auto-fills/auto-sends a binding message** containing a one-time token + HN reference.
- FR-1.7 Display QR on screen for the patient to scan.

### FR-2 LINE Binding (HN ↔ LINE userID)
- FR-2.1 When the patient sends the binding message, the LINE webhook receives it with the patient's **LINE userID**.
- FR-2.2 Backend parses the token/HN from the message, finds the matching patient record, and stores the **LINE userID** against that HN.
- FR-2.3 After successful binding, push **Flex Message #1** (full roadmap, all pending).
- FR-2.4 Handle edge cases: token expired/used, HN not found, already bound → send a fallback text message.

### FR-3 Nurse Station (Web Page 2)
- FR-3.1 Select a clinic (or auto-detect by logged-in station).
- FR-3.2 List all patients (HN) currently **at / waiting for** that clinic, with status.
- FR-3.3 Show HN for visual verification by staff.
- FR-3.4 "Mark Complete" button per patient → advances patient to next step.
- FR-3.5 On complete: update status, then **push an updated Flex roadmap** with that clinic checked ✅.
- FR-3.6 If the completed clinic was the last clinic before Billing, the next active step becomes Billing.

### FR-4 Clinic Master Config (Web Page 3)
- FR-4.1 CRUD for clinics: **name** + **detail** (location text, e.g., "อยู่ชั้น 3 บริเวณโซน A").
- FR-4.2 Detail text is shown inside the Flex Message for that clinic.
- FR-4.3 Optional: active/inactive flag, display order, icon/emoji.

### FR-5 Dashboard / Monitor (Web Page 4)
- FR-5.1 Live overview: number of patients per status, per clinic.
- FR-5.2 **Need-help queue**: list of patients who tapped "Need help", with HN, current clinic, timestamp.
- FR-5.3 Ability to mark a help request as **resolved**.
- FR-5.4 Suggested business graphs (see §7).

### FR-6 LINE Flex Messaging
- FR-6.1 Flex roadmap rendered dynamically from the patient's clinic sequence + master details.
- FR-6.2 Each checkpoint shows: clinic name, location detail, status icon (pending / current / done).
- FR-6.3 Includes a **"Need help"** action button (postback).
- FR-6.4 Sent at: binding, each clinic completion, billing completion, and final completion.

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Frontend must be **minimal, clean, easy to use** (large buttons, Thai/English labels). |
| NFR-2 | Mobile-first for the Nurse page (used on tablets/phones). |
| NFR-3 | Datastore = **Google Sheets** (POC); code must isolate the data layer so it can be swapped later. |
| NFR-4 | Stack = **Next.js** (App Router) for both UI and API routes. |
| NFR-5 | LINE push/webhook secrets in environment variables, never committed. |
| NFR-6 | Idempotent webhook handling (LINE may retry). |
| NFR-7 | Response time for nurse "Mark Complete" → message push under ~3s typical. |

---

## 7. Suggested Business Analytics (value-add)

The BA recommends the dashboard include:
1. **Funnel chart** — patients by stage (Registered → Clinic done → Billing → Completed) to show drop-off / where patients get stuck.
2. **Average dwell time per clinic** — time between "arrived at clinic" and "marked complete" (bottleneck detection).
3. **Throughput over time** — completions per hour (staffing insight).
4. **Need-help heatmap by clinic** — which clinics generate the most help requests.
5. **Active patients live count** — currently in-journey vs completed today.
6. **End-to-end journey time distribution** — total time per patient from register to billing.

---

## 8. Assumptions & Constraints

- POC: no real authentication; a simple access code may gate admin/nurse pages.
- One LINE OA, one hospital.
- HN is unique and provided/known by Customer Service.
- A patient has one active journey at a time.
- Google Sheets API quotas are acceptable for POC traffic.

## 9. Open Questions (confirm before build)

1. Should a patient be allowed multiple concurrent journeys (re-visits same day)?
2. Is Billing always literally last, or can there be a post-billing pharmacy step?
3. Do nurses log in per clinic, or is the clinic chosen via dropdown each session?
4. Preferred language priority in Flex Message (Thai primary, English secondary)?
