import "dotenv/config";

/**
 * Verifies the single auth gate.
 *
 * Protected surfaces must redirect a signed-out visitor to /login, while public
 * surfaces — including the CLI registry endpoints — must stay open. Run with a
 * dev server up:
 *
 *   BASE=http://localhost:3111 npx tsx scripts/qa-auth.ts
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

let failures = 0;

function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

/** Redirects must be observed, not followed. */
async function probe(path: string) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
  };
}

function isLoginRedirect(status: number, location: string, wants: string) {
  if (![302, 303, 307, 308].includes(status)) return false;
  if (!location.includes("/login")) return false;
  return location.includes(encodeURIComponent(wants)) || location.includes(wants);
}

async function main() {
  // ------------------------------------------------- protected: any user --
  for (const path of ["/studio", "/studio/anything", "/bundles/new", "/profile", "/bookmarks"]) {
    const { status, location } = await probe(path);
    log(
      `${path} -> /login`,
      isLoginRedirect(status, location, path),
      `status=${status} loc=${location.split("?")[1] ?? location}`
    );
  }

  // -------------------------------------------------- protected: admin ----
  const admin = await probe("/admin/dashboard");
  log(
    "/admin/dashboard -> /login",
    isLoginRedirect(admin.status, admin.location, "/admin/dashboard"),
    `status=${admin.status}`
  );

  // The retired admin login must not bounce back into itself.
  const adminLogin = await probe("/admin/login");
  log(
    "/admin/login redirects to /login (no loop)",
    [307, 308, 302, 303].includes(adminLogin.status) &&
      adminLogin.location.includes("/login"),
    `status=${adminLogin.status} loc=${adminLogin.location}`
  );

  // ------------------------------------------------------------- public ---
  for (const path of ["/", "/bundles", "/login", "/r/pulse-button", "/r/bundle/nope", "/api/bundles"]) {
    const { status } = await probe(path);
    log(`${path} stays public`, status === 200 || status === 404 || status === 409, `status=${status}`);
  }

  // A public bundle detail page must not be behind auth.
  const detail = await probe("/bundles/some-public-slug");
  log(
    "/bundles/<slug> stays public (404 not redirect)",
    detail.status === 404,
    `status=${detail.status}`
  );

  // --------------------------------------------------------------- login --
  const login = await fetch(`${BASE}/login`);
  const html = await login.text();
  log("login page renders", login.ok && html.includes("<html"), `status=${login.status}`);
  // The form itself is client-rendered inside Suspense (it reads the
  // callbackUrl via useSearchParams), so only assert the shell here. The
  // callbackUrl contract is covered by the redirect checks above.
  log("login page is HTML", /<html/i.test(html));

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll auth checks passed");
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 300));
  process.exit(1);
});
