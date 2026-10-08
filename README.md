# Codeedge Growth Starter

Standalone, mobile-first Codeedge growth portal for clinics and small local businesses.

**Current status:** Phase 1 preview deployed; not production accepted.

**Live app:** https://codeedge-growth-starter-5jhvfk.v2.appdeploy.ai/

## Implemented in Phase 1
- Read-only sample clinic workspace with clearly illustrative data
- AppDeploy sign-in, owner-scoped business profile, enquiries and status
- Content requests, private image uploads and signed image URLs
- Website / local SEO / AEO roadmap without fabricated live metrics
- Mobile-friendly Codeedge dashboard

## Not yet included
Team and agency roles, production Business OS/CIGO integration, real Google metrics, AI publishing, direct WhatsApp workflows, video storage, payments, patient records, and production audit/acceptance.

## Development
React + TypeScript + Vite frontend, with AppDeploy SDK routes, database and storage.
This repository mirrors the currently deployed AppDeploy source snapshot. GitHub pushes do not automatically redeploy AppDeploy. The `@appdeploy/client` and `@appdeploy/sdk` imports are runtime-provided; the standard local Vite build is not yet portable without equivalent SDK support.

Run `node --test tests/source-contract.test.mjs` for **static source-guard tests only**. This does not replace backend, tenant-isolation or live end-to-end testing.

See [implementation gates](docs/IMPLEMENTATION.md) and [security boundaries](docs/SECURITY.md).

Other Codeedge repositories are read-only reference; changes here must not modify Business OS, CIGO or MVP.

Do not commit API credentials, real clinic/patient content, production datasets or uploaded photos. Consider changing this repository from public to private in GitHub Settings.
