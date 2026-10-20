import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * One column, one type.
 *
 * The gallery's author was a text field in Postgres and a record in the data
 * that was copied across, and Postgres will not change a column's type on its
 * own. The column is dropped and added back — the data is in the migration
 * script, and it is about to be written again anyway.
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`ALTER TABLE vibecode DROP COLUMN IF EXISTS created_by`;
  await sql`ALTER TABLE vibecode ADD COLUMN created_by jsonb`;
  console.log("vibecode.created_by is jsonb again");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
