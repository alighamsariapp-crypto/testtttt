# Security Architecture & Rules

## 1. Zero-Trust Principles
- Never trust client-provided prices, subtotals, taxes, shipping costs, discounts, or stock levels.
- All financial calculations are executed on the server via `Money` value objects.

## 2. Secrets & Credential Redaction
- Automatic redaction via `RedactionHelper` for keys: `password`, `token`, `secret`, `api_key`, `card_number`, `cvv`, `authorization`, `cookie`.

## 3. Session Security
- `SESSION_DRIVER=database`
- `SESSION_SECURE_COOKIE=true`
- `HttpOnly=true`, `SameSite=lax`
- Session rotation upon login and privilege escalation.

## 4. Security Headers (Configurable)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HTTPS only)
- Safe, non-blocking Content-Security-Policy (CSP) configurable via `.env`.
