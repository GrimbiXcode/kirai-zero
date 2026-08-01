import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { itemIdParamSchema, preferenceUpsertSchema } from "shared";
import { items, preferences } from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toItemDto, toPreferenceDto } from "../lib/dto";
import { notFound } from "../lib/errors";
import { parse } from "../lib/validate";
import { selectPreferenceColumns } from "../lib/queries";

export async function preferenceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/", async (request) => {
    const user = currentUser(request);
    const rows = await app.db
      .select(selectPreferenceColumns)
      .from(preferences)
      .innerJoin(items, eq(items.id, preferences.itemId))
      .where(eq(preferences.userId, user.id))
      .orderBy(asc(items.name));

    return {
      preferences: rows.map((row) =>
        toPreferenceDto({ ...row, item: toItemDto(row.item) }),
      ),
    };
  });

  app.put("/:itemId", async (request) => {
    const user = currentUser(request);
    const { itemId } = parse(itemIdParamSchema, request.params);
    const input = parse(preferenceUpsertSchema, request.body);

    const itemRows = await app.db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    const item = itemRows[0];
    if (!item) throw notFound("item_not_found", "No such item");

    const now = new Date();
    const upserted = await app.db
      .insert(preferences)
      .values({
        userId: user.id,
        itemId,
        stance: input.stance,
        reason: input.reason,
        note: input.note ?? null,
        visibility: input.visibility,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [preferences.userId, preferences.itemId],
        set: {
          stance: input.stance,
          reason: input.reason,
          note: input.note ?? null,
          visibility: input.visibility,
          updatedAt: now,
        },
      })
      .returning();

    const row = upserted[0]!;
    return {
      preference: toPreferenceDto({ ...row, item: toItemDto(item) }),
    };
  });

  app.delete("/:itemId", async (request) => {
    const user = currentUser(request);
    const { itemId } = parse(itemIdParamSchema, request.params);

    const deleted = await app.db
      .delete(preferences)
      .where(
        and(eq(preferences.userId, user.id), eq(preferences.itemId, itemId)),
      )
      .returning({ id: preferences.id });

    if (deleted.length === 0) {
      throw notFound("preference_not_found", "No preference for this item");
    }
    return { ok: true };
  });
}
