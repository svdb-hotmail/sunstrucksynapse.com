ALTER TABLE "artwork_assets" DROP CONSTRAINT "artwork_assets_dimensions_check";--> statement-breakpoint
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_resulting_catalogue_check";--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD CONSTRAINT "artwork_assets_dimensions_check" CHECK (("artwork_assets"."width" is null and "artwork_assets"."height" is null) or ("artwork_assets"."width" is not null and "artwork_assets"."height" is not null and "artwork_assets"."width" > 0 and "artwork_assets"."height" > 0));--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resulting_catalogue_check" CHECK (num_nonnulls("submissions"."resulting_release_id", "submissions"."resulting_track_id") <= 1 and (num_nonnulls("submissions"."resulting_release_id", "submissions"."resulting_track_id") = 0 or "submissions"."status" = 'accepted'));--> statement-breakpoint
CREATE FUNCTION "lock_release_artist_credit_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM 1 FROM releases WHERE id = OLD.release_id FOR UPDATE;
		RETURN OLD;
	END IF;

	PERFORM 1
	FROM releases
	WHERE id IN (OLD.release_id, NEW.release_id)
	ORDER BY id
	FOR UPDATE;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "release_artist_credits_lock_release"
BEFORE UPDATE OR DELETE ON "release_artist_credits"
FOR EACH ROW EXECUTE FUNCTION "lock_release_artist_credit_mutation"();