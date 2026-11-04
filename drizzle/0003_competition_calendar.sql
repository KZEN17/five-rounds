-- Competitions become a calendar: own id, several per user, one marked main.
-- Hand-edited: drizzle-kit can't name the old primary key or backfill is_main.
ALTER TABLE "competitions" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "is_main" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Until now each user had exactly one competition: it is their main one.
UPDATE "competitions" SET "is_main" = true;--> statement-breakpoint
ALTER TABLE "competitions" DROP CONSTRAINT "competitions_pkey";--> statement-breakpoint
ALTER TABLE "competitions" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "competitions_user_date" ON "competitions" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_one_main" ON "competitions" USING btree ("user_id") WHERE "competitions"."is_main";
