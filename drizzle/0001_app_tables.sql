CREATE TABLE "competitions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"date" date NOT NULL,
	"gi" text NOT NULL,
	"weigh_in_timing" text NOT NULL,
	"target_weight_kg" real,
	"match_len_sec" integer NOT NULL,
	"matches" integer NOT NULL,
	"rest_min" real NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"kcal" real DEFAULT 0 NOT NULL,
	"p" real,
	"c" real,
	"f" real,
	"ingredients" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_logs_external" UNIQUE("user_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"kcal" real NOT NULL,
	"p" real NOT NULL,
	"c" real NOT NULL,
	"f" real NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"portions" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_inputs_user_version" UNIQUE("user_id","version"),
	CONSTRAINT "plan_inputs_id_user" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" uuid,
	"date" date NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"params" jsonb NOT NULL,
	"time_of_day" text,
	"source" text DEFAULT 'generated' NOT NULL,
	"deleted_at" timestamp with time zone,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_sessions_id_user" UNIQUE("id","user_id"),
	CONSTRAINT "plan_sessions_external" UNIQUE("user_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"input_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"start_date" date NOT NULL,
	"comp_date" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"output" jsonb NOT NULL,
	CONSTRAINT "plans_id_user" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "readiness" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"sleep_h" real,
	"rhr" integer,
	"hrv" real,
	"soreness" integer,
	"mood" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readiness_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "readiness_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"session_id" uuid,
	"action" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" uuid,
	"date" date NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"minutes" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"rpe" real,
	"hard_rounds" integer,
	"output_unit" text,
	"rounds" jsonb,
	"exercises" jsonb,
	"notes" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_logs_external" UNIQUE("user_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "week_marks" (
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "week_marks_user_id_week_start_pk" PRIMARY KEY("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "weights" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kg" real NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weights_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_inputs" ADD CONSTRAINT "plan_inputs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_plan_id_user_id_plans_id_user_id_fk" FOREIGN KEY ("plan_id","user_id") REFERENCES "public"."plans"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_input_id_user_id_plan_inputs_id_user_id_fk" FOREIGN KEY ("input_id","user_id") REFERENCES "public"."plan_inputs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness" ADD CONSTRAINT "readiness_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_adjustments" ADD CONSTRAINT "readiness_adjustments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_session_id_user_id_plan_sessions_id_user_id_fk" FOREIGN KEY ("session_id","user_id") REFERENCES "public"."plan_sessions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_marks" ADD CONSTRAINT "week_marks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weights" ADD CONSTRAINT "weights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_logs_user_date" ON "food_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_global_name" ON "foods" USING btree (lower("name")) WHERE "foods"."owner_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_owner_name" ON "foods" USING btree ("owner_id",lower("name")) WHERE "foods"."owner_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "meals_user_name" ON "meals" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "plan_sessions_user_date" ON "plan_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_active" ON "plans" USING btree ("user_id") WHERE "plans"."active";--> statement-breakpoint
CREATE INDEX "readiness_adjustments_user_date" ON "readiness_adjustments" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "session_logs_user_date" ON "session_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "session_logs_one_per_session" ON "session_logs" USING btree ("session_id");