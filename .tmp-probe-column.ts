import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const deleted = await sql`
    delete from vibecode where id in ('__probe_created_by__', '__probe_created_by_text__')
    returning id
  `;
  console.log("deleted:", deleted);
  const counts = await sql`select count(*)::int as count from vibecode`;
  console.log("count:", counts);
  const kinds = await sql`
    select jsonb_typeof(created_by) as kind, count(*)::int as count
    from vibecode group by 1
  `;
  console.log("kinds:", kinds);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
