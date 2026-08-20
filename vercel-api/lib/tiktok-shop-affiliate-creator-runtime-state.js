"use strict";
const crypto=require("node:crypto"),PATTERN=/^[A-Za-z0-9_-]{43}$/;
function create(){return crypto.randomBytes(32).toString("base64url");}function digest(v){if(typeof v!=="string"||!PATTERN.test(v))throw new Error("invalid_state");return crypto.createHash("sha256").update(v).digest("hex");}function connectionId(v){const b=crypto.createHash("sha256").update(v).digest().subarray(0,16),h=b.toString("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20)}`;}module.exports={PATTERN,create,digest,connectionId};
