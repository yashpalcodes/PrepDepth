// Override with TEST_DATABASE_URL if your Postgres is on another port (e.g. 5433).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://prepdebt:prepdebt@localhost:5432/prepdebt_test";

export const TEST_JWT_SECRET = "test-secret-for-automated-tests-only";
