import { sql } from "drizzle-orm";

/** The same immutable declaration eligibility used by the exclusive queue claim. */
export function curationEligibilitySql() {
  return sql`exists (
    select 1 from rights_declarations
    where submission_id = submissions.id and status = 'attested'
      and authority_basis <> 'other' and cardinality(territories) > 0
      and nullif(btrim(entitlement_statement), '') is not null
  ) and exists (
    select 1 from creative_process_disclosures
    where submission_id = submissions.id and status = 'finalized'
      and nullif(btrim(artist_summary), '') is not null
      and jsonb_array_length(human_roles) > 0
      and (not ai_used or jsonb_array_length(ai_tools) > 0)
  ) and exists (
    select 1 from provenance_records
    where submission_id = submissions.id and status = 'finalized'
  )`;
}

export function curationAudioSql() {
  return sql`exists (select 1 from submission_review_audio_selections
    where submission_id = submissions.id)`;
}

export function curationReadySql() {
  return sql`submissions.status in ('received', 'eligibility_review')
    and submissions.assigned_curator_id is null
    and ${curationAudioSql()} and ${curationEligibilitySql()}`;
}
