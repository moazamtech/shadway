import "dotenv/config";

/**
 * Verifies the single auth gate.
 *
 * Protected surfaces must redirect a signed-out visitor to /login, while public
 * surfaces — including the CLI registry endpoints — must stay open. A CLI never
 * follows a login redirect usefully: it receives HTML where it expected JSON and
 * reports a parse error, so "is this endpoint protected?" is a real distinction
 * and not a formality.
 *
 * Run with a dev server up:
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
  //
  // `/settings` is guarded by the page rather than the middleware matcher, and
  // that is fine — what matters here is that a signed-out visitor cannot reach
  // it, not which layer says so.
  for (const path of ["/studio", "/studio/anything", "/settings", "/profile", "/bookmarks"]) {
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
  //
  // These are asserted by *shape*, not by seeded content: a QA script that
  // requires `particles` to exist fails the day somebody unpublishes it, and the
  // question here is whether the route is behind the login gate at all.
  for (const path of ["/", "/login", "/api/components", "/c/does-not-exist", "/u/does-not-exist"]) {
    const { status, location } = await probe(path);
    log(
      `${path} is not behind the login gate`,
      !isLoginRedirect(status, location, path),
      `status=${status}`
    );
  }

  /**
   * The registry endpoint the CLI calls, for a slug that does not exist.
   *
   * Two things are load-bearing and neither is obvious: it must be a JSON 404
   * rather than a redirect (the CLI parses the body), and it must not be
   * `200`, because the CLI would then install an empty item and report success.
   */
  const missingItem = await fetch(`${BASE}/r/does-not-exist`, { redirect: "manual" });
  const missingBody = await missingItem.text();
  log(
    "an unknown registry item is a JSON 404",
    missingItem.status === 404 &&
      (missingItem.headers.get("content-type") ?? "").includes("application/json"),
    `status=${missingItem.status}`
  );
  log(
    "the registry 404 has a body the CLI can print",
    missingBody.includes("error"),
    `body=${missingBody.slice(0, 60)}`
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
