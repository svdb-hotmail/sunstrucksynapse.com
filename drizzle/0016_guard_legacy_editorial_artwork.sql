-- Legacy release-only acceptance is read-only in the submission editor.
CREATE OR REPLACE FUNCTION protect_editorial_artwork() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Keep curator artwork history.'; END IF;
  IF TG_OP='UPDATE' AND OLD.submission_id<>NEW.submission_id THEN RAISE EXCEPTION 'Artwork parent is immutable.'; END IF;
  IF NOT EXISTS(select 1 from submissions s left join tracks t on t.id=s.resulting_track_id left join releases r on r.id=t.release_id
    where s.id=NEW.submission_id and s.status not in ('rejected','withdrawn')
      and ((s.resulting_track_id is null and s.resulting_release_id is null) or (t.lifecycle_status in ('draft','in_review') and r.lifecycle_status in ('draft','in_review'))) FOR UPDATE OF s) THEN
    RAISE EXCEPTION 'Curator artwork requires an editable, unpublished submission.';
  END IF;
  IF NOT EXISTS(select 1 from artwork_assets a where a.id=NEW.artwork_asset_id and a.storage_provider='r2' and a.status='ready'
    and a.scope='publishable_derivative' and a.mime_type in ('image/png','image/jpeg','image/webp','image/avif')
    and a.byte_size between 1 and 20971520 and a.width between 1400 and 10000 and a.width=a.height) THEN
    RAISE EXCEPTION 'Curator artwork must be a verified square cover.';
  END IF;
  RETURN NEW;
END; $$;
