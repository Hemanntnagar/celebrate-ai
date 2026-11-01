# Celebrate AI

Event planning workspace for weddings, birthdays, anniversaries, festivals, and community gatherings. Authenticated teams can plan with OpenAI, manage budgets, tasks, vendors, guests, and invitations.

## Setup

1. Copy `.env.example` to `.env.local` and add Supabase plus `OPENAI_API_KEY`.
2. Apply `supabase/migrations/0001_celebrate_ai.sql` and `0002_public_rsvp.sql` in the Supabase SQL editor.
3. Enable email confirmation in Supabase Auth.
4. Install and run:

```bash
pnpm install
pnpm test
pnpm dev
```

## Deploy

Vercel is the intended host. Set the same environment variables, apply migrations before first login, and keep `CRON_SECRET` on `/api/cron/reminders`. Optional: `RESEND_API_KEY` for invitation email, `SUPABASE_SERVICE_ROLE_KEY` for reminder jobs.

## Roles

Owner, planner, coordinator, and viewer. Owners manage membership. Planners can approve AI plans and budgets. Coordinators handle tasks, vendors, and guests. Viewers are read-only.
