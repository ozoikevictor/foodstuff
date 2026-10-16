export const LEGACY_SCRYPT_OPTIONS = {
  hash: {
    algorithm: "STANDARD_SCRYPT",
    memoryCost: 16384,
    parallelization: 1,
    blockSize: 8,
    derivedKeyLength: 64,
  },
};

export function legacyCustomer(row) {
  if (row.role !== "CUSTOMER")
    throw new Error(
      "This migration only imports existing customers; administrators and riders require separate setup.",
    );
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(row.password_hash))
    throw new Error("Unsupported legacy password format.");
  const [salt, hash] = row.password_hash.split(":");
  const createdAt = new Date(
    row.created_at.includes("T")
      ? row.created_at
      : row.created_at.replace(" ", "T") + "Z",
  ).toISOString();
  return {
    identity: {
      uid: row.id,
      email: row.email.toLowerCase(),
      displayName: row.name,
      emailVerified: false,
      passwordHash: Buffer.from(hash, "hex"),
      passwordSalt: Buffer.from(salt, "utf8"),
    },
    profile: {
      id: row.id,
      email: row.email.toLowerCase(),
      name: row.name,
      phone: row.phone,
      role: "CUSTOMER",
      contactConsent: false,
      createdAt,
    },
  };
}
