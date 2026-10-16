// Shared: boot PGlite with V1 mock + ISEXY 0001-0003 (+ optional extra SQL files).
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { readFileSync } from "node:fs";
export async function boot(repo, extra = []) {
  const db = await PGlite.create({ extensions: { uuid_ossp } });
  const strip = (s) => s.split("\n").filter((l) => !l.startsWith("\\")).join("\n").replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto[^;]*;/g, "");
  const files = [`${repo}/scripts/isexy/test/v1-mock.sql`, ...["0001_isexy_baseline", "0002_takatak_identity", "0003_social_network_wording"].map((n) => `${repo}/supabase/isexy-migrations/${n}.sql`), ...extra];
  for (const f of files) {
    try { await db.exec(`BEGIN;\n${strip(readFileSync(f, "utf8"))}\nCOMMIT;`); }
    catch (e) { console.log(`FAILED ${f}: ${e.message}`); try { await db.exec("ROLLBACK"); } catch {} process.exit(1); }
  }
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (uid, fn) => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${uid}'; SET request.jwt.claim.role = 'authenticated';`);
    try { return await fn(); } finally { await db.exec("RESET ROLE; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;"); }
  };
  return { db, q, as };
}
