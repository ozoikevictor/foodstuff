import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

export const FIREBASE_SESSION_COOKIE = "cribs_firebase_session";
export const SESSION_DURATION = 7 * 86400000;
const digest = (token) => createHash("sha256").update(token).digest("hex");
export function authError(status, message) {
  return Object.assign(new Error(message), { status });
}
export function sessionToken(cookie = "") {
  return (
    cookie.match(
      /(?:^|;\s*)cribs_firebase_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1] || null
  );
}
export function publicProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    avatarInitials: profile.name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    memberSince: profile.createdAt.slice(0, 10),
    contactConsent: !!profile.contactConsent,
    photoUrl: profile.photoUrl || "",
  };
}

export function firestoreAuthStore(db) {
  const users = db.collection("users");
  const sessions = db.collection("backend_sessions");
  return {
    async ownsImage(uid, url) {
      const image = await db.collection("uploads").doc(url.split("/").pop()).get();
      return image.exists && image.data().owner_id === uid;
    },
    async getProfile(uid) {
      const doc = await users.doc(uid).get();
      return doc.exists ? doc.data() : null;
    },
    async createProfile(profile) {
      await users.doc(profile.id).create(profile);
    },
    async ensureProfile(profile) {
      return db.runTransaction(async (tx) => {
        const ref = users.doc(profile.id);
        const current = await tx.get(ref);
        if (current.exists) return current.data();
        tx.create(ref, profile);
        return profile;
      });
    },
    async updateProfile(uid, fields) {
      return db.runTransaction(async (tx) => {
        const ref = users.doc(uid);
        const current = await tx.get(ref);
        if (!current.exists) throw authError(401, "Please log in.");
        tx.update(ref, fields);
        return { ...current.data(), ...fields };
      });
    },
    async deleteProfile(uid) {
      await users.doc(uid).delete();
    },
    async createSession(hash, record) {
      const { expiresAtMs, ...rest } = record;
      await sessions
        .doc(hash)
        .create({ ...rest, expiresAt: Timestamp.fromMillis(expiresAtMs) });
    },
    async getSession(hash) {
      const doc = await sessions.doc(hash).get();
      if (!doc.exists) return null;
      const record = doc.data();
      return { ...record, expiresAtMs: record.expiresAt.toMillis() };
    },
    async deleteSession(hash) {
      await sessions.doc(hash).delete();
    },
  };
}

export function firebaseIdentityProvider({ apiKey, fetcher = fetch }) {
  if (!apiKey?.trim())
    throw authError(
      503,
      "Set FIREBASE_WEB_API_KEY in Backend/.env before testing Firebase login.",
    );
  return {
    async passwordRequest(action, email, password) {
      const response = await fetcher(
        `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        const code = result.error?.message;
        if (code === "EMAIL_EXISTS")
          throw authError(409, "An account with this email already exists.");
        if (["OPERATION_NOT_ALLOWED", "PASSWORD_LOGIN_DISABLED"].includes(code))
          throw authError(
            503,
            "Enable Email/Password sign-in in Firebase Authentication.",
          );
        if (code === "TOO_MANY_ATTEMPTS_TRY_LATER")
          throw authError(429, "Too many attempts. Please try later.");
        if (
          [
            "INVALID_LOGIN_CREDENTIALS",
            "INVALID_PASSWORD",
            "EMAIL_NOT_FOUND",
            "USER_DISABLED",
          ].includes(code)
        )
          throw authError(401, "Email or password is incorrect.");
        throw authError(
          502,
          "Firebase Authentication could not complete the request.",
        );
      }
      if (!result.localId || !result.idToken)
        throw authError(
          502,
          "Firebase returned an incomplete sign-in response.",
        );
      return result;
    },
  };
}

export async function firebaseAuthProjectConfig(app, fetcher = fetch) {
  const token = await app.options.credential.getAccessToken();
  const projectId = app.options.projectId;
  const response = await fetcher(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(projectId)}/config`,
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw authError(
      503,
      "Firebase Authentication setup cannot be read. Open Authentication and click Get started; also check the service account permissions.",
    );
  return response.json();
}

export const firebaseEmailPasswordEnabled = (config) =>
  config.signIn?.email?.enabled === true;

export async function firebaseProjectIdentityProvider(
  app,
  configuredKey = process.env.FIREBASE_WEB_API_KEY,
) {
  const config = await firebaseAuthProjectConfig(app);
  if (!firebaseEmailPasswordEnabled(config)) {
    throw authError(
      503,
      "Enable Email/Password sign-in in Firebase Authentication before testing.",
    );
  }
  return firebaseIdentityProvider({
    apiKey: configuredKey?.trim() || config.client?.apiKey,
  });
}

export function createFirebaseAuthService({
  auth,
  store,
  identity,
  clock = () => Date.now(),
  onCleanupFailure = (uid) =>
    console.error(
      `Firebase registration cleanup requires review for UID ${uid}`,
    ),
}) {
  const newProfile = (uid, email, name, phone) => ({
    id: uid,
    email,
    name,
    phone,
    role: "CUSTOMER",
    createdAt: new Date(clock()).toISOString(),
  });
  async function verifiedIdentity(result) {
    const claims = await auth.verifyIdToken(result.idToken, true);
    if (claims.uid !== result.localId || !Number.isFinite(claims.auth_time))
      throw authError(401, "Firebase identity could not be verified.");
    return claims;
  }
  async function issueSession(profile, claims) {
    const token = randomBytes(32).toString("hex");
    await store.createSession(digest(token), {
      uid: profile.id,
      createdAtMs: clock(),
      authTimeSeconds: claims.auth_time,
      expiresAtMs: clock() + SESSION_DURATION,
    });
    return { user: publicProfile(profile), token };
  }
  return {
    async register({ email, password, name, phone }) {
      const result = await identity.passwordRequest("signUp", email, password);
      let profileCreated = false;
      let verifiedUid;
      try {
        const claims = await verifiedIdentity(result);
        verifiedUid = claims.uid;
        await auth.updateUser(claims.uid, { displayName: name });
        const profile = newProfile(claims.uid, email, name, phone);
        await store.createProfile(profile);
        profileCreated = true;
        return await issueSession(profile, claims);
      } catch (error) {
        // signUp created a new identity; never remove an existing identity after a login failure.
        if (verifiedUid)
          try {
            if (profileCreated) await store.deleteProfile(verifiedUid);
            await auth.deleteUser(verifiedUid);
          } catch {
            onCleanupFailure(verifiedUid);
          }
        throw error;
      }
    },
    async login({ email, password }) {
      const result = await identity.passwordRequest(
        "signInWithPassword",
        email,
        password,
      );
      const claims = await verifiedIdentity(result);
      const user = await auth.getUser(claims.uid);
      if (user.disabled)
        throw authError(401, "Email or password is incorrect.");
      const profile = await store.ensureProfile(
        newProfile(
          claims.uid,
          user.email || email,
          user.displayName || "Customer",
          "",
        ),
      );
      if (profile.id !== claims.uid)
        throw authError(401, "Firebase profile identity does not match.");
      return issueSession(profile, claims);
    },
    async session(cookie) {
      const token = sessionToken(cookie);
      if (!token) return null;
      const hash = digest(token);
      const session = await store.getSession(hash);
      if (!session) return null;
      if (session.expiresAtMs <= clock()) {
        await store.deleteSession(hash);
        return null;
      }
      let identity;
      try {
        identity = await auth.getUser(session.uid);
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          await store.deleteSession(hash);
          return null;
        }
        throw error;
      }
      const revokedAfter = Math.floor(
        new Date(identity.tokensValidAfterTime || 0).getTime() / 1000,
      );
      if (identity.disabled || revokedAfter > session.authTimeSeconds) {
        await store.deleteSession(hash);
        return null;
      }
      const profile = await store.getProfile(session.uid);
      if (
        !profile ||
        profile.id !== session.uid ||
        !["CUSTOMER", "ADMIN", "RIDER"].includes(profile.role)
      )
        return null;
      return publicProfile(profile);
    },
    async logout(cookie) {
      const token = sessionToken(cookie);
      if (token) await store.deleteSession(digest(token));
    },
    async updateProfile(cookie, fields) {
      const user = await this.session(cookie);
      if (!user) throw authError(401, "Please log in.");
      const update = { name: fields.name, phone: fields.phone };
      if (fields.photoUrl !== undefined) {
        if (fields.photoUrl && !(await store.ownsImage(user.id, fields.photoUrl)))
          throw authError(400, "Please upload your own profile photo.");
        update.photoUrl = fields.photoUrl;
      }
      if (user.role === "RIDER" && fields.contactConsent !== undefined)
        update.contactConsent = fields.contactConsent;
      return publicProfile(await store.updateProfile(user.id, update));
    },
  };
}
