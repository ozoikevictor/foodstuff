export function listenOptions(env = process.env) {
  const port = Number(env.PORT || env.FIREBASE_MARKETPLACE_PORT || 3003);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a number between 1 and 65535.");
  return { port, host: env.HOST || (env.RENDER || env.PORT ? "0.0.0.0" : "127.0.0.1") };
}

export function firebaseStartupMessage(error) {
  const detail = String(error?.message || "");
  if (/^FIREBASE_SERVICE_ACCOUNT_JSON/.test(detail)) return detail;
  if (/FIREBASE_PROJECT_ID/.test(detail)) return "Set FIREBASE_PROJECT_ID in your hosting environment.";
  if (/ENOENT|ENOTDIR|EACCES|credential|default credentials|private.key|PEM/i.test(detail))
    return "Firebase credentials are missing or unreadable. Set FIREBASE_SERVICE_ACCOUNT_JSON to the complete service-account JSON in Render Environment, or use a Secret File with GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json. A Windows file path will not work on Render.";
  if (error?.status) return error.message;
  if (/ENOTFOUND|ETIMEDOUT|fetch failed/i.test(detail))
    return "Firebase could not be reached. Check network access and retry.";
  return "Firebase setup failed. Check the service-account Secret File, FIREBASE_PROJECT_ID, and Firebase Authentication permissions. No credential values are logged.";
}
