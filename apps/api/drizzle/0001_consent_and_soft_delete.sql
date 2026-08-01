ALTER TABLE "preferences" ADD COLUMN "consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");