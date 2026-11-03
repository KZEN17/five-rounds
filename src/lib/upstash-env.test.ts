import { describe, expect, it } from "vitest";
import { upstashConfig } from "./upstash-env";

describe("upstashConfig", () => {
  it("accepts the standard names", () => {
    expect(upstashConfig({ KV_REST_API_URL: "https://a", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://a", token: "t" });
  });
  it("accepts any Vercel prefix, as the legacy app did", () => {
    expect(upstashConfig({ STORAGE_KV_REST_API_URL: "https://b", STORAGE_KV_REST_API_TOKEN: "u" })).toEqual({ url: "https://b", token: "u" });
    expect(upstashConfig({ UPSTASH_REDIS_REST_URL: "https://c", UPSTASH_REDIS_REST_TOKEN: "v" })).toEqual({ url: "https://c", token: "v" });
  });
  it("is null without both parts", () => {
    expect(upstashConfig({ KV_REST_API_URL: "https://a" })).toBeNull();
  });
});
