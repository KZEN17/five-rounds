import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/report-job", () => ({ runReportJob: vi.fn(async () => ({ users: 0 })) }));
const { GET } = await import("./route");

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/reports", () => {
  it("refuses without the secret, and refuses everything when no secret is set", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value-for-test");
    expect((await GET(new Request("http://x/api/cron/reports"))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/reports", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/reports", { headers: { authorization: "Bearer s3cret-value-for-test" } }))).status).toBe(200);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("http://x/api/cron/reports", { headers: { authorization: "Bearer " } }))).status).toBe(401);
  });
});
