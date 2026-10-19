import "dotenv/config";

import { connectToDatabase } from "../lib/mongodb";
import { syncAuthorAvatar } from "../lib/db/components";

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
  const { db } = await connectToDatabase();

  const users = db.collection("users");
  const withAvatar = await users
    .find({ avatar: { $exists: true, $nin: ["", null] } })
    .project({ avatar: 1 })
    .toArray();

  let touched = 0;
  for (const user of withAvatar) {
    const id = user._id.toString();
    const avatar = user.avatar as string;
    await syncAuthorAvatar(id, avatar);
    touched += 1;
  }

  console.log(`Synced the author picture on ${touched} account(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
