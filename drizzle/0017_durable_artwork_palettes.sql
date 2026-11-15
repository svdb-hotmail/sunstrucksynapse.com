-- Colors remain data, never arbitrary CSS. Mirror application WCAG validation for direct SQL writes.
CREATE FUNCTION artwork_palette_luminance(value text) RETURNS double precision LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT sum(weight * CASE WHEN channel <= 0.04045 THEN channel/12.92 ELSE power((channel+0.055)/1.055,2.4) END)
  FROM (SELECT get_byte(decode(substring(value FROM 2),'hex'),i)::double precision/255 AS channel,
    CASE i WHEN 0 THEN 0.2126 WHEN 1 THEN 0.7152 ELSE 0.0722 END AS weight FROM generate_series(0,2) i) c
$$;
--> statement-breakpoint
CREATE FUNCTION artwork_palette_contrast(a text,b text) RETURNS double precision LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (greatest(artwork_palette_luminance(a),artwork_palette_luminance(b))+0.05)/
    (least(artwork_palette_luminance(a),artwork_palette_luminance(b))+0.05)
$$;
--> statement-breakpoint
CREATE FUNCTION artwork_palette_colors_valid(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(value) = 'object' AND
    (SELECT count(*) = 7 AND bool_and(key = ANY(ARRAY['accent','paperLight','surfaceLight','inkLight','paperDark','surfaceDark','inkDark']) AND jsonb_typeof(val) = 'string' AND val #>> '{}' ~ '^#[0-9a-fA-F]{6}$') FROM jsonb_each(CASE WHEN jsonb_typeof(value)='object' THEN value ELSE '{}'::jsonb END) AS e(key,val))
  THEN artwork_palette_contrast(value->>'inkLight',value->>'paperLight')>=4.5
    AND artwork_palette_contrast(value->>'inkLight',value->>'surfaceLight')>=4.5
    AND artwork_palette_contrast(value->>'inkDark',value->>'paperDark')>=4.5
    AND artwork_palette_contrast(value->>'inkDark',value->>'surfaceDark')>=4.5
    AND artwork_palette_contrast('#ffffff',value->>'accent')>=4.5
  ELSE false END
$$;
--> statement-breakpoint
CREATE TABLE artwork_palette_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enable_new_artwork boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
INSERT INTO artwork_palette_settings (singleton) VALUES (true);
--> statement-breakpoint
CREATE TABLE artwork_palette_generations (
  artwork_asset_id uuid PRIMARY KEY CONSTRAINT artwork_palette_generations_artwork_asset_id_artwork_assets_id_fk REFERENCES artwork_assets(id) ON DELETE CASCADE,
  source_object_key text NOT NULL,
  source_storage_provider text NOT NULL,
  source_checksum_sha256 text NOT NULL,
  source_mime_type text NOT NULL,
  source_byte_size bigint NOT NULL,
  algorithm_version integer NOT NULL,
  generation_revision integer NOT NULL DEFAULT 1 CHECK (generation_revision > 0),
  status text NOT NULL DEFAULT 'pending',
  colors jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artwork_palette_generation_source_check CHECK (source_object_key <> '' AND source_checksum_sha256 ~ '^[0-9a-f]{64}$' AND source_byte_size > 0 AND algorithm_version > 0 AND source_storage_provider IN ('r2','static')),
  CONSTRAINT artwork_palette_generation_state_check CHECK (
    (status='ready' AND colors IS NOT NULL AND artwork_palette_colors_valid(colors) AND error_code IS NULL)
    OR (status='pending' AND colors IS NULL AND error_code IS NULL)
    OR (status='failed' AND colors IS NULL AND error_code IS NOT NULL AND error_code ~ '^[A-Z][A-Z0-9_]{0,63}$')
  )
);
--> statement-breakpoint
CREATE TABLE artwork_palette_overrides (
  artwork_asset_id uuid PRIMARY KEY CONSTRAINT artwork_palette_overrides_artwork_asset_id_artwork_assets_id_fk REFERENCES artwork_assets(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  colors jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artwork_palette_override_colors_check CHECK (version=1 AND artwork_palette_colors_valid(colors))
);
--> statement-breakpoint
-- Explicit calls are the reviewed backfill path. The producer trigger is gated separately.
CREATE FUNCTION enqueue_artwork_palette(asset_id uuid, requeue_failed boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE a artwork_assets%ROWTYPE; job_id uuid; identity_key text; retry_terminal boolean; revision integer;
BEGIN
  SELECT * INTO a FROM artwork_assets WHERE id=asset_id AND status='ready' AND scope='publishable_derivative' FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM artwork_palette_overrides WHERE artwork_asset_id=asset_id) THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM artwork_palette_generations WHERE artwork_asset_id=a.id
    AND source_object_key=a.object_key AND source_storage_provider=a.storage_provider::text
    AND source_checksum_sha256=a.checksum_sha256 AND source_mime_type=a.mime_type
    AND source_byte_size=a.byte_size AND algorithm_version=1 AND status='ready') THEN RETURN NULL; END IF;
  -- Explicit requeue starts another occurrence only after the previous job is terminal.
  SELECT requeue_failed AND EXISTS(
    SELECT 1 FROM artwork_palette_generations g WHERE g.artwork_asset_id=a.id AND g.status='failed'
      AND EXISTS(SELECT 1 FROM curation_outbox j WHERE j.kind='artwork_palette_generate'
        AND j.payload->>'assetId'=a.id::text AND j.payload->>'generationRevision'=g.generation_revision::text
        AND j.status='failed')
      AND NOT EXISTS(SELECT 1 FROM curation_outbox j WHERE j.kind='artwork_palette_generate'
        AND j.payload->>'assetId'=a.id::text AND j.payload->>'generationRevision'=g.generation_revision::text
        AND j.status IN ('pending','processing'))
  ) INTO retry_terminal;
  INSERT INTO artwork_palette_generations (artwork_asset_id,source_object_key,source_storage_provider,source_checksum_sha256,source_mime_type,source_byte_size,algorithm_version)
    VALUES(a.id,a.object_key,a.storage_provider::text,a.checksum_sha256,a.mime_type,a.byte_size,1)
    ON CONFLICT(artwork_asset_id) DO UPDATE SET source_object_key=EXCLUDED.source_object_key,source_storage_provider=EXCLUDED.source_storage_provider,
      source_checksum_sha256=EXCLUDED.source_checksum_sha256,source_mime_type=EXCLUDED.source_mime_type,source_byte_size=EXCLUDED.source_byte_size,
      algorithm_version=1,generation_revision=artwork_palette_generations.generation_revision+1,status='pending',colors=NULL,error_code=NULL,updated_at=now()
    WHERE (artwork_palette_generations.source_object_key,artwork_palette_generations.source_storage_provider,artwork_palette_generations.source_checksum_sha256,artwork_palette_generations.source_mime_type,artwork_palette_generations.source_byte_size,artwork_palette_generations.algorithm_version)
      IS DISTINCT FROM (EXCLUDED.source_object_key,EXCLUDED.source_storage_provider,EXCLUDED.source_checksum_sha256,EXCLUDED.source_mime_type,EXCLUDED.source_byte_size,1)
      OR retry_terminal
    RETURNING generation_revision INTO revision;
  IF revision IS NULL THEN SELECT generation_revision INTO revision FROM artwork_palette_generations WHERE artwork_asset_id=a.id; END IF;
  -- Each occurrence has a distinct key. Terminal outbox history stays immutable.
  identity_key := 'artwork-palette:' || a.id || ':' || a.checksum_sha256 || ':' || md5(a.object_key || ':' || a.storage_provider::text || ':' || a.mime_type || ':' || a.byte_size::text) || ':1:' || revision::text;
  INSERT INTO curation_outbox (idempotency_key,kind,payload)
    VALUES(identity_key,'artwork_palette_generate',jsonb_build_object('assetId',a.id,'objectKey',a.object_key,'storageProvider',a.storage_provider,'checksumSha256',a.checksum_sha256,'mimeType',a.mime_type,'byteSize',a.byte_size,'algorithmVersion',1,'generationRevision',revision))
    ON CONFLICT(idempotency_key) DO NOTHING
    RETURNING id INTO job_id;
  -- Resume an interrupted enqueue without changing an active job's lease or budget.
  IF job_id IS NULL THEN
    SELECT id INTO job_id FROM curation_outbox
      WHERE idempotency_key=identity_key AND kind='artwork_palette_generate'
        AND status IN ('pending','processing')
        AND payload @> jsonb_build_object('assetId',a.id,'objectKey',a.object_key,'storageProvider',a.storage_provider,
          'checksumSha256',a.checksum_sha256,'mimeType',a.mime_type,'byteSize',a.byte_size,
          'algorithmVersion',1,'generationRevision',revision);
  END IF;
  RETURN job_id;
END $$;
--> statement-breakpoint
CREATE FUNCTION produce_artwork_palette() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT enable_new_artwork FROM artwork_palette_settings WHERE singleton)
    AND NEW.status='ready' AND NEW.scope='publishable_derivative' THEN
    IF TG_OP='INSERT' THEN PERFORM enqueue_artwork_palette(NEW.id);
    ELSIF (OLD.object_key,OLD.storage_provider,OLD.checksum_sha256,OLD.mime_type,OLD.byte_size,OLD.status,OLD.scope)
      IS DISTINCT FROM (NEW.object_key,NEW.storage_provider,NEW.checksum_sha256,NEW.mime_type,NEW.byte_size,NEW.status,NEW.scope)
      THEN PERFORM enqueue_artwork_palette(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER artwork_palette_producer AFTER INSERT OR UPDATE ON artwork_assets FOR EACH ROW EXECUTE FUNCTION produce_artwork_palette();
