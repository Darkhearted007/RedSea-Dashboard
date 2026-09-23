# RedSea Ledger Security Policy

## Security baseline

RedSea Ledger treats external AIS feeds, customer requests, webhooks, browser input, and third-party APIs as untrusted.

Required controls:

- Secrets must remain server-side. No `VITE_` or `NEXT_PUBLIC_` variable may contain a secret credential.
- AISStream credentials are used only by the server-side bridge/proxy.
- Customer API keys are high-entropy, stored hashed, revocable, and never returned after creation.
- Public ingestion endpoints require authenticated HMAC signatures with timestamps and replay protection.
- Database queries use parameterized SQL; untrusted identifiers are never interpolated into SQL values.
- Customer-facing routes must enforce authentication and organization scoping.
- Scheduler-only intelligence jobs must remain unreachable over external HTTP.
- Public endpoints must expose only intentionally public data and must not disclose operational secrets.
- External URLs must be fixed/allowlisted; user-controlled URLs must not be fetched server-side without explicit SSRF controls.

## Responsible disclosure

Do not open a public GitHub issue for a security vulnerability. Report privately to the repository owner with the affected route/file, impact, and reproduction details.

## Pre-production security gate

Before merging security changes:

1. Run typecheck/build.
2. Run dependency and secret scanning.
3. Exercise every API route with anonymous, authenticated-member, and admin access where applicable.
4. Verify scheduler routes return 404 to external callers.
5. Verify webhook signatures reject missing, stale, modified, and replayed requests.
6. Verify no browser bundle contains AISStream, database, service-role, Stripe, FlowPay, or other private credentials.
7. Review logs for unexpected 4xx/5xx spikes.

Never treat a successful build as proof of security; pair automated checks with manual code review and targeted DAST.
