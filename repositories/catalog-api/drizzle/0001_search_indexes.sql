-- unaccent() is only STABLE, so it cannot be used in an index expression
-- directly. This wrapper pins the dictionary and declares the result
-- IMMUTABLE, which is the standard way to index accent-insensitive text.
CREATE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;
--> statement-breakpoint
-- Trigram index for the fuzzy / contains search on the description.
CREATE INDEX "products_description_trgm_idx"
  ON "products" USING gin (immutable_unaccent(lower("description")) gin_trgm_ops);
