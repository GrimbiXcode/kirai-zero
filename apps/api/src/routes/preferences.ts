import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import {
  CONSENT_VERSION,
  isSpecialCategory,
  itemIdParamSchema,
  preferenceUpsertSchema,
} from "shared";
import { items, preferences } from "../db/schema";
import { authenticate, currentUser } from "../lib/auth";
import { toItemDto, toPreferenceDto } from "../lib/dto";
import { badRequest, notFound } from "../lib/errors";
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

    /**
     * Art. 9(1) GDPR forbids processing special categories of data unless one
     * of the exceptions applies; here that is the explicit consent of the
     * person under Art. 9(2)(a). The check does not look at `visibility`,
     * because the prohibition attaches to the processing itself — storing an
     * allergy privately still needs the consent.
     */
    const needsConsent = isSpecialCategory(input.reason);
    if (needsConsent && input.consentGiven !== true) {
      throw badRequest(
        "consent_required",
        "This reason stores special-category data and needs explicit consent",
      );
    }

    const now = new Date();
    const values = {
      stance: input.stance,
      reason: input.reason,
      note: input.note ?? null,
      visibility: input.visibility,
      // Switching away from a special-category reason clears the record: that
      // switch is how someone withdraws their consent.
      consentedAt: needsConsent ? now : null,
      consentVersion: needsConsent ? CONSENT_VERSION : null,
      updatedAt: now,
    };

    const upserted = await app.db
      .insert(preferences)
      .values({ userId: user.id, itemId, ...values })
      .onConflictDoUpdate({
        target: [preferences.userId, preferences.itemId],
        set: values,
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
