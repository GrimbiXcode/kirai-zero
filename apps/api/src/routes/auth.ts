import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { loginSchema, registerSchema } from "shared";
import { users } from "../db/schema";
import { authenticate, currentUser, sessionCookieOptions } from "../lib/auth";
import { toCurrentUser } from "../lib/dto";
import { conflict, unauthorized } from "../lib/errors";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password";
import {
  createSession,
  destroySession,
  SESSION_COOKIE,
} from "../lib/sessions";
import { parse } from "../lib/validate";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const input = parse(registerSchema, request.body);
    const passwordHash = await hashPassword(input.password);

    const inserted = await app.db
      .insert(users)
      .values({
        email: input.email,
        handle: input.handle,
        displayName: input.displayName,
        passwordHash,
      })
      .onConflictDoNothing()
      .returning();

    const user = inserted[0];
    if (!user) {
      // Either the email or the handle is taken. Which one is not disclosed
      // for the email, since that would confirm an account exists; the handle
      // is public by design, so a generic message covers both.
      throw conflict("account_exists", "Email or handle already in use");
    }

    const { token, expiresAt } = await createSession(app.db, user.id);
    reply.setCookie(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(app.appEnv.COOKIE_SECURE, expiresAt),
    );
    return reply.code(201).send({ user: toCurrentUser(user), token });
  });

  app.post("/login", { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const input = parse(loginSchema, request.body);

    const rows = await app.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    const user = rows[0];

    const ok = await verifyPassword(
      user?.passwordHash ?? (await getDummyHash()),
      input.password,
    );
    if (!user || !ok) {
      throw unauthorized("invalid_credentials", "Email or password is wrong");
    }

    const { token, expiresAt } = await createSession(app.db, user.id);
    reply.setCookie(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(app.appEnv.COOKIE_SECURE, expiresAt),
    );
    return { user: toCurrentUser(user), token };
  });

  app.post("/logout", async (request, reply) => {
    const cookie = request.cookies[SESSION_COOKIE];
    const header = request.headers.authorization;
    const token = cookie ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
    if (token) await destroySession(app.db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/me", { preHandler: authenticate }, async (request) => {
    return { user: toCurrentUser(currentUser(request)) };
  });
}
