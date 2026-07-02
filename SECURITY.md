# Security Policy

## Supported Versions

Only the current production release receives security updates.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in RedSea Ledger, please report it responsibly:

1. Email your findings to the repository owner (see GitHub profile for contact)
2. Include a description of the vulnerability, steps to reproduce, and potential impact
3. Allow up to 72 hours for an initial response
4. Do not disclose the vulnerability publicly until a fix has been released

We will acknowledge receipt, investigate promptly, and notify you when a fix is available. We appreciate responsible disclosure and will credit researchers where appropriate.

## Scope

In scope:
- API server authentication and authorisation bypass
- SQL injection or database access issues
- Sensitive data exposure (vessel data, user data, API keys)
- AIS stream proxy security issues

Out of scope:
- Issues requiring physical access to the server
- Social engineering attacks
- Rate limiting on public endpoints without demonstrated impact
- MetaMask browser extension errors (these are from the browser, not our code)

## Security Design Notes

- API keys (`VITE_AISSTREAM_API_KEY`, `SESSION_SECRET`) are stored in environment secrets, never in source code
- The AIS stream API key is proxied server-side — the client never receives it
- All database writes go through the API server; no direct database access from client code
- The proprietary threat-scoring algorithms run server-side only
