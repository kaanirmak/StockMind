# AI regression report — 19 October 2026

## Scope and environment

Live browser checks used the existing signed-in Standard account, including a 390×844 mobile viewport. This is responsive browser coverage, **not a physical Android WebView test**. No e-mails, Pro requests, Pro approvals/rejections, entitlement changes, or deployments were performed. The currently deployed version differs from this PR.

## Live application checks

| Check | Result | Evidence / limit |
|---|---|---|
| Existing account / model catalog | Passed | Signed-in account and provider catalog visible |
| New chat, reload, reopened tab | Passed in Chrome | LiquidAI and Cohere selections survived; Android-specific persistence remains unverified |
| Model switching and consecutive questions | Passed with available models | Automatic, Cohere and LiquidAI replied |
| Provider error recovery | Passed | Gemma returned rate limit; switching to LiquidAI produced a response |
| Stop / next question | Passed for UI recovery | Cancelled the second question; third question replied |
| Stop quota accounting | Failed in deployed version | Cancelled request reduced quota; PR propagates cancellation and refunds a specific reservation where the host forwards disconnects |
| Mobile answer length | Failed in deployed version | Cohere produced a long answer to a brief question; new configurable policy tested below |
| Hourly quota consistency | Failed in deployed version | Remaining credits increased after navigation; in-memory quota replaced by shared database reservations |
| Paid-model access | Passed | Standard account opened Pro gate; dismissed without submitting |
| Pro request delivery / decisions | Not exercised | User explicitly prohibited sending e-mail and changing entitlements |
| New Pro administration UI in production | Not available | Part of unpublished changes, not verified as live |

## Provider probes against the changed code

All free text-only catalog options were tested using a generic RSI question with no account, portfolio, or other personal data. These are **direct provider probes**, not authenticated application quota tests. Passing means a nonempty text response, not investment accuracy or future availability. Responses were left intact; word counts measure observed output rather than post-processing. Classifier or specialist models can still be unsuitable for conversational use even when a text call succeeds.

| Catalog model | Probe result | Observed words / error |
|---|---|---|
| openrouter/free | Passed | 53 |
| cohere/north-mini-code:free | Passed | 99 |
| dots-studio/dots-3-note-preview:free | Passed | 38 |
| google/gemma-4-26b-a4b-it:free | Provider failure | AI_RATE_LIMITED |
| google/gemma-4-31b-it:free | Provider failure | AI_RATE_LIMITED |
| liquid/lfm-2.5-2.6b:free | Passed | 84 |
| minimax/minimax-m3.1-flash:free | Passed | 61 |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | Passed | 83 |
| nvidia/nemotron-3-super-120b-a12b:free | Passed | 42 |
| nvidia/nemotron-3-ultra-550b-a55b:free | Passed | 64 |
| nvidia/nemotron-3.5-content-safety:free | Passed | 3 |
| nvidia/nemotron-3.5-lightning:free | Provider failure | AI_INVALID_RESPONSE |
| nvidia/nemotron-3.5-super-vl:free | Provider failure | AI_PROVIDER_UNAVAILABLE |
| poolside/laguna-s-2.1:free | Passed | 32 |
| poolside/laguna-xs-2.1:free | Passed | 42 |
| thinkingmachines/inkling:free | Provider failure | AI_PROVIDER_FORBIDDEN |
| thinkingmachines/inkling-small:free | Provider failure | AI_PROVIDER_FORBIDDEN |
| xingchen-agi/xing4.0-29b-a4b:free | Provider failure | AI_RATE_LIMITED |

11/18 returned nonempty replies. Provider limits, permissions and availability remain external constraints; the PR makes these errors explicit and does not silently switch to an unselected or paid model.

## Changes verified locally

- Model-only saves preserve API keys; account-scoped preferences and same-tab/cross-tab updates share one storage path. The scoped preference takes precedence over stale settings data.
- Catalog loading/failure does not overwrite a saved choice. Complete catalogs enforce entitlement and availability rules. Non-text output models are excluded using declared output modalities.
- New/switching chat aborts the previous request and ignores late results. Removing the final chat starts an empty replacement rather than retaining the removed chat. Global history is no longer imported into a different account.
- Persistent sliding-window quota is serialized per account, uses administrator-controlled entitlements, and refunds the exact request rather than the newest concurrent request. Quota policy lives in a private database configuration row.
- Removed unused canned financial answer generators. Market name matching uses the current instrument directory, with ambiguity checks, instead of a hand-maintained company/keyword list.
- Committee selection uses catalog JSON-output capabilities or a configured compatible ID. Structured output is parsed directly and fully validated; missing values no longer become invented buy ratings or scores. Client fallback no longer bypasses the authenticated API.
- Provider timeouts while reading JSON retain timeout classification. Mobile brevity, token budgets and timeouts are centralized and configurable; user requests for detail take priority. No regex truncation of answers was added.
- Existing Pro fixes are included: admin-only request list/decisions in Settings, truthful SMTP delivery status, checked metadata writes, consistent entitlements and no public fallback signing secret.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 130 tests passed.
- `npm run lint`: zero errors; existing repository warnings remain.
- Production Next.js build and OpenNext Cloudflare packaging: passed using Webpack. Default Turbopack cannot bind its subprocess port in this execution environment.
- PostgreSQL 14 tests in a disposable local cluster: authentication, RLS, cross-user isolation, Standard/Pro limits, precise/idempotent refunds, expiry and configurable limits passed.
- Eight concurrent requests against the local database: exactly five admitted and three rejected; durable count five.

## Rollout requirements and remaining limits

Apply `supabase/migrations/20261019165130_durable_ai_hourly_quota.sql` **before deploying** the application. Without the migration, quota operations deliberately fail closed. Policy defaults preserve the current 5/20 per-hour product tiers and can be changed centrally in `private.ai_quota_policy`.

Server-only optional settings are documented in `.env.example`: `AI_PROVIDER_TIMEOUT_MS`, `AI_CHAT_MAX_TOKENS`, `AI_COMMITTEE_MAX_TOKENS`, `AI_CHAT_BRIEF_WORD_TARGET`, `AI_CHAT_RESPONSE_STYLE` and `AI_COMMITTEE_MODEL`. Protocol identifiers, schema enums, bounded input limits and default configuration values remain intentional constants; model names, company-specific answers and phrase-based length hacks are not used.

No live migration or deployment was run. Physical Android process restart/force-stop, actual network loss, host-level disconnect forwarding/refund timing, paid-provider calls and live Pro decisions were not verified. The prior Cloudflare login-expiry blocker is separate from application Pro approvals; a Codex operation approval also does not approve a StockMind subscription.
