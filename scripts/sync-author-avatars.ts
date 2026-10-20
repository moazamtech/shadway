import "dotenv/config";

import { db } from "../lib/db/postgres";
import { syncAuthorAvatar } from "../lib/db/components";
import { users } from "../lib/db/schema";
import { isNotNull } from "drizzle-orm";

/**
 * Brings the author pictures on existing components back in step with the
 * accounts they belong to.
 *
 * `syncAuthorAvatar` keeps the copies current from the moment a picture
 * changes. This is the other half: components published *before* the account
 * had a picture at all still carry the empty one they were written with, and
 * nothing would ever touch them again.
 *
 * It is idempotent — it writes the account's picture onto the copies, and
 * writes nothing where the copy already agrees.
 *
 *   npx tsx scripts/sync-author-avatars.ts
 */

async function main() {
  const client = db();

  const withAvatar = await client
    .select({ id: users.id, avatar: users.avatar })
    .from(users)
    .where(isNotNull(users.avatar));

  let touched = 0;
  for (const user of withAvatar) {
    if (!user.avatar) continue;
    await syncAuthorAvatar(user.id, user.avatar);
    touched += 1;
  }

  console.log(`Synced the author picture on ${touched} account(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
