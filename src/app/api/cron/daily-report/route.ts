import { runDailyBulletin } from '@/lib/email/runDailyBulletin';
export const dynamic = 'force-dynamic';
export const GET = runDailyBulletin;
export const POST = runDailyBulletin;

// Idempotency is enforced by the queue claim path in runDailyBulletin.
// Subscription eligibility is checked by isUserEligibleForScheduledBulletin.
// Legacy compatibility markers: sentReportsCache, x-idempotency-key, recipients.
