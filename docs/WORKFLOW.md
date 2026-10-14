# Minimal Codeedge agency + client journey

**Current delivery stage: transition core only.** UX and trust provisioning remain incomplete.

1. **Codeedge agency** initiates an onboarding request; verified authorization and workspace creation must occur server-side after independent security acceptance.
2. **Invitation** is emailed or shared securely to a verified recipient with limited validity, atomic claim, one-time use and revocation. NOT ENABLED in this branch.
3. **Client** signs in and sees only their assigned workspace; supplies approved business name, goals, public website and contact/enquiry metadata. Avoid clinical/medical details.
4. **Media uploads** currently accept PNG/JPEG/WebP through small JSON/base64 with backend signature checks (≤3 MiB). Larger photos/videos require signed multipart upload design and a content-scan/consent lifecycle.
5. **Agency staff** can move a request from Requested → In progress → Awaiting approval; the appropriate client or owner may choose Approved or Changes requested; an Approved request can move to Completed. Tested in mock API, **not wired into separate agency/client UI**.
6. **Published results** must only be displayed after a provider adapter delivers trusted publication evidence. There is no Published state writable by this branch.
7. **Enquiry totals** must come from persisted workspace records; external marketing/revenue figures remain unconnected and must not be implied as real.

## UX intent
- Client: Website, Social Media, SEO/AEO, Enquiries, Requests, Media, Progress; few fields per screen.
- Codeedge agency: client switcher with explicit role, assigned work queue, media review, evidence, approvals and audit events.
- Default to accessible and mobile-first; keep the existing navy-white theme. No Business OS feature overload.
- All state-changing operations must surface loading/errors and maintain strict empty/demo labeling.
