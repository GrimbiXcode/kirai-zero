import type { FastifyBaseLogger } from "fastify";
import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../../env";

export interface Mail {
  to: string;
  subject: string;
  /** Plain text only. No HTML part on purpose: nothing to load from a remote
   *  host, no tracking pixel, nothing to get wrong. See docs/decisions.md,
   *  entry 16. */
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
  /** Releases pooled SMTP connections; a no-op for the other transports. */
  close(): Promise<void>;
}

/**
 * Talks to a mail server we run or rent, rather than to an email API. The
 * alternative would put every address and every subject line through another
 * processor — the same argument that keeps authentication in this codebase
 * instead of an identity provider (docs/decisions.md, entry 1).
 */
function smtpMailer(env: Env, from: string): Mailer {
  const transporter: Transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
    pool: true,
  });

  return {
    async send(mail) {
      await transporter.sendMail({ from, ...mail });
    },
    async close() {
      transporter.close();
    },
  };
}

/**
 * Development without a mail server: the message goes to the log, link and
 * all, so a signup or a reset can be followed through locally. This is also
 * the reason `NODE_ENV=production` without `SMTP_HOST` is worth a warning —
 * tokens do not belong in a production log.
 */
function logMailer(log: FastifyBaseLogger): Mailer {
  return {
    async send(mail) {
      log.info({ mail }, "mail (no SMTP_HOST configured, not sent)");
    },
    async close() {},
  };
}

export interface MemoryMailer extends Mailer {
  readonly sent: Mail[];
  clear(): void;
}

/** Test double. Exported from here so the suites assert against the same
 *  interface the routes use. */
export function memoryMailer(): MemoryMailer {
  const sent: Mail[] = [];
  return {
    sent,
    clear: () => {
      sent.length = 0;
    },
    async send(mail) {
      sent.push(mail);
    },
    async close() {},
  };
}

export function createMailer(env: Env, log: FastifyBaseLogger): Mailer {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === "production") {
      log.warn(
        "no SMTP_HOST configured: verification and password reset mails are only written to the log",
      );
    }
    return logMailer(log);
  }
  // loadEnv guarantees MAIL_FROM alongside SMTP_HOST.
  return smtpMailer(env, env.MAIL_FROM as string);
}

/**
 * Sends without letting a failure reach the caller.
 *
 * Every one of these mails is a side effect of a request that has already
 * succeeded, and two things would go wrong if a dead relay propagated: a
 * registration would fail after the account exists, and a 500 on the password
 * reset route would tell an attacker that the address is registered — the one
 * thing that route is built not to say.
 */
export async function deliver(
  mailer: Mailer,
  mail: Mail,
  log: FastifyBaseLogger,
): Promise<void> {
  try {
    await mailer.send(mail);
  } catch (error: unknown) {
    // No recipient in the log line: the point of the product is not to keep a
    // record of who was written to and when.
    log.error({ err: error, subject: mail.subject }, "sending mail failed");
  }
}
