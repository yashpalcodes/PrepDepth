import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL, TEST_JWT_SECRET } from "./tests/testEnv";

export default defineConfig({
  test: {
    globalSetup: ["./tests/globalSetup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL, JWT_SECRET: TEST_JWT_SECRET },
    fileParallelism: false,
  },
});
