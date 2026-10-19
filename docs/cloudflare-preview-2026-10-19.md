# Cloudflare preview and mobile Pro form follow-up

## Confirmed Cloudflare failure

PR #16 commit `d105703` failed in Workers build `29da4992-d661-4bee-813e-d08d1cc25013`. Compilation and TypeScript completed, but prerendering `/login` failed because the Supabase public URL and public API key were missing. The PR-specific build trigger had no build variables. Its commands were `npm run build` and `npx wrangler preview`; the former previously generated only `.next`, not the configured `.open-next/worker.js` entry point.

The trigger is scoped exclusively to `codex/ai-regression-and-pro-requests`. Only its `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` build variables were added, using the same public project configuration already present in repository CI and the local configuration. No service-role key or private credential was copied. No production Worker configuration, migration, merge or production deployment was changed.

`npm run build` now targets the existing Cloudflare adapter. The adapter explicitly runs the separate `build:next` command internally, avoiding recursion and producing the Worker artifact. Webpack is selected for the inner build; the installed Next.js guide documents that supported option. `build:cloudflare` remains the adapter entry point.

## Mobile Pro form

The form now uses the existing shared `Modal`, which bounds the panel to the dynamic viewport, keeps the header separate from a scrollable content area, locks background scroll, traps focus and restores it on close. Long account text wraps. On narrow screens, actions stack and have a minimum 44px height.

Visual checks used the actual changed component in a temporary local preview route, removed before committing. At 320×568 and at 390×384, keyboard focus reached the note and both actions. The submit button stayed within the viewport, no horizontal overflow was observed, and closing the modal worked. No form was submitted and no e-mail was sent. These are browser viewport checks rather than physical-device keyboard tests.

## Supabase migration: read-only verification

Target inspected: project `jxujcjalxrgmjcecwkil`, database `postgres`.

- Repository workflows do not contain a migration application command (`supabase db push` or equivalent). The build path does not execute SQL files.
- The platform has a `main` branch record linked to Git `main`, with status `MIGRATIONS_FAILED`. This shows an integration record exists; it does not prove successful automatic migration on every GitHub push. The exact external event-trigger policy was not established from that record.
- Migration history does not contain `20261019165130_durable_ai_hourly_quota`.
- Read-only catalog checks found no `public.ai_hourly_quota(text,uuid)`, `private.ai_quota_policy`, or `private.ai_chat_credits`.

Therefore the new quota database structure is **not installed** in the inspected project. A file in GitHub is not evidence of application. The existing migration is prepared in this PR and has already passed disposable local PostgreSQL checks. Applying it to a selected target remains a separate action requiring approval; it was not applied here. The new AI quota API intentionally fails closed until its required migration is available.

## Local verification

- Typecheck passed.
- All 130 automated tests passed.
- The normal `npm run build` completed the Next.js build and OpenNext packaging and generated `.open-next/worker.js`.
- Mobile visual checks passed at the sizes above.

Remote preview outcome must be checked against the new PR commit, not the old failed build. A successful preview build does not establish that the uninstalled quota RPC or live Pro decisions work. No live database write, account entitlement change, Pro request or e-mail was performed.
