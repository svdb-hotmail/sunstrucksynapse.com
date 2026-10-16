import { sql } from "drizzle-orm";
import type { Database } from "~/db/client.server";
import {
  publishedCatalogueRow,
  publicListeningMedia,
} from "~/services/catalogue-visibility.server";
import {
  catalogueViews,
  type CatalogueQuery,
  type CuratorCataloguePage,
  type CuratorCatalogueRepository,
} from "~/types/curator-catalogue";
import {
  albumReadiness,
  albumTrackReadinessQuery,
  albumReleaseReadinessQuery,
} from "./album-publishing.server";

export const cataloguePageSize = 25;

export function createCuratorCatalogueRepository(db: Database): CuratorCatalogueRepository {
  return {
    async read(query: CatalogueQuery) {
      // Facets, the keyset page and the selected track share one database snapshot.
      // No per-track HTTP calls, raw media keys, or private artist evidence are returned.
      const result = await db.execute<{ page: CuratorCataloguePage }>(sql`
        with readiness as materialized (${albumTrackReadinessQuery()}), release_readiness as materialized (${albumReleaseReadinessQuery()}), facts as materialized (
          select t.id,t.title,t.slug,t.release_id as "releaseId",r.title as "releaseTitle",r.slug as "releaseSlug",
            t.lifecycle_status as "lifecycleStatus",r.lifecycle_status as "releaseStatus",t.updated_at as "updatedAt",
            t.scheduled_for as "scheduledFor",j.status as "preparationStatus",j.failure_code as "failureCode",
            (select s.id from submissions s where s.resulting_track_id=t.id limit 1) as "submissionId",
            coalesce((select string_agg(a.display_name,', ' order by c.position) from track_artist_credits c join artists a on a.id=c.artist_id where c.track_id=t.id),'No artist credit') as "artistName",
            coalesce((select jsonb_agg(a.lifecycle_status order by c.position) from track_artist_credits c join artists a on a.id=c.artist_id where c.track_id=t.id),'[]'::jsonb) as "artistStatuses",
            (select count(*)::int from tracks sibling where sibling.release_id=t.release_id) as "releaseTrackCount",
            exists(select 1 from track_artist_credits c join artists a on a.id=c.artist_id where c.track_id=t.id and ${publishedCatalogueRow(sql`t.lifecycle_status`, sql`r.lifecycle_status`, sql`a.lifecycle_status`)}) as "publiclyListed",
            ${publicListeningMedia(sql`t.id`)} as "publicMediaReady",
            not (${albumReadiness.cover}=any(ready.blockers)) as "coverReady",
            case when j.status='ready' then '/curator/prepared-audio/'||t.id::text end as "previewUrl",
            ready.blockers || release_ready.blockers || array_remove(array[
              case when exists(select 1 from readiness sibling_ready join tracks sibling on sibling.id=sibling_ready.id where sibling.release_id=t.release_id and sibling.id<>t.id and cardinality(sibling_ready.blockers)>0) then 'Other tracks in this release have unresolved publication checks' end
            ],null)::text[] as blockers
          from tracks t join releases r on r.id=t.release_id join readiness ready on ready.id=t.id join release_readiness release_ready on release_ready.id=r.id
          left join release_preparation_jobs j on j.track_id=t.id
        ), classified as materialized (
          select facts.*,case
            when "lifecycleStatus"='archived' then 'archived'
            when "publiclyListed" and "publicMediaReady" then 'live'
            when "publiclyListed" or "lifecycleStatus"='published' or ("releaseStatus"='published' and "lifecycleStatus" in ('draft','in_review')) then 'attention'
            when "lifecycleStatus"='scheduled' then case when "scheduledFor">current_timestamp then 'scheduled' else 'attention' end
            when "preparationStatus"='failed' then 'attention'
            when cardinality(array_remove(blockers,${albumReadiness.audioPreparation}))>0 then 'attention'
            when "preparationStatus" in ('queued','processing') then 'preparing'
            when cardinality(blockers)=0 then 'ready'
            else 'attention' end as state
          from facts
        ), searched as materialized (
          select * from classified where ${query.query === "" ? sql`true` : sql`strpos(lower(title||' '||"artistName"||' '||"releaseTitle"),lower(${query.query}))>0`}
        ), chosen as (
          select coalesce(${query.view}::text,case when exists(select 1 from searched where state='attention') then 'attention' else 'all' end) as view
        ), page_rows as materialized (
          select * from searched where ((select view from chosen)='all' or state=(select view from chosen))
            and ${query.after ? sql`(lower(title),id)>(lower(${query.after.title}),${query.after.id}::uuid)` : sql`true`}
          order by lower(title),id limit ${cataloguePageSize + 1}
        ), selected as (select * from classified where id=${query.trackId}::uuid)
        select jsonb_build_object(
          'items',coalesce((select jsonb_agg(to_jsonb(p) order by lower(title),id) from (select * from page_rows order by lower(title),id limit ${cataloguePageSize}) p),'[]'::jsonb),
          'view',(select view from chosen),
          'counts',jsonb_build_object('all',(select count(*) from searched),${sql.join(
            catalogueViews
              .filter((v) => v !== "all")
              .map((v) => sql`${v}::text,(select count(*) from searched where state=${v})`),
            sql`, `,
          )}),
          'next',case when (select count(*) from page_rows)>${cataloguePageSize} then (select jsonb_build_object('title',title,'id',id) from page_rows order by lower(title),id offset ${cataloguePageSize - 1} limit 1) end,
          'selected',(select to_jsonb(s) from selected s),
          'history',coalesce((select jsonb_agg(to_jsonb(a) order by a."occurredAt" desc,a.id desc) from (
            select id,entity_type as "entityType",from_lifecycle as "fromLifecycle",to_lifecycle as "toLifecycle",reason,occurred_at as "occurredAt"
            from publication_audit where (entity_type='track' and entity_id=${query.trackId}::uuid) or (entity_type='release' and entity_id=(select "releaseId" from selected))
            order by occurred_at desc,id desc limit 15
          ) a),'[]'::jsonb),'observedAt',current_timestamp
        ) as page
      `);
      const rows = Array.isArray(result) ? result : result.rows;
      if (!rows[0]?.page) throw new Error("Catalogue query returned no result.");
      return rows[0].page;
    },
  };
}
