CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text DEFAULT 'user' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" text NOT NULL,
  "created_at" text NOT NULL,
  CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "invites" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "created_at" text NOT NULL,
  "expires_at" text,
  "used_at" text,
  "used_by_user_id" text,
  CONSTRAINT "invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "description" text NOT NULL,
  "amount" double precision NOT NULL,
  "type" text NOT NULL,
  "category_key" text NOT NULL,
  "transaction_date" text NOT NULL,
  "schedule_type" text DEFAULT 'once' NOT NULL,
  "series_id" text,
  "installment_index" integer,
  "installment_count" integer,
  "is_recurring" boolean DEFAULT false NOT NULL,
  "due_date" text,
  "is_paid" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_settings" (
  "id" integer PRIMARY KEY NOT NULL,
  "product_name" text NOT NULL,
  "logo_url" text,
  "favicon_url" text,
  "primary_color" text NOT NULL,
  "accent_color" text NOT NULL,
  "surface_color" text NOT NULL,
  "text_color" text NOT NULL,
  "support_email" text,
  "marketing_headline" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
  "id" integer PRIMARY KEY NOT NULL,
  "currency" text NOT NULL,
  "locale" text NOT NULL,
  "timezone" text NOT NULL,
  "billing_day_default" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_transactions_user_date" ON "transactions" USING btree ("user_id","transaction_date");
--> statement-breakpoint
CREATE INDEX "idx_transactions_due_date" ON "transactions" USING btree ("user_id","due_date");
--> statement-breakpoint
CREATE INDEX "idx_transactions_paid" ON "transactions" USING btree ("user_id","is_paid");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_categories_user_key" ON "custom_categories" USING btree ("user_id","key");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invites_code" ON "invites" USING btree ("code");
