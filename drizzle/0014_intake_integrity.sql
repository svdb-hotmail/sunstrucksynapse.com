-- Reserve album positions in the same statement that saves the artist draft.
-- Project locks serialize both position choices and shared-cover finalization.
CREATE OR REPLACE FUNCTION guard_submission_album_choice() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project submission_release_projects%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status NOT IN ('draft','clarification_requested') AND ROW(NEW.artist_details,NEW.release_details,NEW.track_details,NEW.invitation_id) IS DISTINCT FROM ROW(OLD.artist_details,OLD.release_details,OLD.track_details,OLD.invitation_id) THEN
    RAISE EXCEPTION 'Submitted release details are immutable outside artist clarification.';
  END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.release_details->>'kind',NEW.release_details->>'albumProjectId',lower(NEW.artist_details->>'displayName'),NEW.invitation_id) IS DISTINCT FROM ROW(OLD.release_details->>'kind',OLD.release_details->>'albumProjectId',lower(OLD.artist_details->>'displayName'),OLD.invitation_id)
    AND EXISTS(select 1 from submission_cover_uploads c join submission_cover_selections sc on sc.cover_id=c.id where c.submission_id=OLD.id and sc.submission_id<>OLD.id) THEN
    RAISE EXCEPTION 'This cover is shared with other album tracks. Keep its artist and album identity.';
  END IF;
  IF nullif(NEW.release_details->>'albumProjectId','') IS NOT NULL THEN
    SELECT p.* INTO project FROM submission_release_projects p WHERE p.id::text=NEW.release_details->>'albumProjectId' FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS(select 1 from submission_invitations i left join releases r on r.id=project.release_id
      where i.id=NEW.invitation_id and project.owner_email=lower(i.invitee_email)
        and lower(project.artist_name)=lower(NEW.artist_details->>'displayName') and NEW.release_details->>'kind'='album'
        and (r.id is null or r.lifecycle_status in ('draft','in_review'))) THEN
      RAISE EXCEPTION 'Album must belong to this verified invitation and artist, and be unpublished.';
    END IF;
    IF NEW.release_details->>'trackNumber' IS NULL OR (NEW.release_details->>'trackNumber')::integer NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Choose a track number between 1 and 100.';
    END IF;
    IF NEW.status NOT IN ('rejected','withdrawn') AND EXISTS(select 1 from submissions other where other.id<>NEW.id
      and other.release_details->>'albumProjectId'=project.id::text and other.status not in ('rejected','withdrawn')
      and other.release_details->>'trackNumber'=NEW.release_details->>'trackNumber') THEN
      RAISE EXCEPTION 'That album track number is already reserved. Choose an unused number.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
-- A new project and shared-cover reconciliation belong to the draft write,
-- rather than a later request whose failure could leave a partial selection.
CREATE FUNCTION reconcile_submission_release_intake() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project_id uuid; project_title text; shared_cover uuid;
BEGIN
  IF NEW.status NOT IN ('draft','clarification_requested') THEN RETURN NEW; END IF;
  IF NEW.release_details->>'kind'='album' AND nullif(NEW.release_details->>'albumProjectId','') IS NULL THEN
    INSERT INTO submission_release_projects(owner_email,artist_name,title,origin_submission_id)
      SELECT lower(i.invitee_email),NEW.artist_details->>'displayName',NEW.release_details->>'title',NEW.id
      FROM submission_invitations i WHERE i.id=NEW.invitation_id
      ON CONFLICT(origin_submission_id) DO UPDATE SET artist_name=excluded.artist_name,title=excluded.title
        WHERE NOT EXISTS(select 1 from releases where id=submission_release_projects.release_id)
          AND NOT EXISTS(select 1 from submissions s where s.release_details->>'albumProjectId'=submission_release_projects.id::text and s.id<>NEW.id)
          AND ROW(submission_release_projects.artist_name,submission_release_projects.title) IS DISTINCT FROM ROW(excluded.artist_name,excluded.title);
    SELECT p.id,p.title INTO project_id,project_title FROM submission_release_projects p JOIN submission_invitations i ON i.id=NEW.invitation_id
      WHERE p.origin_submission_id=NEW.id AND p.owner_email=lower(i.invitee_email) AND lower(p.artist_name)=lower(NEW.artist_details->>'displayName');
    IF NOT FOUND THEN RAISE EXCEPTION 'Album identity changed. Reload and choose your album.'; END IF;
    UPDATE submissions SET release_details=release_details||jsonb_build_object('albumProjectId',project_id,'title',project_title) WHERE id=NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.release_details->>'kind'='album' THEN
    SELECT sc.cover_id INTO shared_cover FROM submissions other JOIN submission_cover_selections sc ON sc.submission_id=other.id
      JOIN submission_cover_uploads c ON c.id=sc.cover_id
      WHERE other.id<>NEW.id AND nullif(other.release_details->>'albumProjectId','')=nullif(NEW.release_details->>'albumProjectId','')
        AND c.status='ready' AND submission_may_use_cover(NEW.id,c.id)
      ORDER BY c.created_at,c.id LIMIT 1;
  END IF;
  IF shared_cover IS NOT NULL THEN
    INSERT INTO submission_cover_selections(submission_id,cover_id) VALUES(NEW.id,shared_cover)
      ON CONFLICT(submission_id) DO UPDATE SET cover_id=excluded.cover_id WHERE submission_cover_selections.cover_id<>excluded.cover_id;
  ELSE
    DELETE FROM submission_cover_selections sc WHERE sc.submission_id=NEW.id AND NOT submission_may_use_cover(NEW.id,sc.cover_id);
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER submission_release_intake_reconcile AFTER INSERT OR UPDATE OF artist_details,release_details,invitation_id ON submissions FOR EACH ROW EXECUTE FUNCTION reconcile_submission_release_intake();
--> statement-breakpoint
-- Managed releases can only be published inside the audited atomic publisher.
CREATE FUNCTION require_atomic_release_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lifecycle_status IN ('scheduled','published') AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
    AND (EXISTS(select 1 from submission_release_projects where release_id=NEW.id)
      OR EXISTS(select 1 from tracks t join release_preparation_jobs j on j.track_id=t.id where t.release_id=NEW.id))
    AND current_setting('sunsyn.atomic_publish_release',true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'Publish this accepted release through the Publishing queue.';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER release_atomic_publication_gate BEFORE UPDATE OF lifecycle_status ON releases FOR EACH ROW EXECUTE FUNCTION require_atomic_release_publication();
