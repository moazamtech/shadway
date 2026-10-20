import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * The indexes a schema diff cannot carry.
 *
 * A component's author is a record, and the two things anyone looks up in it
 * are the handle and the account. Postgres can index an expression, so the
 * index is on the value rather than on the whole record — an index on the
 * record would be a copy of every author's name and picture in the table, and
 * a lookup by handle would still have to read the record to find out.
 *
 * The schema declares the same two indexes, so the shape is written down
 * where the tables are; they are created here because a diff cannot express
 * an expression and a push would drop it.
 *
 *   npx tsx scripts/db-indexes.ts
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    create index if not exists components_author_username_idx
    on components ((author->>'username'))
  `;
  await sql`
    create index if not exists components_author_user_id_idx
    on components ((author->>'userId'))
  `;

  console.log("the author indexes are in place");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
