import type { ReactNode } from "react";

import { AppShell } from "@/components/marketplace/app-shell";
import { TOOLBAR_SLOT_ID } from "@/components/marketplace/shell-toolbar";

/**
 * The shell the marketplace is drawn in.
 *
 * The shell lives here rather than in each page, and that is the whole point
 * of it being here: a page that is a shell of its own is replaced wholesale
 * when the reader goes somewhere else, so the page they were on goes and the
 * page they asked for has not arrived, and what is in between is a blank
 * screen. A shell in the layout is not replaced — the reader keeps the rail,
 * the header and the frame, and only the content changes under them.
 *
 * The header is the page's: each page says what belongs in it with the
 * `ShellToolbar`, which is drawn into the slot below.
 *
 * There is no boundary around the pages, and that is deliberate twice over. A
 * boundary here would catch the pages that wait for the database — and a page
 * that answers "there is no such thing" from inside one of them comes back
 * with the answer in the stream instead of in the status line, which is a 404
 * that reads as a 200 to everything that matters: a crawler and a cache. It
 * would also mean the page's own content arrives in a second piece, so the
 * document a crawler fetches is a shell with nothing in it.
 *
 * So the pages answer in one piece, and the speed comes from the catalogue's
 * memory instead: the answers are kept for a moment, and the pages that show
 * them are quick.
 */
export default function MarketplaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppShell
      toolbar={
        <div
          id={TOOLBAR_SLOT_ID}
          className="flex min-w-0 flex-1 items-center gap-2"
        />
      }
    >
      {children}
    </AppShell>
  );
}
