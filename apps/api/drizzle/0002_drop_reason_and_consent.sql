ALTER TABLE "preferences" DROP COLUMN "reason";--> statement-breakpoint
ALTER TABLE "preferences" DROP COLUMN "consented_at";--> statement-breakpoint
ALTER TABLE "preferences" DROP COLUMN "consent_version";--> statement-breakpoint
ALTER TABLE "public"."preferences" ALTER COLUMN "stance" SET DATA TYPE text;--> statement-breakpoint
--> Hand-written: 'avoid' loses its meaning once reasons are gone — without a
--> reason to carry the severity it says exactly what 'dislike' says. Folding it
--> in has to happen while the column is text, otherwise the cast back to the
--> new enum below fails on every existing row.
UPDATE "preferences" SET "stance" = 'dislike' WHERE "stance" = 'avoid';--> statement-breakpoint
DROP TYPE "public"."stance";--> statement-breakpoint
CREATE TYPE "public"."stance" AS ENUM('love', 'like', 'neutral', 'dislike');--> statement-breakpoint
ALTER TABLE "public"."preferences" ALTER COLUMN "stance" SET DATA TYPE "public"."stance" USING "stance"::"public"."stance";--> statement-breakpoint
DROP TYPE "public"."reason";