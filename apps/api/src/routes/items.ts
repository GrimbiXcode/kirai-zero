import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { itemCreateSchema, itemSearchQuerySchema, slugify } from "shared";
import { items } from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toItemDto } from "../lib/dto";
import { badRequest } from "../lib/errors";
import { parse } from "../lib/validate";

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/", async (request) => {
    const query = parse(itemSearchQuerySchema, request.query);

    const conditions: SQL[] = [];
    if (query.kind) conditions.push(eq(items.kind, query.kind));
    if (query.q) {
      // Matching the slug as well as the name means "suesskartoffel" finds
      // "Süsskartoffeln" without the user reproducing the umlaut.
      const term = `%${query.q}%`;
      const slugTerm = `%${slugify(query.q)}%`;
      const fuzzy = or(ilike(items.name, term), ilike(items.slug, slugTerm));
      if (fuzzy) conditions.push(fuzzy);
    }

    const rows = await app.db
      .select()
      .from(items)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      // Curated entries first: they are the ones that keep the catalogue from
      // fragmenting, so they should be the easiest to pick.
      .orderBy(desc(items.isCurated), asc(items.name))
      .limit(query.limit);

    return { items: rows.map(toItemDto) };
  });

  /**
   * Creating an item is idempotent by (kind, slug): if someone already added
   * the same thing, the existing row is returned instead of a duplicate, which
   * is what keeps cross-user aggregation meaningful.
   */
  app.post("/", async (request, reply) => {
    const input = parse(itemCreateSchema, request.body);
    const user = currentUser(request);
    const slug = slugify(input.name);
    if (!slug) {
      throw badRequest("item_name_invalid", "Name has no usable characters");
    }

    const existing = await app.db
      .select()
      .from(items)
      .where(and(eq(items.kind, input.kind), eq(items.slug, slug)))
      .limit(1);

    const found = existing[0];
    if (found) return { item: toItemDto(found) };

    const inserted = await app.db
      .insert(items)
      .values({
        name: input.name,
        slug,
        kind: input.kind,
        createdBy: user.id,
      })
      .onConflictDoNothing({ target: [items.kind, items.slug] })
      .returning();

    const created = inserted[0];
    if (created) return reply.code(201).send({ item: toItemDto(created) });

    // Lost a race against a concurrent insert of the same item: read it back.
    const raced = await app.db
      .select()
      .from(items)
      .where(and(eq(items.kind, input.kind), eq(items.slug, slug)))
      .limit(1);
    const row = raced[0];
    if (!row) throw badRequest("item_create_failed", "Could not create item");
    return { item: toItemDto(row) };
  });
}
