import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  emailVerifySchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
  type EmailTokenPurpose,
} from "shared";
import { users, type UserRow } from "../db/schema";
import { authenticate, currentUser, sessionCookieOptions } from "../lib/auth";
import { toCurrentUser } from "../lib/dto";
import {
  consumeToken,
  deleteTokensFor,
  issueToken,
  tokenTtlMinutes,
} from "../lib/email-tokens";
import { badRequest, conflict, unauthorized } from "../lib/errors";
import {
  deliver,
  passwordChangedMail,
  passwordResetMail,
  verifyEmailMail,
} from "../lib/mail";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  SESSION_COOKIE,
} from "../lib/sessions";
import { parse } from "../lib/validate";

/**
 * Where a mailed link points. Deliberately the web client and not the API: a
 * GET endpoint would be fetched by the link previews and virus scanners that
 * sit between a mail server and an inbox, burning the single-use token before
 * anyone clicks it. The page behind these paths posts the token instead.
 */
const LINK_PATHS: Record<EmailTokenPurpose, string> = {
  verify_email: "/e-mail-bestaetigen",
  password_reset: "/passwort-neu",
};

function linkFor(
  appUrl: string | undefined,
  purpose: EmailTokenPurpose,
  token: string,
): string {
  // Without APP_URL there is no SMTP either (loadEnv ties them together), so
  // this only ever feeds the log transport in development.
  const base = appUrl ?? "http://localhost:5173";
  return `${base}${LINK_PATHS[purpose]}?token=${encodeURIComponent(token)}`;
}

async function sendVerificationMail(
  app: FastifyInstance,
  user: Pick<UserRow, "id" | "email" | "displayName">,
): Promise<void> {
  const { token } = await issueToken(app.db, user.id, "verify_email");
  await deliver(
    app.mailer,
    verifyEmailMail({
      to: user.email,
      displayName: user.displayName,
      url: linkFor(app.appEnv.APP_URL, "verify_email", token),
      ttlDays: Math.round(tokenTtlMinutes("verify_email") / (24 * 60)),
    }),
    app.log,
  );
}

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

    // The account is usable straight away; confirming the address is a task
    // waiting in the inbox, not a gate in front of the product.
    await sendVerificationMail(app, user);

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

  /**
   * Confirms the address behind a mailed link. The rate limit is there for the
   * same reason as on login: the token is short-lived but guessable in
   * principle, and nothing should be allowed to try at speed.
   */
  app.post(
    "/verify-email",
    { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (request) => {
      const input = parse(emailVerifySchema, request.body);
      const consumed = await consumeToken(app.db, input.token, "verify_email");
      if (!consumed) {
        throw badRequest("token_invalid", "Token unknown, expired or used");
      }

      const updated = await app.db
        .update(users)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, consumed.userId))
        .returning();

      const user = updated[0];
      if (!user) {
        throw badRequest("token_invalid", "Token unknown, expired or used");
      }
      return { user: toCurrentUser(user) };
    },
  );

  /** Authenticated: only the person already holding the account can ask for
   *  another copy, which keeps this from becoming a way to mail strangers. */
  app.post(
    "/resend-verification",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const viewer = currentUser(request);
      if (viewer.emailVerifiedAt === null) {
        await sendVerificationMail(app, viewer);
      }
      return reply.code(204).send();
    },
  );

  /**
   * Starts a password reset.
   *
   * Answers 204 with an empty body whether or not the address belongs to an
   * account — the same rule the login route follows, and for the same reason:
   * an endpoint that answers differently is a way to test which addresses are
   * registered here (docs/decisions.md, entry 5). The mail goes out after the
   * reply, so the response time does not give it away either.
   */
  app.post(
    "/password-reset",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const input = parse(passwordResetRequestSchema, request.body);

      const rows = await app.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      const user = rows[0];

      if (user && user.deletedAt === null) {
        const { token } = await issueToken(
          app.db,
          user.id,
          "password_reset",
        );
        await deliver(
          app.mailer,
          passwordResetMail({
            to: user.email,
            displayName: user.displayName,
            url: linkFor(app.appEnv.APP_URL, "password_reset", token),
            ttlMinutes: tokenTtlMinutes("password_reset"),
          }),
          app.log,
        );
      }

      return reply.code(204).send();
    },
  );

  /**
   * Finishes the reset. Four things happen together, and each of them matters:
   *
   * - the new password is stored
   * - every session is destroyed. Whoever had taken the account over is signed
   *   out in the same second; leaving them in would defeat the whole exercise
   * - the address counts as confirmed, because reading this token proves the
   *   mailbox is reachable — there is nothing left for a banner to ask for
   * - the account's remaining tokens go, so a second link lying in the inbox
   *   is dead
   *
   * The response carries no session: the new password gets typed once more on
   * the sign-in screen, which is also where a password manager picks it up.
   */
  app.post(
    "/password-reset/confirm",
    { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const input = parse(passwordResetConfirmSchema, request.body);
      const consumed = await consumeToken(
        app.db,
        input.token,
        "password_reset",
      );
      if (!consumed) {
        throw badRequest("token_invalid", "Token unknown, expired or used");
      }

      const passwordHash = await hashPassword(input.password);
      const now = new Date();

      const updated = await app.db.transaction(async (tx) => {
        const rows = await tx
          .update(users)
          .set({
            passwordHash,
            emailVerifiedAt: now,
            updatedAt: now,
          })
          .where(eq(users.id, consumed.userId))
          .returning();
        await destroyAllSessions(tx, consumed.userId);
        await deleteTokensFor(tx, consumed.userId);
        return rows[0];
      });

      if (!updated) {
        throw badRequest("token_invalid", "Token unknown, expired or used");
      }

      await deliver(
        app.mailer,
        passwordChangedMail({
          to: updated.email,
          displayName: updated.displayName,
          supportEmail: app.appEnv.SUPPORT_EMAIL,
        }),
        app.log,
      );

      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return reply.code(204).send();
    },
  );
}
