# Security notes

- Dashboard routes are session-gated in `proxy.ts`. Public surfaces are auth, email confirmation, and `/invite/[token]`.
- API mutations check event membership and role before writing.
- PostgreSQL RLS is enabled on application tables. Public RSVP uses token-scoped security-definer functions, not open table reads.
- Cron and reminder jobs require `Authorization: Bearer $CRON_SECRET` and a service-role client.
- Invitation email is sent only when `RESEND_API_KEY` is present. Tokens are random and single-purpose.
- Do not commit `.env.local` or service-role keys. Rotate `CRON_SECRET` and OpenAI keys if they leak.
- Payments never exceed remaining expense amounts. Vendor quotes stay labeled user-entered unless verified.
