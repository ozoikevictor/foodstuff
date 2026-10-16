import { openDatabase, id } from "./database.mjs";
import { hashPassword } from "./auth.mjs";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).");
const db = openDatabase();
if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
  throw new Error("Account already exists. No changes made.");
db.prepare("INSERT INTO users (id,email,name,password_hash,role) VALUES (?,?,?,?,?)").run(
  id(),
  email,
  process.env.ADMIN_NAME || "Store Administrator",
  await hashPassword(password),
  "ADMIN",
);
db.close();
console.log("Administrator created. Sign in using the website login page.");
