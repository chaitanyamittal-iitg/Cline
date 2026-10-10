import { afterEach, describe, expect, it, vi } from "vitest";
import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("env helpers", () => {
  it("prefers the new publishable/secret names", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_new");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy_anon");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_new");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service");
    expect(supabasePublishableKey()).toBe("sb_publishable_new");
    expect(supabaseSecretKey()).toBe("sb_secret_new");
  });

  it("falls back to the legacy names", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy_anon");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy_service");
    expect(supabasePublishableKey()).toBe("legacy_anon");
    expect(supabaseSecretKey()).toBe("legacy_service");
  });

  it("treats empty values as not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(supabaseUrl()).toBeUndefined();
    expect(supabasePublishableKey()).toBeUndefined();
    expect(supabaseSecretKey()).toBeUndefined();
  });
});
