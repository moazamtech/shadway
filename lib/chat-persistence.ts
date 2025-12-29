type PersistedMessage = {
  id: string;
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export type PersistedChatSession = {
  id: string;
  title: string;
  createdAt: number;
  model: string;
  messages: PersistedMessage[];
};

export type PersistedChatState = {
  activeSessionId: string;
  sessions: PersistedChatSession[];
};

const CHAT_PERSIST_VERSION = 2;
export const CHAT_PERSIST_COOKIE_NAME = "chatbot_meta_v2";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const STORAGE_PREFIX = "chatbot_session_v2:";

type CookieMeta = {
  v: number;
  activeSessionId?: string;
  sessions?: Array<{
    id: string;
    title: string;
    createdAt: number;
    model: string;
  }>;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie || "";
  const parts = cookie.split(/;\s*/g);
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const isHttps =
    typeof window !== "undefined" && window.location?.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sessionStorageKey(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

function loadSessionFromStorage(id: string): PersistedChatSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(sessionStorageKey(id));
    const parsed = safeJsonParse<PersistedChatSession>(raw);
    if (!parsed || parsed.id !== id) return null;
    if (!Array.isArray(parsed.messages)) parsed.messages = [];
    return parsed;
  } catch {
    return null;
  }
}

function saveSessionToStorage(session: PersistedChatSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      sessionStorageKey(session.id),
      JSON.stringify(session),
    );
  } catch {
    // ignore quota errors
  }
}

export function loadChatState(): PersistedChatState | null {
  if (typeof window === "undefined") return null;

  const meta = safeJsonParse<CookieMeta>(readCookie(CHAT_PERSIST_COOKIE_NAME));
  if (
    meta &&
    meta.v === CHAT_PERSIST_VERSION &&
    Array.isArray(meta.sessions) &&
    meta.sessions.length > 0
  ) {
    const sessions: PersistedChatSession[] = [];
    for (const s of meta.sessions) {
      if (!s || typeof s.id !== "string") continue;
      const fromStorage = loadSessionFromStorage(s.id);
      if (fromStorage) {
        sessions.push(fromStorage);
        continue;
      }
      sessions.push({
        id: s.id,
        title: typeof s.title === "string" ? s.title : "New chat",
        createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now(),
        model: typeof s.model === "string" ? s.model : "",
        messages: [],
      });
    }

    return {
      activeSessionId:
        typeof meta.activeSessionId === "string" ? meta.activeSessionId : "",
      sessions,
    };
  }

  // Fallback: cookie got wiped but localStorage remains (common in production)
  const discovered: PersistedChatSession[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const id = key.slice(STORAGE_PREFIX.length);
      const session = loadSessionFromStorage(id);
      if (session) discovered.push(session);
    }
  } catch {
    // ignore
  }

  if (discovered.length === 0) return null;
  discovered.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { activeSessionId: discovered[0]?.id ?? "", sessions: discovered };
}

export function persistChatState(state: PersistedChatState) {
  if (typeof window === "undefined") return;

  const sessions = state.sessions ?? [];
  const meta: CookieMeta = {
    v: CHAT_PERSIST_VERSION,
    activeSessionId: state.activeSessionId || "",
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      model: s.model,
    })),
  };

  try {
    writeCookie(
      CHAT_PERSIST_COOKIE_NAME,
      JSON.stringify(meta),
      COOKIE_MAX_AGE_SECONDS,
    );
  } catch {
    // ignore
  }

  const keepIds = new Set(sessions.map((s) => s.id));
  for (const s of sessions) saveSessionToStorage(s);

  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const id = key.slice(STORAGE_PREFIX.length);
      if (!keepIds.has(id)) window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function purgePersistedChat() {
  if (typeof window === "undefined") return;
  writeCookie(CHAT_PERSIST_COOKIE_NAME, "", 0);
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
