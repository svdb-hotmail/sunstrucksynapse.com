CREATE UNIQUE INDEX "creative_process_disclosures_supersedes_unique" ON "creative_process_disclosures" USING btree ("supersedes_id") WHERE "creative_process_disclosures"."supersedes_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_records_supersedes_unique" ON "provenance_records" USING btree ("supersedes_id") WHERE "provenance_records"."supersedes_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rights_declarations_supersedes_unique" ON "rights_declarations" USING btree ("supersedes_id") WHERE "rights_declarations"."supersedes_id" is not null;--> statement-breakpoint
DO $$
DECLARE
	table_name text;
	invalid_count bigint;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'rights_declarations',
		'creative_process_disclosures',
		'provenance_records'
	] LOOP
		EXECUTE format(
			'SELECT count(*)
			 FROM %1$I current_record
			 LEFT JOIN %1$I predecessor ON predecessor.id = current_record.supersedes_id
			 WHERE (current_record.version = 1 AND current_record.supersedes_id IS NOT NULL)
			    OR (current_record.version > 1 AND (
					current_record.supersedes_id IS NULL
					OR predecessor.id IS NULL
					OR predecessor.version <> current_record.version - 1
					OR predecessor.submission_id IS DISTINCT FROM current_record.submission_id
					OR predecessor.release_id IS DISTINCT FROM current_record.release_id
					OR predecessor.track_id IS DISTINCT FROM current_record.track_id
				))',
			table_name
		) INTO invalid_count;

		IF invalid_count > 0 THEN
			RAISE EXCEPTION 'existing % history violates supersession invariants', table_name
				USING ERRCODE = '23514';
		END IF;
	END LOOP;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "set_updated_at"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	NEW.updated_at := clock_timestamp();
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "artists_set_updated_at" BEFORE UPDATE ON "artists"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "artwork_assets_set_updated_at" BEFORE UPDATE ON "artwork_assets"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "audio_assets_set_updated_at" BEFORE UPDATE ON "audio_assets"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "releases_set_updated_at" BEFORE UPDATE ON "releases"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "tracks_set_updated_at" BEFORE UPDATE ON "tracks"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "editorial_collections_set_updated_at" BEFORE UPDATE ON "editorial_collections"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "creative_process_disclosures_set_updated_at" BEFORE UPDATE ON "creative_process_disclosures"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "provenance_records_set_updated_at" BEFORE UPDATE ON "provenance_records"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "rights_declarations_set_updated_at" BEFORE UPDATE ON "rights_declarations"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "submissions_set_updated_at" BEFORE UPDATE ON "submissions"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();--> statement-breakpoint
CREATE FUNCTION "enforce_version_supersession"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	predecessor record;
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'versioned governance records cannot be deleted'
			USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'UPDATE' AND OLD.status::text <> 'draft' THEN
		RAISE EXCEPTION 'finalized governance records cannot be changed'
			USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'UPDATE' AND (
		NEW.submission_id IS DISTINCT FROM OLD.submission_id
		OR NEW.release_id IS DISTINCT FROM OLD.release_id
		OR NEW.track_id IS DISTINCT FROM OLD.track_id
		OR NEW.version IS DISTINCT FROM OLD.version
		OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
	) THEN
		RAISE EXCEPTION 'version parent, number, and predecessor are immutable'
			USING ERRCODE = '23514';
	END IF;

	IF NEW.version = 1 THEN
		IF NEW.supersedes_id IS NOT NULL THEN
			RAISE EXCEPTION 'version 1 cannot supersede another record'
				USING ERRCODE = '23514';
		END IF;
		RETURN NEW;
	END IF;

	IF NEW.supersedes_id IS NULL THEN
		RAISE EXCEPTION 'version % requires its version % predecessor', NEW.version, NEW.version - 1
			USING ERRCODE = '23514';
	END IF;

	EXECUTE format(
		'SELECT id, submission_id, release_id, track_id, version FROM %I WHERE id = $1',
		TG_TABLE_NAME
	) INTO predecessor USING NEW.supersedes_id;

	IF predecessor.id IS NULL THEN
		RAISE EXCEPTION 'superseded record does not exist'
			USING ERRCODE = '23514';
	END IF;

	IF predecessor.version <> NEW.version - 1 THEN
		RAISE EXCEPTION 'version % must supersede version %', NEW.version, NEW.version - 1
			USING ERRCODE = '23514';
	END IF;

	IF predecessor.submission_id IS DISTINCT FROM NEW.submission_id
		OR predecessor.release_id IS DISTINCT FROM NEW.release_id
		OR predecessor.track_id IS DISTINCT FROM NEW.track_id
	THEN
		RAISE EXCEPTION 'superseded record must have the same parent'
			USING ERRCODE = '23514';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "rights_declarations_enforce_supersession"
BEFORE INSERT OR UPDATE OR DELETE ON "rights_declarations"
FOR EACH ROW EXECUTE FUNCTION "enforce_version_supersession"();--> statement-breakpoint
CREATE TRIGGER "creative_process_disclosures_enforce_supersession"
BEFORE INSERT OR UPDATE OR DELETE ON "creative_process_disclosures"
FOR EACH ROW EXECUTE FUNCTION "enforce_version_supersession"();--> statement-breakpoint
CREATE TRIGGER "provenance_records_enforce_supersession"
BEFORE INSERT OR UPDATE OR DELETE ON "provenance_records"
FOR EACH ROW EXECUTE FUNCTION "enforce_version_supersession"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "check_release_has_artist_credit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	release_to_check uuid;
BEGIN
	IF TG_TABLE_NAME = 'releases' THEN
		release_to_check := NEW.id;
	ELSIF TG_OP = 'DELETE' THEN
		release_to_check := OLD.release_id;
	ELSE
		release_to_check := NEW.release_id;
	END IF;

	PERFORM 1 FROM releases WHERE id = release_to_check FOR UPDATE;
	IF FOUND AND NOT EXISTS (
		SELECT 1 FROM release_artist_credits WHERE release_id = release_to_check
	) THEN
		RAISE EXCEPTION 'release % must have at least one artist credit', release_to_check
			USING ERRCODE = '23514';
	END IF;

	IF TG_TABLE_NAME = 'release_artist_credits' AND TG_OP = 'UPDATE' THEN
		IF OLD.release_id IS DISTINCT FROM NEW.release_id THEN
			PERFORM 1 FROM releases WHERE id = OLD.release_id FOR UPDATE;
			IF FOUND AND NOT EXISTS (
				SELECT 1 FROM release_artist_credits WHERE release_id = OLD.release_id
			) THEN
				RAISE EXCEPTION 'release % must have at least one artist credit', OLD.release_id
					USING ERRCODE = '23514';
			END IF;
		END IF;
	END IF;

	RETURN NULL;
END;
$$;