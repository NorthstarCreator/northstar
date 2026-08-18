"use strict";

const crypto = require("node:crypto");
const {
  CREDENTIAL_ENVELOPE_ALGORITHM,
  createAffiliateCreatorCredentialEnvelopeContext,
  getAffiliateCreatorCredentialAadMaterial,
  getAffiliateCreatorCredentialEnvelopeMaterial,
  normalizeAffiliateCreatorCredentialEnvelope
} = require("./tiktok-shop-affiliate-creator-credential-envelope-contract");

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAX_PLAINTEXT_BYTES = 8 * 1024;

class AffiliateCreatorCredentialCryptographerError extends Error {
  constructor(code) {
    super(code);
    this.name = "AffiliateCreatorCredentialCryptographerError";
    this.code = code;
  }
}

function fail(code) {
  throw new AffiliateCreatorCredentialCryptographerError(code);
}

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  if (!record(value)) return false;
  const names = Object.keys(value);
  return names.length === keys.length && names.every((name) => keys.includes(name));
}

function plaintext(value) {
  if (typeof value !== "string" || value.length === 0) fail("invalid_credential_plaintext");
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length === 0 || bytes.length > MAX_PLAINTEXT_BYTES || bytes.toString("utf8") !== value) {
    fail("invalid_credential_plaintext");
  }
  return bytes;
}

function aadMaterial(context) {
  try {
    return getAffiliateCreatorCredentialAadMaterial(context);
  } catch {
    fail("invalid_credential_aad");
  }
}

function keyFor(keyring, keyReference) {
  let key;
  try {
    key = keyring.getAffiliateCreatorCredentialKey(keyReference);
  } catch {
    fail("credential_key_unavailable");
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) fail("credential_key_unavailable");
  return key;
}

function createAffiliateCreatorCredentialCryptographer(input = {}) {
  if (!exactKeys(input, ["keyring"])) fail("invalid_credential_keyring");
  const { keyring } = input;
  if (!record(keyring)
    || !record(keyring)
    || Object.keys(keyring).length !== 1
    || typeof keyring.getAffiliateCreatorCredentialKey !== "function") {
    fail("invalid_credential_keyring");
  }

  const cryptographer = Object.freeze(Object.assign(Object.create(null), {
    encrypt(input = {}) {
      if (!exactKeys(input, ["plaintext", "aad"])) fail("invalid_credential_input");
      const { plaintext: inputPlaintext, aad } = input;
      const aadInfo = aadMaterial(aad);
      const key = keyFor(keyring, aadInfo.keyReference);
      const iv = crypto.randomBytes(IV_BYTES);
      try {
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(Buffer.from(aadInfo.aad, "utf8"));
        const ciphertext = Buffer.concat([cipher.update(plaintext(inputPlaintext)), cipher.final()]);
        const tag = cipher.getAuthTag();
        const envelope = normalizeAffiliateCreatorCredentialEnvelope({
          v: 1,
          alg: CREDENTIAL_ENVELOPE_ALGORITHM,
          kid: aadInfo.keyReference,
          aad_v: 1,
          iv: iv.toString("base64url"),
          ct: ciphertext.toString("base64url"),
          tag: tag.toString("base64url")
        });
        return createAffiliateCreatorCredentialEnvelopeContext({ envelope, aad });
      } catch (error) {
        if (error instanceof AffiliateCreatorCredentialCryptographerError) throw error;
        fail("credential_encryption_failed");
      }
    },
    decrypt(input = {}) {
      if (!exactKeys(input, ["envelope", "aad"])) fail("invalid_credential_input");
      const { envelope, aad } = input;
      const aadInfo = aadMaterial(aad);
      let material;
      try {
        material = getAffiliateCreatorCredentialEnvelopeMaterial(envelope);
      } catch {
        fail("invalid_credential_envelope");
      }
      if (material.aad !== aadInfo.aad || material.envelope.kid !== aadInfo.keyReference) {
        fail("credential_decryption_failed");
      }
      const key = keyFor(keyring, aadInfo.keyReference);
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(material.envelope.iv, "base64url"));
        decipher.setAAD(Buffer.from(aadInfo.aad, "utf8"));
        decipher.setAuthTag(Buffer.from(material.envelope.tag, "base64url"));
        return Buffer.concat([
          decipher.update(Buffer.from(material.envelope.ct, "base64url")),
          decipher.final()
        ]).toString("utf8");
      } catch {
        fail("credential_decryption_failed");
      }
    }
  }));
  return cryptographer;
}

module.exports = {
  IV_BYTES,
  TAG_BYTES,
  KEY_BYTES,
  MAX_PLAINTEXT_BYTES,
  AffiliateCreatorCredentialCryptographerError,
  createAffiliateCreatorCredentialCryptographer
};
