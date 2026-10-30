# Agency and client workflow — source candidate

Current source status is described in [the release candidate handoff](RELEASE-CANDIDATE.md). Hosted and production acceptance remain blocked.

1. An approved existing identity follows the PKCE email flow. The separately accepted exact-session authority is mandatory.
2. The private application discovers authorized workspaces, or creates the authenticated owner's workspace through a fixed-purpose operation. Discovery currently stops at 25.
3. The user saves a business profile and creates a work request. Transactions bind the current session, workspace and role to the change.
4. Owner/agency admin can assign authorized staff and a due date. The present UI requires the member ID.
5. Owner/agency/staff can progress Requested → In progress → Awaiting approval. Owner/client can approve the reviewed version or request corrections. Approved work can move to Completed.
6. Authorized users inspect request details; owner/admin can view activity. Reports count the loaded page and do not claim workspace-wide growth metrics.
7. Owner access revocation and media-deletion queueing exist. Live provider invitations and uploads remain disabled pending accepted identity/storage contracts.
8. Growth tools use fictional examples or user-supplied offline extracts. No connected Google analytics, publishing, payment or distributed automation is activated.

Synthetic browser/database journeys validate source behavior. They do not certify live provider revocation, real email delivery, hosted cross-tenant isolation or storage erasure. The older AppDeploy preview has separate enquiry and upload behavior and is not the newer private runtime.
