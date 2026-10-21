import { notFound } from "next/navigation";

/**
 * The page that says there is nothing here.
 *
 * The marketplace's pages live under a layout that keeps the shell on screen
 * while a page is on its way — which is what stops a navigation from blanking
 * the screen. A boundary that does that also swallows the answer a page gives
 * when there is nothing to show, so the answer has to be given from
 * somewhere the boundary does not reach: this route throws it with nothing
 * between it and the server, and the status line says 404.
 */
export default function MissingPage() {
  notFound();
}
