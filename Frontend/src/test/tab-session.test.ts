import {afterEach,beforeEach,expect,it,vi} from "vitest";
beforeEach(()=>{vi.resetModules();sessionStorage.clear();localStorage.clear();});
afterEach(()=>{vi.unstubAllEnvs();sessionStorage.clear();localStorage.clear();});
it("uses tab-local storage and a stable namespace across requests in testing mode",async()=>{
  vi.stubEnv("VITE_TAB_SESSION_TEST_MODE","true");
  const module=await import("@/lib/test-tab-session");
  expect(module.tabStorage()).toBe(sessionStorage);
  const id=module.testTabId();
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(module.testTabId()).toBe(id);
  expect(module.tabHeaders()["X-Test-Tab-Id"]).toBe(id);
  expect(module.tabEventsUrl()).toContain(id);
  expect(module.tabPrivateImage("/api/images/test")).toContain(`testTab=${id}`);
  sessionStorage.removeItem("naijafresh-test-tab");
  expect(module.testTabId()).not.toBe(id);
  expect(localStorage.getItem("naijafresh-test-tab")).toBeNull();
});
it("keeps normal local storage and shared session requests when testing is off",async()=>{
  vi.stubEnv("VITE_TAB_SESSION_TEST_MODE","false");
  const module=await import("@/lib/test-tab-session");
  expect(module.tabStorage()).toBe(localStorage);
  expect(module.tabHeaders()).toEqual({});
  expect(module.tabEventsUrl()).toBe("/api/events");
});
