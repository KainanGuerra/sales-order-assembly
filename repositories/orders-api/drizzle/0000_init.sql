CREATE TABLE "order_items" (
	"order_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"sku" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"quantity_input" integer NOT NULL,
	"quantity_units" integer NOT NULL,
	"pack_factor" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"discount_bp" integer NOT NULL,
	"gross_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	CONSTRAINT "order_items_order_id_product_id_pk" PRIMARY KEY("order_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"client_id" text NOT NULL,
	"price_table_id" text NOT NULL,
	"status" text NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"order_discount_bp" integer NOT NULL,
	"order_discount_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"approval_reasons" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_seller_created_idx" ON "orders" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_client_created_idx" ON "orders" USING btree ("client_id","created_at");