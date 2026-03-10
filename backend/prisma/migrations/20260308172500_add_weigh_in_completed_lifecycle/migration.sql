DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EventLifecycle'
      AND e.enumlabel = 'WEIGH_IN_COMPLETED'
  ) THEN
    ALTER TYPE "EventLifecycle" ADD VALUE 'WEIGH_IN_COMPLETED' AFTER 'WEIGHIN';
  END IF;
END
$$;
