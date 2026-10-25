CREATE TABLE "counted_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_stats" (
	"product_id" text PRIMARY KEY NOT NULL,
	"units_ordered" integer NOT NULL
);
