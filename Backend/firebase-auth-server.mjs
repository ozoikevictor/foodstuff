import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import {tabCookieName, requestSessionCookie} from "./tab-sessions.mjs";
import { firebaseServices } from "./firebase.mjs";
import {
  createFirebaseAuthService,
  firestoreAuthStore,
  firebaseProjectIdentityProvider,
  authError,
  FIREBASE_SESSION_COOKIE,
  SESSION_DURATION,
} from "./firebase-auth.mjs";

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const phone = z
  .string()
  .trim()
  .regex(/^(?:0\d{10}|\+234\d{10})$/);
const name = z.string().trim().min(2).max(150);
const registration = z.object({
  email,
  password: z.string().min(12).max(128),
  name,
  phone,
});
const login = z.object({ email, password: z.string().min(1).max(128) });
const profile = z.object({
  name,
  phone,
  photoUrl: z.string().regex(/^\/api\/images\/[a-f0-9-]{36}$/).or(z.literal("")).optional(),
  contactConsent: z.boolean().optional(),
});
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw authError(415, "JSON required.");
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 16384) throw authError(413, "Request too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw authError(400, "Invalid JSON.");
  }
}
export function createFirebaseAuthApi({
  service,
  origin = process.env.APP_ORIGIN || "http://localhost:8080",
  tabSessions = process.env.TAB_SESSION_TEST_MODE === "true",
}) {
  const attempts = new Map();
  const cookie = (req, token) =>
    `${tabCookieName(req,origin,tabSessions)}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${token ? SESSION_DURATION / 1000 : 0}${origin.startsWith("https:") ? "; Secure" : ""}`;
  const send = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, origin).pathname;
      const method = req.method;
      const sessionCookie = requestSessionCookie(req,origin,tabSessions);
      if (!["GET", "HEAD"].includes(method) && req.headers.origin !== origin)
        throw authError(403, "Request origin not allowed.");
      if (path === "/api/health" && method === "GET")
        return send(res, 200, {
          ok: true,
          authentication: "firebase",
          profiles: "firestore",
          stage: "backend-auth-validation",
        });
      if (
        ["/api/auth/register", "/api/auth/login"].includes(path) &&
        method === "POST"
      ) {
        const now = Date.now();
        for (const [key, value] of attempts)
          if (value.until < now) attempts.delete(key);
        const key = req.socket.remoteAddress;
        const limit = attempts.get(key) || { count: 0, until: now + 600000 };
        limit.count++;
        attempts.set(key, limit);
        if (limit.count > 30)
          throw authError(429, "Too many attempts. Try again later.");
        const data = path.endsWith("register")
          ? registration.parse(await body(req))
          : login.parse(await body(req));
        const result = path.endsWith("register")
          ? await service.register(data)
          : await service.login(data);
        res.setHeader("Set-Cookie", cookie(req,result.token));
        return send(res, 200, result.user);
      }
      if (path === "/api/auth/me" && method === "GET")
        return send(res, 200, await service.session(sessionCookie));
      if (path === "/api/auth/logout" && method === "POST") {
        await service.logout(sessionCookie);
        res.setHeader("Set-Cookie", cookie(req,""));
        return send(res, 200, { ok: true });
      }
      if (path === "/api/profile" && method === "PATCH")
        return send(
          res,
          200,
          await service.updateProfile(
            sessionCookie,
            profile.parse(await body(req)),
          ),
        );
      throw authError(
        404,
        "This Firebase test API currently provides authentication and profiles only.",
      );
    } catch (error) {
      if (error instanceof z.ZodError)
        return send(res, 400, {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      return send(res, error.status || 503, {
        error: error.status
          ? error.message
          : "Firebase authentication service is unavailable. Please retry.",
      });
    }
  });
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { app, db, auth } = firebaseServices();
  let identity;
  try {
    identity = await firebaseProjectIdentityProvider(app);
  } catch (error) {
    console.error(
      error.status
        ? error.message
        : "Firebase Authentication setup failed. Check project credentials.",
    );
    await db.terminate();
    process.exit(1);
  }
  const service = createFirebaseAuthService({
    auth,
    store: firestoreAuthStore(db),
    identity,
  });
  const server = createFirebaseAuthApi({ service });
  server.listen(
    Number(process.env.FIREBASE_AUTH_PORT || 3002),
    "127.0.0.1",
    () =>
      console.log(
        `Firebase authentication test API: http://127.0.0.1:${process.env.FIREBASE_AUTH_PORT || 3002}`,
      ),
  );
}
