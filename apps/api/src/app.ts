import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
} from "fastify";
import type { ApiErrorBody } from "shared";
import type { Database } from "./db/client";
import type { Env } from "./env";
import { AppError } from "./lib/errors";
import type { AuthenticatedUser } from "./lib/sessions";
import { accountRoutes } from "./routes/account";
import { authRoutes } from "./routes/auth";
import { itemRoutes } from "./routes/items";
import { personRoutes } from "./routes/persons";
import { preferenceRoutes } from "./routes/preferences";
import { socialRoutes } from "./routes/social";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    appEnv: Env;
  }
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
  }
}

export interface BuildAppOptions {
  db: Database;
  env: Env;
}

export async function buildApp({
  db,
  env,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: env.NODE_ENV === "production" ? "info" : "debug",
            serializers: {
              // Method and path are what makes a log line useful for
              // operations. The client IP, the user agent and the headers are
              // dropped before they can reach a log file: the product does not
              // need them, and data that is never written needs no retention
              // rule and cannot leak.
              req: (request) => ({
                method: request.method,
                url: request.url,
              }),
              res: (reply) => ({ statusCode: reply.statusCode }),
            },
          },
    trustProxy: env.NODE_ENV === "production",
  });

  app.decorate("db", db);
  app.decorate("appEnv", env);
  app.decorateRequest("currentUser", undefined);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  await app.register(cookie);

  if (env.RATE_LIMIT_ENABLED) {
    // Per-route only: the limits that matter are on the auth endpoints, and a
    // global cap would punish a household behind one address.
    await app.register(rateLimit, {
      global: false,
      max: 300,
      timeWindow: "1 minute",
    });
  }

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiErrorBody = {
        error: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      };
      return reply.code(error.statusCode).send(body);
    }
    if (error.statusCode && error.statusCode < 500) {
      const body: ApiErrorBody = {
        error: error.code ?? "request_failed",
        message: error.message,
      };
      return reply.code(error.statusCode).send(body);
    }
    request.log.error({ err: error }, "unhandled error");
    const body: ApiErrorBody = {
      error: "internal_error",
      message: "Something went wrong",
    };
    return reply.code(500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiErrorBody = { error: "not_found", message: "Not found" };
    return reply.code(404).send(body);
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(itemRoutes, { prefix: "/api/items" });
  await app.register(preferenceRoutes, { prefix: "/api/me/preferences" });
  await app.register(accountRoutes, { prefix: "/api/me" });
  await app.register(personRoutes, { prefix: "/api/persons" });
  await app.register(socialRoutes, { prefix: "/api" });

  return app;
}
