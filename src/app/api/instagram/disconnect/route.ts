import { disconnectAccount, getActiveAccount } from "@/lib/db/accounts";
import { getSql } from "@/lib/db/client";

/** Deletes the stored token (data already synced is kept). */
export async function POST() {
  const sql = getSql();
  const account = await getActiveAccount(sql);
  if (account) await disconnectAccount(sql, account.id);
  return Response.json({ ok: true });
}
