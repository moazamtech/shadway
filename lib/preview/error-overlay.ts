/**
 * The error surface shared by every preview engine (studio iframe and
 * published component pages).
 *
 * The overlay itself is Vite's own `vite-error-overlay` custom element
 * (vendored into `public/preview/vite-overlay.js`), so a crash here looks
 * exactly like a crash in a Vite + React dev server: the red window, the
 * message, the code frame, the stack, click-away or Esc to dismiss.
 *
 * This script only *routes* errors into it:
 *   - `window.onerror` / unhandled rejections
 *   - module resolution failures, rewritten into Vite's wording
 *     ("Failed to resolve import "@/x" from "src/y.tsx". Does the file exist?")
 *   - build errors handed over as `window.__shadwayBuildError`
 * Blob URLs inside stack traces are mapped back to the project file paths.
 */

export const PREVIEW_ERROR_CSS = `
.twp-fallback{position:fixed;top:0;left:0;right:0;z-index:2147483647;margin:0;padding:12px 14px;max-height:60%;overflow:auto;background:#18181b;border-bottom:1px solid #ef4444;color:#fda4af;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
`;

export const PREVIEW_ERROR_SCRIPT = `
(function () {
  var lastMessage = null;

  function fallback(message, stack) {
    var el = document.createElement("pre");
    el.className = "twp-fallback";
    el.textContent = message + (stack ? "\\n\\n" + stack : "");
    (document.body || document.documentElement).appendChild(el);
  }

  /** Blob URLs read as noise; show the file the module came from instead. */
  function prettyStack(stack) {
    if (!stack) return "";
    var map = window.__shadwayBlobMap || {};
    var out = String(stack);
    for (var url in map) {
      out = out.split(url).join(map[url]);
    }
    return out;
  }

  /**
   * The browser reports a bare "Failed to resolve module specifier" TypeError;
   * a Vite dev server reports the import and the importing file instead.
   */
  function asImportError(message) {
    var match = /Failed to (?:resolve module specifier|fetch dynamically imported module)[^"']*["']([^"']+)["']/.exec(message);
    if (!match) return null;
    var specifier = match[1];
    var entries = window.__shadwayUnresolved || [];
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].specifier === specifier) return entries[i];
    }
    return { specifier: specifier, from: "" };
  }

  function show(options) {
    if (options.message && options.message === lastMessage) return;
    lastMessage = options.message || "";

    function mount() {
      var Overlay = customElements.get("vite-error-overlay");
      if (!Overlay) return false;
      var existing = document.querySelectorAll("vite-error-overlay");
      for (var i = 0; i < existing.length; i += 1) existing[i].remove();
      var payload = {
        message: options.message || "Unknown error",
        stack: prettyStack(options.stack),
        id: options.file || undefined,
        frame: options.frame || undefined,
      };
      if (options.loc) payload.loc = options.loc;
      var element = new Overlay(payload);
      (document.body || document.documentElement).appendChild(element);
      return true;
    }

    if (mount()) return;
    // The overlay module may still be loading — give it a moment, then fall
    // back to a plain panel so the error is never swallowed.
    customElements.whenDefined("vite-error-overlay").then(mount);
    setTimeout(function () {
      if (!customElements.get("vite-error-overlay")) {
        fallback(options.message, options.stack);
      }
    }, 2500);
  }

  window.__shadwayPreviewError = show;

  window.addEventListener("error", function (event) {
    var target = event.target;
    if (target && target !== window && target.tagName) {
      var url = target.src || target.href || "(unknown source)";
      show({ message: "Failed to load " + target.tagName.toLowerCase() + ": " + url });
      return;
    }

    var message = event.message || "Script error";
    var import_ = asImportError(message);
    if (import_) {
      show({
        message:
          'Failed to resolve import "' + import_.specifier + '" from "' +
          (import_.from || "your project") + '". Does the file exist?',
        file: import_.from || undefined,
      });
      return;
    }

    show({
      message: message,
      stack: event.error && event.error.stack ? event.error.stack : "",
    });
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    show({
      message: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack ? reason.stack : "",
    });
  });

  function showBuildError() {
    var error = window.__shadwayBuildError;
    if (!error) return;
    show({
      message: error.message || "Build failed",
      stack: "",
      file: error.file || undefined,
      frame: error.frame || undefined,
      loc: error.loc || undefined,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showBuildError);
  } else {
    showBuildError();
  }
})();
`;
