import type { FastifyReply, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "./errors";
import { resolveSession, SESSION_COOKIE, type AuthenticatedUser } from "./sessions";

type TokenSource = "cookie" | "bearer";

function extractToken(
  request: FastifyRequest,
): { token: string; source: TokenSource } | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) return { token, source: "bearer" };
  }
  const cookie = request.cookies[SESSION_COOKIE];
  if (cookie) return { token: cookie, source: "cookie" };
  return null;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * preHandler for every route that needs a signed-in user.
 *
 * Two transports are accepted because the app ships to two very different
 * runtimes: the web build is same-site and uses a httpOnly cookie, while the
 * Capacitor build runs from `capacitor://localhost` and therefore sends the
 * token as a bearer header out of secure device storage.
 *
 * Cookie-authenticated writes additionally require an allowed Origin. Combined
 * with SameSite=Lax that closes CSRF without a token dance; bearer requests are
 * immune to CSRF by construction since no browser attaches the header for them.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const extracted = extractToken(request);
  if (!extracted) throw unauthorized();

  if (extracted.source === "cookie" && !SAFE_METHODS.has(request.method)) {
    const origin = request.headers.origin;
    if (!origin || !request.server.appEnv.CORS_ORIGINS.includes(origin)) {
      throw forbidden("bad_origin", "Origin not allowed for this request");
    }
  }

  const user = await resolveSession(request.server.db, extracted.token);
  if (!user) throw unauthorized("session_invalid", "Session expired");

  request.currentUser = user;
}

/** Narrows the optional request property after `authenticate` has run. */
export function currentUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.currentUser) throw unauthorized();
  return request.currentUser;
}

export function sessionCookieOptions(secure: boolean, expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires,
  };
}
