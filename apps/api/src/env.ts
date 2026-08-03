import { z } from "zod";

/**
 * "Not set" and "set to nothing" have to mean the same thing here. A compose
 * file with `SMTP_HOST: ${SMTP_HOST:-}` and an unfilled template hands the
 * process an empty string, and refusing to start over that would be a poor
 * trade for a variable the operator deliberately left blank.
 */
function blankAsUnset<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Origins allowed to call the API with credentials. */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,capacitor://localhost,http://localhost")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Brute-force protection on the auth endpoints. On by default; test suites
   * turn it off because they drive hundreds of registrations from one address.
   */
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /**
   * Directory with the built web client. Set in the container image, where one
   * process serves both the API and the app from a single origin — which also
   * means no CORS and no cross-site cookie handling. Unset in development,
   * where Vite serves the client on its own port.
   */
  WEB_ROOT: z.string().optional(),
  /**
   * Outgoing mail. Without `SMTP_HOST` the app falls back to a transport that
   * writes the message — link included — to the log, which is what development
   * wants and what production must never do. See docs/decisions.md, entry 16.
   */
  SMTP_HOST: blankAsUnset(z.string().min(1).optional()),
  SMTP_PORT: blankAsUnset(
    z.coerce.number().int().min(1).max(65535).default(587),
  ),
  /** True for implicit TLS on 465. On 587 the connection is upgraded with
   *  STARTTLS instead, which nodemailer does on its own. */
  SMTP_SECURE: blankAsUnset(
    z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  ),
  SMTP_USER: blankAsUnset(z.string().optional()),
  SMTP_PASSWORD: blankAsUnset(z.string().optional()),
  /** Envelope sender, e.g. `kirai-zero <noreply@example.org>`. */
  MAIL_FROM: blankAsUnset(z.string().min(1).optional()),
  /** Origin the links in those mails point at — the web client, not the API. */
  APP_URL: blankAsUnset(
    z
      .url()
      .optional()
      .transform((value) => value?.replace(/\/$/, "")),
  ),
  /** Named in the mail that reports a completed password reset, so someone who
   *  did not trigger it has somewhere to turn. */
  SUPPORT_EMAIL: blankAsUnset(z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema
    .refine(
      (env) => !env.SMTP_HOST || (env.MAIL_FROM && env.APP_URL),
      // A reset link pointing at `undefined/passwort-neu` must fail here and
      // not in somebody's inbox.
      {
        path: ["SMTP_HOST"],
        error: "sending mail also requires MAIL_FROM and APP_URL",
      },
    )
    .safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  return parsed.data;
}
