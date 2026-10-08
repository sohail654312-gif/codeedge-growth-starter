# Open-source design study

Reference architectures were inspected read-only; none were copied into Growth Starter.

| Project | Pattern investigated | Adoption decision |
| --- | --- | --- |
| [Payload multi-tenant plugin](https://github.com/payloadcms/payload/tree/main/packages/plugin-multi-tenant) | tenant-scoped collection access and tenant membership | adopt the *principle* of strict tenant selection and server-enforced membership; no plugin import |
| [Twenty CRM](https://github.com/twentyhq/twenty) | admin/scoped configuration and CRM workspace concepts | preserve straightforward enquiry records; avoid complex CRM UX |
| [Cal.com](https://github.com/calcom/cal.com) | distinct appointments / booking domain | defer booking until source-of-truth or verified provider adapter |
| [Directus](https://github.com/directus/directus) | service-layer permissions and content management | isolate domain policy and adapters; do not copy code or grant broad admin permissions |

## Security references
OWASP API Security Top 10 (object-level authorization) and OWASP File Upload Cheat Sheet are primary checks for future acceptance. Source and dependency licenses must be reviewed before using any third-party code; our implementation here is original.
