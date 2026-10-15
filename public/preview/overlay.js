/*
 * The preview error overlay.
 *
 * A custom element the preview documents mount when a build fails, so a broken
 * file shows the same panel a dev server prints — the message, the file, the
 * code frame, the stack — instead of a blank canvas. It follows the preview
 * theme (the document's `.dark` class) and dismisses on click-away or Esc.
 *
 * Loaded as a module by both preview engines: the studio's browser-side iframe
 * (`components/preview/local-preview.tsx`) and the published preview bundle
 * (`lib/preview/bundle.ts`).
 */

const OVERLAY_ID = "preview-error-overlay";

const templateStyle = /* css */ `
:host {
  --mono: 'SFMono-Regular', ui-monospace, Consolas, 'Liberation Mono', Menlo, monospace;
  --surface: #ffffff;
  --surface-muted: #f4f4f5;
  --text: #18181b;
  --text-muted: #71717a;
  --border: rgba(0, 0, 0, 0.12);
  --danger: #b91c1c;
  --danger-soft: rgba(239, 68, 68, 0.08);
  --link: #0369a1;
  display: block;
}

:host(.dark) {
  --surface: #0b0b0c;
  --surface-muted: #18181b;
  --text: #e5e5e5;
  --text-muted: #a1a1aa;
  --border: rgba(255, 255, 255, 0.1);
  --danger: #f87171;
  --danger-soft: rgba(239, 68, 68, 0.12);
  --link: #7dd3fc;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  overflow: auto;
  padding: 6vh 4vw;
  background: rgba(0, 0, 0, 0.5);
}

.window {
  max-width: 880px;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.6;
  overflow: hidden;
  text-align: left;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--danger-soft);
  color: var(--danger);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
}

.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
}

.body {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.title {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
}

.message {
  margin: 0;
  color: var(--danger);
  white-space: pre-wrap;
  word-break: break-word;
}

.file {
  margin: 0;
  color: var(--link);
  font-size: 12px;
  word-break: break-all;
}

.frame {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
  font-size: 12px;
  white-space: pre;
  overflow-x: auto;
}

.stack {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  color: var(--text-muted);
  font-size: 11.5px;
  white-space: pre-wrap;
}

.tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 11.5px;
}

kbd {
  padding: 3px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-muted);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
}
`;

function h(element, attrs = {}, ...children) {
  const node = document.createElement(element);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function createTemplate() {
  return h(
    "div",
    { class: "backdrop" },
    h(
      "div",
      { class: "window" },
      h("div", { class: "header" }, h("span", { class: "header-dot" }), "Build error"),
      h(
        "div",
        { class: "body" },
        h("p", { class: "title" }),
        h("pre", { class: "message" }),
        h("pre", { class: "file" }),
        h("pre", { class: "frame" }),
        h("pre", { class: "stack" })
      ),
      h("div", { class: "tip" }, "Fix the file and the preview rebuilds — click outside or press ", h("kbd", {}, "Esc"), " to dismiss.")
    ),
    h("style", {}, templateStyle)
  );
}

/** `> 12 | broken code | ^` blocks read better in their own panel. */
const codeFrameRE = /^(?:>?\s*\d+\s+\|.*|\s+\|\s*\^.*)\r?\n/gm;

class PreviewErrorOverlay extends HTMLElement {
  constructor(error = {}) {
    super();
    const dark = document.documentElement.classList.contains("dark");
    if (dark) this.classList.add("dark");

    this.root = this.attachShadow({ mode: "open" });
    this.root.appendChild(createTemplate());

    const hasFrame = typeof error.frame === "string" && error.frame.trim();
    const message = hasFrame ? String(error.message).replace(codeFrameRE, "") : error.message;
    this.set(".message", String(message || "Unknown error").trim());

    const file = String(error.loc?.file || error.id || "").split("?")[0];
    if (error.loc) {
      this.set(".file", `${file}:${error.loc.line}:${error.loc.column ?? 1}`);
    } else if (file) {
      this.set(".file", file);
    }

    if (hasFrame) this.set(".frame", String(error.frame).trim());
    this.set(".stack", error.stack ? String(error.stack) : "");
    this.set(".title", error.title || "Unhandled error");

    this.root.querySelector(".window").addEventListener("click", (event) => {
      event.stopPropagation();
    });
    this.addEventListener("click", () => this.close());
    this.closeOnEsc = (event) => {
      if (event.key === "Escape" || event.code === "Escape") this.close();
    };
    document.addEventListener("keydown", this.closeOnEsc);
  }

  set(selector, text) {
    const node = this.root.querySelector(selector);
    if (!text) {
      node.remove();
      return;
    }
    node.textContent = text;
  }

  close() {
    this.parentNode?.removeChild(this);
    document.removeEventListener("keydown", this.closeOnEsc);
  }
}

if (!customElements.get(OVERLAY_ID)) {
  customElements.define(OVERLAY_ID, PreviewErrorOverlay);
}
