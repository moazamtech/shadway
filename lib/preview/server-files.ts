import { componentSourceFiles } from "./files";
import { withShadcnFiles, type PreviewFileInput } from "./shadcn-ui";

/**
 * The previewable file set for a stored component, with the shadcn/ui files
 * it imports added on top.
 *
 * This is the server-side entry point: the vendored registry data is a few
 * hundred kilobytes, so it is only imported by the routes and scripts that
 * build previews, never by the client components that render them.
 */
export function componentPreviewFiles(component: {
  code: string;
  /** Where the author keeps the component inside the project. */
  componentPath?: string;
  demoCode?: string;
  styleCode?: string;
  files?: { path: string; content: string }[];
}): PreviewFileInput[] {
  return withShadcnFiles(componentSourceFiles(component));
}

export { withShadcnFiles };
export type { PreviewFileInput };
