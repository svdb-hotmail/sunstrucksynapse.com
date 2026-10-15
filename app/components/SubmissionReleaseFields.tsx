import { useState } from "react";
import { GENRES, MOODS, PROCESS_TAGS } from "~/config/music-metadata";
import type { ReleaseSubmissionDetails, TrackSubmissionDetails } from "~/types/submissions";
import { MultiSelect } from "./MultiSelect";
export function SubmissionReleaseFields({
  release,
  track,
  albums,
}: {
  release: ReleaseSubmissionDetails;
  track: TrackSubmissionDetails;
  albums: { id: string; title: string; artistName: string; nextTrackNumber?: number }[];
}) {
  const [kind, setKind] = useState(release.kind ?? "single");
  const [albumId, setAlbumId] = useState(release.albumProjectId ?? "");
  const [trackNumber, setTrackNumber] = useState(String(release.trackNumber ?? 1));
  return (
    <div className="submission-field-full">
      <input type="hidden" name="intakeVersion" value="1" />
      <fieldset className="submission-disclosure-options">
        <legend>Where does this track belong?</legend>
        <label>
          <input
            type="radio"
            name="release.kind"
            value="single"
            checked={kind === "single"}
            onChange={() => setKind("single")}
          />
          Single
        </label>
        <label>
          <input
            type="radio"
            name="release.kind"
            value="album"
            checked={kind === "album"}
            onChange={() => setKind("album")}
          />
          Part of an album
        </label>
      </fieldset>
      {kind === "album" ? (
        <div className="submission-field-grid">
          <label>
            Album
            <select
              name="release.albumProjectId"
              value={albumId}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setAlbumId(value);
                setTrackNumber(String(albums.find((a) => a.id === value)?.nextTrackNumber ?? 1));
              }}
            >
              <option value="">Start a new album</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} — {a.artistName}
                </option>
              ))}
            </select>
          </label>
          {albumId ? (
            <input
              type="hidden"
              name="release.title"
              value={albums.find((a) => a.id === albumId)?.title ?? release.title}
            />
          ) : (
            <label>
              Album title
              <input
                name="release.title"
                defaultValue={release.kind === "album" ? release.title : ""}
                required
                maxLength={200}
              />
            </label>
          )}
          <label>
            Track number
            <input
              type="number"
              name="release.trackNumber"
              min={1}
              max={100}
              value={trackNumber}
              onChange={(e) => setTrackNumber(e.currentTarget.value)}
              required
            />
          </label>
          <p>
            Submit each track individually and choose the same album. Complete album uploads are not
            available yet.
          </p>
        </div>
      ) : null}
      <h3>Help listeners find your music</h3>
      <p>Select one or more options in each dropdown.</p>
      <div className="submission-field-grid">
        <MultiSelect
          name="track.genres"
          label="Genres"
          options={GENRES}
          defaultValue={track.genres}
        />
        <MultiSelect name="track.moods" label="Moods" options={MOODS} defaultValue={track.moods} />
        <MultiSelect
          name="track.processTags"
          label="Creative process tags"
          options={PROCESS_TAGS}
          defaultValue={track.processTags}
        />
      </div>
    </div>
  );
}
