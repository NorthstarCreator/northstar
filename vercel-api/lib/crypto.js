const crypto = require("crypto");

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function encryptionKey() {
  const secret = process.env.NORTHSTAR_ENV === "tiktok_sandbox"
    ? (process.env.TOKEN_STORE_SECRET_SANDBOX || process.env.TOKEN_STORE_SECRET)
    : process.env.TOKEN_STORE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Token store secret must be set to at least 32 characters.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptJson(value) {
  const buffer = Buffer.from(String(value || ""), "base64url");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  randomToken,
  encryptJson,
  decryptJson,
  timingSafeEqual
};
