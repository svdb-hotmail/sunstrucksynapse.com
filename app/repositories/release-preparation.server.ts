import { sql } from "drizzle-orm";
import type { Database } from "~/db/client.server";
import { STREAMING_PROFILE } from "~/config/music-metadata";

function rows<T>(value: unknown): T[] {
  return (Array.isArray(value) ? value : (value as { rows: T[] }).rows) as T[];
}
export interface EncodingOutput {
  objectKey: string;
  checksumSha256: string;
  byteSize: number;
  durationMs: number;
  sampleRate: number;
  channels: number;
  bitRate: number;
  profile: string;
}
export interface PreparationLease {
  id: string;
  trackId: string;
  leaseToken: string;
  sourceKey: string;
  sourceChecksum: string;
  sourceByteSize: number;
  sourceMime: string;
  sourceDurationMs: number;
  outputKey: string;
  profile: string;
}

export function createReleasePreparationRepository(db: Database) {
  return {
    async audioForCurator(trackId: string) {
      return (
        rows<{ objectKey: string; byteSize: number; mimeType: string; filename: string }>(
          await db.execute(sql`
        select j.output_object_key as "objectKey",j.output_byte_size::float8 as "byteSize",'audio/mpeg' as "mimeType",t.title||'.mp3' as filename
        from release_preparation_jobs j join tracks t on t.id=j.track_id
        where j.track_id=${trackId}::uuid and j.status='ready' and j.profile=${STREAMING_PROFILE}`),
        )[0] ?? null
      );
    },
    async claim(): Promise<PreparationLease | null> {
      // The final lease can expire after a worker interruption. Make that state
      // visible instead of leaving an exhausted task stuck in Processing.
      await db.execute(sql`update release_preparation_jobs set status=case when attempts>=4 then 'failed' else 'queued' end,failure_code='PREPARATION_INTERRUPTED',lease_token=null,lease_expires_at=null,next_attempt_at=now(),updated_at=now()
        where status='processing' and lease_expires_at<now()`);
      const lease = crypto.randomUUID();
      try {
        return (
          rows<PreparationLease>(
            await db.execute(sql`with candidate as (
        select j.id from release_preparation_jobs j join curation_reviews r on r.id=j.review_id
        join submissions s on s.id=r.submission_id and s.resulting_track_id=j.track_id
        where s.status='accepted' and j.profile=${STREAMING_PROFILE} and j.attempts<4
          and j.status='queued' and j.next_attempt_at<=now()
          and not exists(select 1 from release_preparation_jobs active where active.status='processing')
        order by j.created_at,j.id limit 1 for update of j skip locked
      ), claimed as (update release_preparation_jobs j set status='processing',attempts=attempts+1,lease_token=${lease}::uuid,
        lease_expires_at=now()+interval '12 minutes',updated_at=now(),failure_code=null
        from candidate c where j.id=c.id returning j.*)
      select c.id,c.track_id as "trackId",c.lease_token as "leaseToken",a.object_key as "sourceKey",a.checksum_sha256 as "sourceChecksum",
        a.byte_size::float8 as "sourceByteSize",a.mime_type as "sourceMime",a.duration_ms as "sourceDurationMs",c.profile,
        'private/streaming-preparation/'||c.id||'/'||c.lease_token||'.mp3' as "outputKey"
      from claimed c join submission_review_audio a on a.id=c.source_audio_id`),
          )[0] ?? null
        );
      } catch (error) {
        // A unique partial index is the final concurrent-claim boundary. The
        // losing transaction consumes no attempt and leaves the task queued.
        if (
          error &&
          typeof error === "object" &&
          "cause" in error &&
          (error.cause as { code?: string })?.code === "23505"
        )
          return null;
        throw error;
      }
    },
    async complete(job: PreparationLease, output: EncodingOutput) {
      return (
        rows<{ id: string }>(
          await db.execute(sql`update release_preparation_jobs set status='ready',output_object_key=${output.objectKey},
        output_checksum=${output.checksumSha256},output_byte_size=${output.byteSize},output_duration_ms=${output.durationMs},
        sample_rate=${output.sampleRate},channels=${output.channels},bit_rate=${output.bitRate},lease_token=null,lease_expires_at=null,updated_at=now()
        where id=${job.id}::uuid and lease_token=${job.leaseToken}::uuid and status='processing' and lease_expires_at>now()
          and profile=${STREAMING_PROFILE} returning id`),
        ).length === 1
      );
    },
    async fail(job: PreparationLease, code: string) {
      await db.execute(sql`update release_preparation_jobs set status=case when attempts>=4 then 'failed' else 'queued' end,
        next_attempt_at=now()+interval '1 minute'*power(2,attempts),failure_code=${code},lease_token=null,lease_expires_at=null,updated_at=now()
        where id=${job.id}::uuid and lease_token=${job.leaseToken}::uuid and status='processing'`);
    },
    async retry(trackId: string, actor: { id: string; email: string }) {
      await db.batch([
        db.execute(sql`with retried as (update release_preparation_jobs set status='queued',attempts=0,next_attempt_at=now(),failure_code=null,updated_at=now()
          where track_id=${trackId}::uuid and status in ('queued','failed') returning track_id)
          insert into publication_audit(entity_type,entity_id,from_lifecycle,to_lifecycle,actor_id,actor_email,reason)
          select 'track',t.id,t.lifecycle_status,t.lifecycle_status,${actor.id},${actor.email},'Retry automatic streaming preparation'
          from tracks t join retried r on r.track_id=t.id`),
      ]);
    },
  };
}
