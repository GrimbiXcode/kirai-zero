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
 * The origin this very request was addressed to. Behind a proxy Fastify
 * derives both parts from the forwarded headers, which is why `trustProxy` is
 * on in production.
 */
function ownOrigin(request: FastifyRequest): string {
  return `${request.protocol}://${request.host}`;
}

/**
 * preHandler for every route that needs a signed-in user.
 *
 * Two transports are accepted because the app ships to two very different
 * runtimes: the web build is same-site and uses a httpOnly cookie, while the
 * Capacitor build runs from `capacitor://localhost` and therefore sends the
 * token as a bearer header out of secure device storage.
 *
 * Cookie-authenticated writes additionally require the Origin to be either the
 * server's own — the container image serves the web client from here, so those
 * requests are same-origin and cannot be forged from another site — or one of
 * the configured ones. Combined with SameSite=Lax that closes CSRF without a
 * token dance; bearer requests are immune by construction, since no browser
 * attaches that header on its own.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const extracted = extractToken(request);
  if (!extracted) throw unauthorized();

  if (extracted.source === "cookie" && !SAFE_METHODS.has(request.method)) {
    const origin = request.headers.origin;
    const allowed =
      origin !== undefined &&
      (origin === ownOrigin(request) ||
        request.server.appEnv.CORS_ORIGINS.includes(origin));
    if (!allowed) {
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
