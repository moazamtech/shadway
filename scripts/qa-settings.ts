import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../lib/mongodb";

const BASE = process.env.BASE ?? "http://localhost:3000";

const jar: Record<string, string> = {};
function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function collect(res: Response) {
  const raw: string[] =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [];
  for (const c of raw) {
    const first = c.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar[first.slice(0, i).trim()] = first.slice(i + 1).trim();
  }
}
async function req(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { cookie: cookieHeader(), ...(init?.headers as any) },
    redirect: "manual",
  });
  collect(r);
  return r;
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const clientState = await connectToDatabase();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-settings-${suffix}@shadway.test`;
  const initial = "qa-password-1234";
  const changed = "changed-password-9876";
  try {
    const hash = await bcrypt.hash(initial, 12);
    const u = await clientState.db.collection("users").insertOne({
      email,
      password: hash,
      name: "QA Settings",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const userId = u.insertedId.toString();

    // Login.
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
      headers: { cookie: cookieHeader() },
    });
    collect(csrfRes);
    const csrf = await csrfRes.json();
    const params = new URLSearchParams();
    params.set("csrfToken", csrf.csrfToken);
    params.set("email", email);
    params.set("password", initial);
    params.set("callbackUrl", `${BASE}/`);
    params.set("json", "true");
    const cb = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
      body: params.toString(),
      redirect: "manual",
    });
    collect(cb);
    log("login", cb.status === 200, `status=${cb.status}`);

    // GET /api/me
    let r = await req("/api/me");
    const me = await r.json();
    log("GET /api/me", r.ok && me?.item?.email === email, `email=${me?.item?.email}`);
    const originalName = me?.item?.name;

    // PATCH name
    r = await req("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed QA" }),
    });
    log("PATCH name", r.status === 200, `status=${r.status}`);

    // Re-fetch, expect new name.
    r = await req("/api/me");
    const me2 = await r.json();
    log("name persisted", me2?.item?.name === "Renamed QA", `name=${me2?.item?.name}`);

    // PATCH password (with current password).
    r = await req("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: initial,
        newPassword: changed,
      }),
    });
    log("PATCH password", r.status === 200, `status=${r.status}`);

    // Wrong current password -> rejected.
    Object.keys(jar).forEach((k) => delete jar[k]);
    const csrfRes2 = await fetch(`${BASE}/api/auth/csrf`, {
      headers: { cookie: cookieHeader() },
    });
    collect(csrfRes2);
    const csrf2 = await csrfRes2.json();
    const p2 = new URLSearchParams();
    p2.set("csrfToken", csrf2.csrfToken);
    p2.set("email", email);
    p2.set("password", changed);
    p2.set("callbackUrl", `${BASE}/`);
    p2.set("json", "true");
    await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
      body: p2.toString(),
      redirect: "manual",
    }).then((res) => collect(res));
    log(
      "login with new password works",
      cb.status === 200,
      `status=${cb.status}`,
    );

    // /settings page renders for authed user.
    r = await req("/settings");
    log("/settings renders 200", r.status === 200, `status=${r.status}`);
  } catch (e) {
    console.error("FATAL:", String(e).slice(0, 400));
    failures += 1;
  } finally {
    try {
      await clientState.db.collection("users").deleteMany({ email });
    } catch {}
  }
  console.log(failures === 0 ? "\nALL SETTINGS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures) process.exitCode = 1;
}

main();
