import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password, saved) {
  const [salt, hex] = saved.split(":");
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export function createSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
    hashToken(token),
    userId,
    Date.now() + 7 * 86400000,
  );
  return token;
}
export function sessionUser(db, req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)cribs_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  return (
    db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(hashToken(token), Date.now()) || null
  );
}
export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    contactConsent: !!u.contact_consent,
    avatarInitials: u.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    memberSince: u.created_at.slice(0, 10),
  };
}
