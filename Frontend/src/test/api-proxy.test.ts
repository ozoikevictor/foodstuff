import { afterEach, expect, it, vi } from "vitest";
import { proxyApi } from "@/server/api-proxy";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("forwards login body, origin, and session cookies through the same-origin proxy", async () => {
  vi.stubEnv("API_ORIGIN", "https://backend.example");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response('{"id":"customer"}', {
        headers: {
          "content-type": "application/json",
          "set-cookie": "session=token; HttpOnly; Secure; Path=/",
        },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const response = await proxyApi(
    new Request("https://shop.example/api/auth/login", {
      method: "POST",
      headers: { origin: "https://shop.example", "content-type": "application/json" },
      body: '{"email":"customer@example.com"}',
    }),
  );
  expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://backend.example/api/auth/login");
  expect(fetcher.mock.calls[0]?.[1].headers.get("origin")).toBe("https://shop.example");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
it("returns an actionable API error if the backend URL is missing", async () => {
  vi.stubEnv("API_ORIGIN", "");
  const response = await proxyApi(new Request("https://shop.example/api/auth/me"));
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("API_ORIGIN");
});
