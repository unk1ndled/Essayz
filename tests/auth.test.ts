import { describe, expect, it } from "vitest";
import {
  PASSWORD_HASH_ITERATIONS,
  passwordRecord,
  verifyPassword,
  type UserRow,
} from "../worker/auth";

describe("password hashing", () => {
  it("uses an iteration count supported by the Workers runtime", async () => {
    const password = "a-secure-test-password";
    const record = await passwordRecord(password, PASSWORD_HASH_ITERATIONS);
    const user = {
      id: "test-user",
      username: "tester",
      display_name: "Test User",
      password_hash: record.hash,
      password_salt: record.salt,
      password_iterations: PASSWORD_HASH_ITERATIONS,
    } satisfies UserRow;

    expect(PASSWORD_HASH_ITERATIONS).toBe(100_000);
    await expect(verifyPassword(password, user)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", user)).resolves.toBe(false);
  });
});
