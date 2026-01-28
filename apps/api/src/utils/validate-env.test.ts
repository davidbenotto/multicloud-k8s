import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";

describe("Environment Validation", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("should validate valid environment variables", async () => {
    process.env = {
      ...originalEnv,
      PORT: "4000",
      DATABASE_URL: "postgres://localhost/test",
      FRONTEND_URL: "http://localhost:3000",
      NODE_ENV: "test",
    };

    const { validateEnv } = await import("./validate-env");
    const env = validateEnv();

    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_URL).toBe("postgres://localhost/test");
    expect(env.NODE_ENV).toBe("test");
  });

  it("should throw error for invalid variables", async () => {
    process.env = {
      ...originalEnv,
      PORT: "invalid-port", // Should be coerced to NaN which fails schema? Or just number? Zod coerce parses "invalid" to NaN.
    };

    // We mock console.error and process.exit to avoid crashing the test runner
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    const { validateEnv } = await import("./validate-env");

    // validateEnv calls process.exit(1) on failure
    validateEnv();

    expect(consoleSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
