const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error(
    'TEST_DATABASE_URL must point to a dedicated database ending in _test',
  );
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = 'integration-only-secret-at-least-32-characters-long';
process.env.UPLOAD_DIR = '.local/test-uploads';
process.env.BILLING_MODE = 'test';
process.env.BILLING_VAT_BPS = '1500';
