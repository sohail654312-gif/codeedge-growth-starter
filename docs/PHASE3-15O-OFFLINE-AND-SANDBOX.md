# Offline growth tools and sandbox automation

## Content tools

The existing premium engine still generates clusters, intent classifications, page
briefs and evidence-aware recommendations. `offline-content-toolkit.mjs` composes it
once and adds LocalBusiness JSON-LD drafts, a strict supported-subset validator,
safe JSON-LD serialization, UTC calendar proposals, prioritized review tasks and
bounded three-word-shingle duplicate analysis. All content stays within the declared
workspace and HTTPS site origin. Input facts remain supplied, not independently
verified. FAQPage drafts require explicit same-workspace accuracy and visibility
confirmations. Generated answer drafts are never automatically promoted to FAQ facts.

No ratings, practitioner qualifications, live rankings, appointments, citations or
ROI are invented. Calendar dates are proposals and no provider schedules them.
Similarity describes supplied extracts only, with a maximum of 30 pages, 12,000
characters per extract and the first 1,000 words per page. The UI displays these
limits and lets an operator export draft files locally. No publication is enabled.

The validator intentionally supports a narrow subset rather than all of Schema.org.
See official [LocalBusiness](https://schema.org/LocalBusiness) and
[FAQPage](https://schema.org/FAQPage) definitions. Rich-result eligibility, the truth
of supplied facts and live page markup are separate, unverified questions.

## Sandbox automation

`sandbox-automation.mjs` implements domain service -> action contract -> sandbox
adapter. Supported triggers are manual, request review, content readiness and report
import. Conditions are bounded equality/list checks of status, kind and evidence.
Action contracts simulate Search Console inspection, Business Profile review, social
publishing, notifications and future Codeedge tasks. They accept bounded labels,
never URLs, tokens or arbitrary provider payloads. All supplied adapters report
`connected:false`; there is no real provider connection, scheduler or live mode.

A transactional authorizer is mandatory. The PostgreSQL operations service exposes
the compatible source method, but its hosted wiring is still disabled. Only current
owners/agency administrators can run simulations; only an owner can approve or
recover them. Social/notification simulations always require approval, even when
the definition tries to disable it. Approval binds the definition, trigger, workspace
and idempotency key and expires after an hour. Authorization is checked before
replay/log reads and before each action. Failures/outages deny access.

Action deadlines are 50–2,000 ms, at most two retries and 1–4 active runs **per engine
instance**. The default is 500 ms, one retry and two runs. Persistent claims prevent
the same key from executing simultaneously across store instances. Distinct keys
across multiple processes need a shared worker coordinator before hosted use; no
distributed concurrency claim is made. Adapter code is a trusted composition
boundary: a flag cannot sandbox malicious arbitrary JavaScript. Only the supplied
no-network adapters have been exercised.

`persistent-sandbox-store.mjs` uses an exclusive local lock and fsync/rename for
isolated development records. It caps storage at 1 MiB and 1,000 runs/approvals each.
Errors and adapter return payloads are not persisted; logs retain fixed action,
attempt and status fields. A failed store callback rolls back. A crash leaving the
exclusive lock stops later writes; an operator must verify the process is gone before
removing that lock. It does not steal locks. Local filesystem access controls are
not hosted tenant isolation and this store is not accepted for production data.

Completed keys replay without another execution. Failed runs require explicit owner
recovery; interrupted running runs cannot recover until their bounded execution
window has expired. Each key permits at most three executions. Retrying all actions
is safe only in this sandbox; future external adapters require per-action durable
idempotency and independently accepted recovery semantics.

## UI and QA boundaries

WorkProgress filters/sorts only loaded requests and renders eight at a time. It shows
loaded counts, bounds search input, denies correction controls for agency/unknown
roles and catches failed correction promises. Corrections in the existing SDK UI
remain separate tracked requests; the new transactional correction API records notes
and changes the versioned original atomically when work is awaiting approval.

The isolated browser harness uses fictional fixtures on loopback and is not the
hosted AppDeploy application. Chromium mobile/desktop tests exercise search, paging,
status filters, failure visibility, role controls and new content tabs, with axe WCAG
checks. Browser fixtures do not establish hosted identity or provider acceptance.
