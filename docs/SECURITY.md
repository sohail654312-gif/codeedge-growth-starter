# Security and privacy boundaries

Status: controlled preview; **NOT approved for production patient or confidential customer information**.

- AppDeploy authentication middleware protects all non-healthcheck backend endpoints. User data is partitioned by the verified AppDeploy user ID, but proper workspace/agency tenancy is **not implemented**.
- Demo profiles and performance charts are illustrative; Google Analytics, GBP and actual growth tracking are not yet connected.
- Photos may be sensitive. Do not upload patient images, medical documents or nonconsensual media to the preview.
- Image endpoint currently restricts type and nominal size but has not passed independent binary-signature, malware or data-retention tests.
- Database reads are bounded. Comprehensive pagination, deletion, export, quotas and operator actions are incomplete.
- Missing production gates include admin role isolation, abuse prevention, legal documents, audit logs, formal cross-tenant tests and secure integration credential lifecycle.
- Business OS, CIGO and third-party integrations are inactive. Future adapters must enforce tenant-scope and explicit human approval of consequential effects.
- This repository was observed **public** on 2026-10-08, notwithstanding an earlier private recommendation. Only source without credentials is mirrored.
