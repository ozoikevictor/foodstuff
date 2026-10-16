import {FIREBASE_SESSION_COOKIE, authError} from './firebase-auth.mjs';
export function tabCookieName(req, origin, enabled = process.env.TAB_SESSION_TEST_MODE === 'true') {
  if (!enabled || !['localhost','127.0.0.1'].includes(new URL(origin).hostname)) return FIREBASE_SESSION_COOKIE;
  const url=new URL(req.url,origin);
  const tab=req.headers['x-test-tab-id'] || (url.pathname === '/api/events' || url.pathname.startsWith('/api/images/') ? url.searchParams.get('testTab') : null);
  if (!tab) return FIREBASE_SESSION_COOKIE;
  if (typeof tab !== 'string' || !/^[a-f0-9-]{36}$/.test(tab)) throw authError(400,'Invalid testing tab identifier.');
  return `${FIREBASE_SESSION_COOKIE}_${tab}`;
}
export function requestSessionCookie(req, origin, enabled) {
  const name=tabCookieName(req,origin,enabled);
  const value=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
  return value ? `${FIREBASE_SESSION_COOKIE}=${value}` : '';
}
