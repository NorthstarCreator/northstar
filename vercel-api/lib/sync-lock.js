const crypto = require("node:crypto");
const { redisCommand, namespacedKey } = require("./token-store");

const SYNC_LOCK_TTL_SECONDS = 15 * 60;

function accountLockKey(openId) {
  const digest = crypto.createHash("sha256").update(String(openId)).digest("hex");
  return namespacedKey("tiktok-sync-lock", digest);
}

async function acquireSyncLock(openId, options = {}) {
  const ownerToken = options.ownerToken || crypto.randomUUID();
  const ttlSeconds = Number(options.ttlSeconds || SYNC_LOCK_TTL_SECONDS);
  const command = options.redisCommand || redisCommand;
  const result = await command("SET", accountLockKey(openId), ownerToken, "NX", "EX", String(ttlSeconds));
  return result === "OK" ? { key: accountLockKey(openId), ownerToken, ttlSeconds } : null;
}

async function releaseSyncLock(lock, options = {}) {
  if (!lock?.key || !lock?.ownerToken) return false;
  const command = options.redisCommand || redisCommand;
  const script = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
  const result = await command("EVAL", script, "1", lock.key, lock.ownerToken);
  return Number(result) === 1;
}

module.exports = {
  SYNC_LOCK_TTL_SECONDS,
  accountLockKey,
  acquireSyncLock,
  releaseSyncLock
};
