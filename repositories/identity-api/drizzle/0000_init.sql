CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"trade_name" text NOT NULL,
	"legal_name" text NOT NULL,
	"cnpj" text NOT NULL,
	"seller_id" text NOT NULL,
	"price_table_id" text,
	"credit_limit_cents" integer NOT NULL,
	"credit_used_cents" integer NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	CONSTRAINT "clients_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"supervisor_id" text NOT NULL,
	"discount_limit_bp" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_supervisor_id_supervisors_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "supervisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_seller_idx" ON "clients" USING btree ("seller_id");