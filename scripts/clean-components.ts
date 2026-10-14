import "dotenv/config";
import { connectToDatabase } from "../lib/mongodb";

async function clean() {
  const { db } = await connectToDatabase();
  await db.collection("components").deleteMany({});
  console.log("Cleared components collection.");
}

clean().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
