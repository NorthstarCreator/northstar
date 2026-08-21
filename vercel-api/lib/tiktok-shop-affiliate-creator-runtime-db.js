"use strict";
const { getAffiliateCreatorRuntimePersistenceCommand } = require("./tiktok-shop-affiliate-creator-runtime-persistence");
function sqlState(error) { const code = error && typeof error.code === "string" ? error.code : ""; return /^[0-9A-Z]{5}$/.test(code) ? `database_sqlstate_${code}` : null; }
function httpLabel(status) { return status >= 200 && status < 300 ? "database_http_2xx" : status >= 400 && status < 500 ? "database_http_4xx" : status >= 500 && status < 600 ? "database_http_5xx" : "database_http_other"; }
function create({ databaseUrl, execute, onDiagnostic } = {}) {
  if (onDiagnostic !== undefined && typeof onDiagnostic !== "function") throw new Error("runtime_database_unavailable");
  let observation;
  const observe = label => { observation = label; if (onDiagnostic) onDiagnostic(label); };
  let q = execute;
  if (!q) {
    try {
      const { neon } = require("@neondatabase/serverless");
      const options = onDiagnostic ? { fetchFunction: async (_resource, init) => { let response; try { response = await fetch(_resource, init); } catch { observe("database_transport_failure"); throw new Error("runtime_database_unavailable"); } observe(httpLabel(response.status)); return response; } } : undefined;
      q = neon(databaseUrl, options);
    } catch { throw new Error("runtime_database_unavailable"); }
  }
  if (typeof q !== "function") throw new Error("runtime_database_unavailable");
  const one = async (statement, parameters, keys) => {
    observation = undefined;
    let rows;
    try { rows = await q(statement, parameters); } catch (error) { const label = sqlState(error); if (label) observe(label); else if (!observation) observe("database_query_failure"); throw new Error("runtime_database_unavailable"); }
    if (!Array.isArray(rows) || rows.length !== 1 || !keys.every(key => Object.hasOwn(rows[0], key))) { observe("database_result_shape_failure"); throw new Error("runtime_database_unavailable"); }
    return rows[0];
  };
  const complete = async command => { let value; try { value = getAffiliateCreatorRuntimePersistenceCommand(command); } catch { throw new Error("runtime_database_unavailable"); } const row = await one("select public.complete_affiliate_creator_runtime_authorization($1::uuid,$2::int8,$3::int8,$4::text,$5::text,$6::int2,$7::text[],$8::timestamptz,$9::timestamptz,$10::timestamptz,$11::int2,$12::text,$13::text,$14::int2,$15::text,$16::text,$17::text,$18::int2,$19::text,$20::text,$21::int2,$22::text,$23::text,$24::text) completed", [value.connectionId, value.expectedAuthorizationRevision, value.expectedCredentialRevision, value.authorizationState, value.providerCreatorOpenId, value.userType, value.grantedScopes, value.authorizedAt, value.accessExpiresAt, value.refreshExpiresAt, value.access.envelope_version, value.access.envelope_algorithm, value.access.envelope_key_reference, value.access.envelope_aad_version, value.access.envelope_initialization_vector, value.access.envelope_ciphertext, value.access.envelope_authentication_tag, value.refresh.envelope_version, value.refresh.envelope_algorithm, value.refresh.envelope_key_reference, value.refresh.envelope_aad_version, value.refresh.envelope_initialization_vector, value.refresh.envelope_ciphertext, value.refresh.envelope_authentication_tag], ["completed"]); if (row.completed !== null) throw new Error("runtime_database_unavailable"); };
  return Object.freeze({ begin: value => one("select * from public.begin_affiliate_creator_authorization($1::uuid,$2::text,$3::timestamptz,$4::timestamptz)", [value.connectionId, value.stateDigest, value.expiresAt, value.occurredAt], ["connection_id", "authorization_revision", "expires_at"]), accept: value => one("select * from public.accept_affiliate_creator_authorization_callback($1::uuid,$2::int8,$3::text,$4::timestamptz)", [value.connectionId, value.authorizationRevision, value.stateDigest, value.occurredAt], ["connection_id", "authorization_revision", "credential_revision"]), account: () => one("select public.get_affiliate_creator_runtime_account_id() account_id", [], ["account_id"]), complete });
}
module.exports = { create };
