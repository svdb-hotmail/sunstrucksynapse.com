CREATE UNIQUE INDEX "creative_process_disclosures_supersedes_unique" ON "creative_process_disclosures" USING btree ("supersedes_id") WHERE "creative_process_disclosures"."supersedes_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "provenance_records_supersedes_unique" ON "provenance_records" USING btree ("supersedes_id") WHERE "provenance_records"."supersedes_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rights_declarations_supersedes_unique" ON "rights_declarations" USING btree ("supersedes_id") WHERE "rights_declarations"."supersedes_id" is not null;--> statement-breakpoint
DO $$
DECLARE
	table_name text;
	final_status text;
	invalid_count bigint;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'rights_declarations',
		'creative_process_disclosures',
		'provenance_records'
	] LOOP
		final_status := CASE
			WHEN table_name = 'rights_declarations' THEN 'attested'
			ELSE 'finalized'
		END;

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
					OR (current_record.status::text = ''draft'' AND predecessor.status::text <> %2$L)
					OR (
						current_record.status::text <> ''draft''
						AND predecessor.status::text <> ''superseded''
					)
				))
				OR (
					current_record.status::text = %2$L
					AND EXISTS (
						SELECT 1
						FROM %1$I successor
						WHERE successor.supersedes_id = current_record.id
						  AND successor.status::text <> ''draft''
					)
				)
				OR (
					current_record.status::text = ''superseded''
					AND NOT EXISTS (
						SELECT 1
						FROM %1$I successor
						WHERE successor.supersedes_id = current_record.id
						  AND successor.status::text <> ''draft''
					)
				)',
			table_name,
			final_status
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
	final_status text;
	updated_count integer;
BEGIN
	final_status := CASE
		WHEN TG_TABLE_NAME = 'rights_declarations' THEN 'attested'
		ELSE 'finalized'
	END;

	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'versioned governance records cannot be deleted'
			USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'INSERT' AND NEW.status::text <> 'draft' THEN
		RAISE EXCEPTION 'new governance versions must begin as draft'
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

	IF TG_OP = 'UPDATE' AND OLD.status::text = 'superseded' THEN
		RAISE EXCEPTION 'superseded governance records cannot be changed'
			USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'UPDATE' AND OLD.status::text = final_status THEN
		IF pg_trigger_depth() > 1
			AND NEW.status::text = 'superseded'
			AND (to_jsonb(NEW) - 'status' - 'updated_at')
				= (to_jsonb(OLD) - 'status' - 'updated_at')
		THEN
			RETURN NEW;
		END IF;

		RAISE EXCEPTION 'finalized governance records cannot be changed directly'
			USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'UPDATE'
		AND OLD.status::text = 'draft'
		AND NEW.status::text NOT IN ('draft', final_status)
	THEN
		RAISE EXCEPTION 'draft governance records can only become %', final_status
			USING ERRCODE = '23514';
	END IF;

	IF NEW.version = 1 THEN
		IF NEW.supersedes_id IS NOT NULL THEN
			RAISE EXCEPTION 'version 1 cannot supersede another record'
				USING ERRCODE = '23514';
		END IF;
	ELSE
		IF NEW.supersedes_id IS NULL THEN
			RAISE EXCEPTION 'version % requires its version % predecessor', NEW.version, NEW.version - 1
				USING ERRCODE = '23514';
		END IF;

		EXECUTE format(
			'SELECT id, submission_id, release_id, track_id, version, status::text AS status
			 FROM %I WHERE id = $1',
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

		IF predecessor.status <> final_status THEN
			RAISE EXCEPTION 'predecessor version must be % before creating a successor', final_status
				USING ERRCODE = '23514';
		END IF;
	END IF;

	IF TG_OP = 'UPDATE'
		AND OLD.status::text = 'draft'
		AND NEW.status::text = final_status
		AND NEW.supersedes_id IS NOT NULL
	THEN
		EXECUTE format(
			'UPDATE %I SET status = ''superseded'' WHERE id = $1 AND status::text = $2',
			TG_TABLE_NAME
		) USING NEW.supersedes_id, final_status;
		GET DIAGNOSTICS updated_count = ROW_COUNT;

		IF updated_count <> 1 THEN
			RAISE EXCEPTION 'predecessor version could not be superseded atomically'
				USING ERRCODE = '23514';
		END IF;
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
CREATE FUNCTION "enforce_provenance_details_draft"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	locked_count integer;
	non_draft_count integer;
	expected_count integer;
BEGIN
	IF TG_OP = 'INSERT' THEN
		SELECT count(*), count(*) FILTER (WHERE status <> 'draft')
		INTO locked_count, non_draft_count
		FROM (
			SELECT status
			FROM provenance_records
			WHERE id = NEW.provenance_record_id
			FOR SHARE
		) locked_parents;
		expected_count := 1;
	ELSIF TG_OP = 'DELETE' THEN
		SELECT count(*), count(*) FILTER (WHERE status <> 'draft')
		INTO locked_count, non_draft_count
		FROM (
			SELECT status
			FROM provenance_records
			WHERE id = OLD.provenance_record_id
			FOR SHARE
		) locked_parents;
		expected_count := 1;
	ELSE
		SELECT count(*), count(*) FILTER (WHERE status <> 'draft')
		INTO locked_count, non_draft_count
		FROM (
			SELECT status
			FROM provenance_records
			WHERE id IN (OLD.provenance_record_id, NEW.provenance_record_id)
			ORDER BY id
			FOR SHARE
		) locked_parents;
		expected_count := CASE
			WHEN OLD.provenance_record_id = NEW.provenance_record_id THEN 1
			ELSE 2
		END;
	END IF;

	IF locked_count <> expected_count OR non_draft_count > 0 THEN
		RAISE EXCEPTION 'provenance details can only change while their record is draft'
			USING ERRCODE = '23514';
	END IF;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "provenance_steps_require_draft"
BEFORE INSERT OR UPDATE OR DELETE ON "provenance_steps"
FOR EACH ROW EXECUTE FUNCTION "enforce_provenance_details_draft"();--> statement-breakpoint
CREATE TRIGGER "provenance_sources_require_draft"
BEFORE INSERT OR UPDATE OR DELETE ON "provenance_sources"
FOR EACH ROW EXECUTE FUNCTION "enforce_provenance_details_draft"();--> statement-breakpoint
CREATE TRIGGER "provenance_evidence_require_draft"
BEFORE INSERT OR UPDATE OR DELETE ON "provenance_evidence"
FOR EACH ROW EXECUTE FUNCTION "enforce_provenance_details_draft"();--> statement-breakpoint
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