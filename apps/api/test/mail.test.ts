import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, sql as raw } from "drizzle-orm";
import { emailTokens, users } from "../src/db/schema";
import type { Mail, MemoryMailer } from "../src/lib/mail";
import {
  createTestApp,
  registerUser,
  resetData,
  TEST_APP_URL,
  TEST_DATABASE_URL,
  type TestUser,
} from "./helpers";

let app: FastifyInstance;
let mailer: MemoryMailer;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ app, mailer, close } = await createTestApp());
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await resetData(app);
  mailer.clear();
});

/** The token out of the one link a mail carries. Fails loudly rather than
 *  returning undefined, so a broken template shows up as a broken template. */
function tokenFrom(mail: Mail): string {
  const match = /\?token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error(`no token in mail: ${mail.text}`);
  return decodeURIComponent(match[1] as string);
}

function only(sent: Mail[]): Mail {
  expect(sent).toHaveLength(1);
  return sent[0] as Mail;
}

async function requestReset(email: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/password-reset",
    payload: { email },
  });
}

async function confirmReset(token: string, password: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/password-reset/confirm",
    payload: { token, password },
  });
}

async function login(email: string, password: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
}

async function countTokens(userId: string): Promise<number> {
  const rows = await app.db
    .select({ id: emailTokens.id })
    .from(emailTokens)
    .where(eq(emailTokens.userId, userId));
  return rows.length;
}

describe("email verification", () => {
  it("mails a confirmation link on registration and accepts it once", async () => {
    const user = await registerUser(app);

    const mail = only(mailer.sent);
    expect(mail.to).toBe(user.email);
    expect(mail.text).toContain(`${TEST_APP_URL}/e-mail-bestaetigen?token=`);

    const before = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: user.auth,
    });
    expect(before.json().user.emailVerified).toBe(false);

    const token = tokenFrom(mail);
    const verified = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().user.emailVerified).toBe(true);

    // Single use: the row is gone with the first redemption.
    const again = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token },
    });
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toBe("token_invalid");
  });

  it("rejects an unknown and an expired token, leaving the account unverified", async () => {
    const user = await registerUser(app);
    const token = tokenFrom(only(mailer.sent));

    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: "not-a-real-token" },
    });
    expect(unknown.statusCode).toBe(400);

    await app.db
      .update(emailTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailTokens.userId, user.id));

    const expired = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token },
    });
    expect(expired.statusCode).toBe(400);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: user.auth,
    });
    expect(me.json().user.emailVerified).toBe(false);
  });

  it("lets an unverified account sign in and use the app", async () => {
    // The product deliberately does not gate anything behind the confirmation:
    // a mail lost in a spam folder must never cost someone their account.
    const user = await registerUser(app, { password: "ein sicheres passwort" });

    const signedIn = await login(user.email, "ein sicheres passwort");
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.json().user.emailVerified).toBe(false);

    const lists = await app.inject({
      method: "GET",
      url: "/api/me/preferences",
      headers: user.auth,
    });
    expect(lists.statusCode).toBe(200);
  });

  it("sends a fresh link on request and invalidates the previous one", async () => {
    const user = await registerUser(app);
    const first = tokenFrom(only(mailer.sent));
    mailer.clear();

    const resent = await app.inject({
      method: "POST",
      url: "/api/auth/resend-verification",
      headers: user.auth,
    });
    expect(resent.statusCode).toBe(204);

    const second = tokenFrom(only(mailer.sent));
    expect(second).not.toBe(first);

    const stale = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: first },
    });
    expect(stale.statusCode).toBe(400);

    const fresh = await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: second },
    });
    expect(fresh.statusCode).toBe(200);
  });

  it("sends nothing when the address is already confirmed", async () => {
    const user = await registerUser(app);
    await app.inject({
      method: "POST",
      url: "/api/auth/verify-email",
      payload: { token: tokenFrom(only(mailer.sent)) },
    });
    mailer.clear();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/resend-verification",
      headers: user.auth,
    });
    expect(response.statusCode).toBe(204);
    expect(mailer.sent).toHaveLength(0);
  });
});

describe("password reset", () => {
  let user: TestUser;

  beforeEach(async () => {
    user = await registerUser(app, { password: "ein sicheres passwort" });
    mailer.clear();
  });

  it("answers a known and an unknown address identically", async () => {
    const known = await requestReset(user.email);
    const unknown = await requestReset("niemand@example.org");

    // Same status, same body — the endpoint must not become a way to test
    // which addresses are registered here.
    expect(known.statusCode).toBe(204);
    expect(unknown.statusCode).toBe(204);
    expect(known.body).toBe(unknown.body);

    // Only the real account gets a mail, and only one.
    expect(mailer.sent.map((mail) => mail.to)).toEqual([user.email]);
  });

  it("sets the new password, ends every session and reports the change", async () => {
    // A second session, to prove the reset reaches beyond the browser that
    // asked for it.
    const other = await login(user.email, "ein sicheres passwort");
    const otherToken = other.json().token as string;

    await requestReset(user.email);
    const token = tokenFrom(only(mailer.sent));
    mailer.clear();

    const confirmed = await confirmReset(token, "ein noch besseres passwort");
    expect(confirmed.statusCode).toBe(204);

    const oldPassword = await login(user.email, "ein sicheres passwort");
    expect(oldPassword.statusCode).toBe(401);

    const newPassword = await login(user.email, "ein noch besseres passwort");
    expect(newPassword.statusCode).toBe(200);
    // Reading the mail proved the address works, so the banner has nothing
    // left to ask for.
    expect(newPassword.json().user.emailVerified).toBe(true);

    for (const stale of [user.token, otherToken]) {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${stale}` },
      });
      expect(response.statusCode).toBe(401);
    }

    const notice = only(mailer.sent);
    expect(notice.to).toBe(user.email);
    expect(notice.subject).toBe("Dein Passwort wurde geändert");
    // A notice, not an action: nothing in it can be redeemed.
    expect(notice.text).not.toContain("token=");
    expect(notice.text).not.toContain("http");
  });

  it("refuses a token that was already used, expired, or superseded", async () => {
    await requestReset(user.email);
    const first = tokenFrom(only(mailer.sent));
    mailer.clear();

    // Superseded: asking again invalidates the link already in the inbox.
    await requestReset(user.email);
    const second = tokenFrom(only(mailer.sent));
    expect((await confirmReset(first, "ein ganz neues passwort")).statusCode).toBe(
      400,
    );

    // Expired.
    await app.db
      .update(emailTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailTokens.userId, user.id));
    expect((await confirmReset(second, "ein ganz neues passwort")).statusCode).toBe(
      400,
    );
    expect((await login(user.email, "ein sicheres passwort")).statusCode).toBe(200);

    // Used.
    mailer.clear();
    await requestReset(user.email);
    const third = tokenFrom(only(mailer.sent));
    expect((await confirmReset(third, "ein ganz neues passwort")).statusCode).toBe(
      204,
    );
    expect((await confirmReset(third, "noch ein anderes passwort")).statusCode).toBe(
      400,
    );
  });

  it("holds the registration password rule", async () => {
    await requestReset(user.email);
    const token = tokenFrom(only(mailer.sent));

    const tooShort = await confirmReset(token, "kurz");
    expect(tooShort.statusCode).toBe(400);
    // The token survives a rejected password: the person is on the right page
    // with the right link, they just have to type a longer one.
    expect((await confirmReset(token, "ein langes passwort")).statusCode).toBe(204);
  });

  it("sends nothing for an account that has been deleted", async () => {
    await app.inject({ method: "DELETE", url: "/api/me", headers: user.auth });
    mailer.clear();

    const response = await requestReset(user.email);
    expect(response.statusCode).toBe(204);
    expect(mailer.sent).toHaveLength(0);
  });
});

describe("what the mails carry", () => {
  it("never contains a password or a session token", async () => {
    const user = await registerUser(app, { password: "ein sicheres passwort" });
    await requestReset(user.email);
    await confirmReset(tokenFrom(mailer.sent[1] as Mail), "ein neues passwort");

    expect(mailer.sent.length).toBeGreaterThan(0);
    for (const mail of mailer.sent) {
      expect(mail.text).not.toContain("ein sicheres passwort");
      expect(mail.text).not.toContain("ein neues passwort");
      expect(mail.text).not.toContain(user.token);
      expect(mail.text).not.toContain("argon2");
    }
  });

  it("links to the web client, not to the API", async () => {
    // A GET endpoint would be fetched by the link scanners between a mail
    // server and an inbox, burning the single-use token before anyone clicks.
    const user = await registerUser(app);
    await requestReset(user.email);

    for (const mail of mailer.sent) {
      expect(mail.text).toContain(TEST_APP_URL);
      expect(mail.text).not.toContain("/api/");
    }
  });
});

describe("retention", () => {
  it("removes pending tokens when the account is deleted", async () => {
    const user = await registerUser(app);
    await requestReset(user.email);
    expect(await countTokens(user.id)).toBeGreaterThan(0);

    await app.inject({ method: "DELETE", url: "/api/me", headers: user.auth });

    // In the same transaction as the sessions: a link lying in an inbox must
    // not outlive the account it belongs to.
    expect(await countTokens(user.id)).toBe(0);
  });

  it("purges expired tokens on the housekeeping run", async () => {
    const user = await registerUser(app);
    await app.db
      .update(emailTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailTokens.userId, user.id));

    const { runHousekeeping } = await import("../src/lib/housekeeping");
    await runHousekeeping(app.db);

    expect(await countTokens(user.id)).toBe(0);
  });

  it("stores the token only as a hash", async () => {
    const user = await registerUser(app);
    const token = tokenFrom(only(mailer.sent));

    const rows = await app.db
      .select({ tokenHash: emailTokens.tokenHash })
      .from(emailTokens)
      .where(eq(emailTokens.userId, user.id));

    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps no column that would record who was mailed when", async () => {
    // Same guard as on `sessions`: the app has no business keeping a delivery
    // log, and a column added by accident should fail a test, not a review.
    const columns = await app.db.execute(
      raw`SELECT column_name FROM information_schema.columns WHERE table_name = 'email_tokens'`,
    );
    const names = [...columns].map((row) => (row as { column_name: string }).column_name);
    expect(names).not.toContain("email");
    expect(names).not.toContain("sent_at");
    expect(names).not.toContain("ip_address");
  });
});

describe("configuration", () => {
  const base = { NODE_ENV: "test", DATABASE_URL: TEST_DATABASE_URL };

  it("refuses SMTP without a sender and an app URL", async () => {
    const { loadEnv } = await import("../src/env");
    // Better here than in an inbox: a link built from a missing APP_URL points
    // at "undefined/passwort-neu" and nobody notices until someone needs it.
    expect(() => loadEnv({ ...base, SMTP_HOST: "mail.example.org" })).toThrow(
      /MAIL_FROM and APP_URL/,
    );
    expect(() =>
      loadEnv({
        ...base,
        SMTP_HOST: "mail.example.org",
        MAIL_FROM: "kirai <noreply@example.org>",
        APP_URL: "https://kirai.example.org",
      }),
    ).not.toThrow();
  });

  it("reads a blank variable as unset", async () => {
    const { loadEnv } = await import("../src/env");
    // An unfilled compose template hands the process empty strings; refusing
    // to start over one the operator left blank on purpose would be worse.
    const env = loadEnv({ ...base, SMTP_HOST: "", APP_URL: "", MAIL_FROM: "" });
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.APP_URL).toBeUndefined();
  });

  it("drops a trailing slash from the app URL", async () => {
    const { loadEnv } = await import("../src/env");
    const env = loadEnv({ ...base, APP_URL: "https://kirai.example.org/" });
    expect(env.APP_URL).toBe("https://kirai.example.org");
  });
});

describe("brute-force protection", () => {
  it("stops repeated reset requests for one address", async () => {
    const limited = await createTestApp({ rateLimit: true });
    try {
      await resetData(limited.app);
      const user = await registerUser(limited.app);

      const attempt = () =>
        limited.app.inject({
          method: "POST",
          url: "/api/auth/password-reset",
          payload: { email: user.email },
        });

      for (let i = 0; i < 5; i += 1) {
        expect((await attempt()).statusCode).toBe(204);
      }
      expect((await attempt()).statusCode).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
