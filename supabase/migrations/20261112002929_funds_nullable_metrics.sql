-- Allow TEFAS fund metadata fields to remain NULL when omitted by the upstream source
-- rather than forcing synthetic placeholder values.
ALTER TABLE public.funds
  ALTER COLUMN risk_value DROP NOT NULL,
  ALTER COLUMN total_value DROP NOT NULL,
  ALTER COLUMN investor_count DROP NOT NULL;

ALTER TABLE public.funds
  ALTER COLUMN risk_value DROP DEFAULT,
  ALTER COLUMN total_value DROP DEFAULT,
  ALTER COLUMN investor_count DROP DEFAULT,
  ALTER COLUMN management_fee DROP DEFAULT;
