CREATE TABLE "price_table_items" (
	"price_table_id" text NOT NULL,
	"product_id" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	CONSTRAINT "price_table_items_price_table_id_product_id_pk" PRIMARY KEY("price_table_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "price_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"ean" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"brand" text NOT NULL,
	"sale_unit" text NOT NULL,
	"pack_factor" integer NOT NULL,
	"multiple_only" boolean NOT NULL,
	"active" boolean NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_table_items_price_table_id_price_tables_id_fk" FOREIGN KEY ("price_table_id") REFERENCES "price_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_table_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_ean_idx" ON "products" USING btree ("ean");