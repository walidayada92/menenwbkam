-- Queue SQL uses database clocks; timezone-aware columns prevent deployment
-- timezone settings from shifting leases, backoff delays, or host throttle slots.
ALTER TABLE "ExternalJob"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "availableAt" TYPE TIMESTAMPTZ(3) USING
    CASE WHEN attempts = 0 OR "availableAt" = "createdAt" THEN "availableAt" AT TIME ZONE current_setting('TimeZone') ELSE "availableAt" AT TIME ZONE 'UTC' END,
  ALTER COLUMN "lockedUntil" TYPE TIMESTAMPTZ(3) USING "lockedUntil" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING
    CASE WHEN status = 'RUNNING' OR (status = 'WAITING' AND attempts = 0) THEN "updatedAt" AT TIME ZONE current_setting('TimeZone') ELSE "updatedAt" AT TIME ZONE 'UTC' END,
  ALTER COLUMN "finishedAt" TYPE TIMESTAMPTZ(3) USING "finishedAt" AT TIME ZONE 'UTC';

ALTER TABLE "ExternalHostThrottle"
  ALTER COLUMN "nextAllowedAt" TYPE TIMESTAMPTZ(3) USING "nextAllowedAt" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "ExternalSearchDocument"
  ALTER COLUMN "indexedAt" TYPE TIMESTAMPTZ(3) USING "indexedAt" AT TIME ZONE current_setting('TimeZone');
ALTER TABLE "ExternalDiscovery"
  ALTER COLUMN "nextRunAt" TYPE TIMESTAMPTZ(3) USING
    CASE WHEN "nextRunAt" = "createdAt" THEN "nextRunAt" AT TIME ZONE current_setting('TimeZone') ELSE "nextRunAt" AT TIME ZONE 'UTC' END,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "lastCompletedAt" TYPE TIMESTAMPTZ(3) USING "lastCompletedAt" AT TIME ZONE 'UTC';
ALTER TABLE "ComparisonProduct"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "ExternalSource"
  ALTER COLUMN "nextRunAt" TYPE TIMESTAMPTZ(3) USING
    CASE WHEN "nextRunAt" = "createdAt" THEN "nextRunAt" AT TIME ZONE current_setting('TimeZone') ELSE "nextRunAt" AT TIME ZONE 'UTC' END;
