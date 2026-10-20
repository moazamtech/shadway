import "dotenv/config";

import { db } from "../lib/db/postgres";
import { components } from "../lib/db/schema";

/**
 * Empty the catalogue.
 *
 * A destructive tool, and it says so: every published component, its source
 * and its built preview go. The registry on the other side of the site reads
 * the same rows, so this is the "start the exchange over" button.
 */
async function clean() {
  await db().delete(components);
  console.log("Cleared the components table.");
}

clean()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
