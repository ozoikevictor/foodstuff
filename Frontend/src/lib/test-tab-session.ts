export const tabTesting = import.meta.env["VITE_TAB_SESSION_TEST_MODE"] === "true";
export function tabStorage(): Storage {
  return tabTesting ? sessionStorage : localStorage;
}
export function testTabId(): string | null {
  if (!tabTesting || typeof window === "undefined") return null;
  let id=sessionStorage.getItem("naijafresh-test-tab");
  if (!id) { id=crypto.randomUUID(); sessionStorage.setItem("naijafresh-test-tab",id); }
  return id;
}
export function tabHeaders(): Record<string,string> {
  const id=testTabId();
  return id ? {"X-Test-Tab-Id":id} : {};
}
export function tabEventsUrl() {
  const id=testTabId();
  return id ? `/api/events?testTab=${encodeURIComponent(id)}` : "/api/events";
}
export function tabPrivateImage(url: string) {
  const id=testTabId();
  return id && url.startsWith('/api/images/') ? `${url}?testTab=${encodeURIComponent(id)}` : url;
}
