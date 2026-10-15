import { GENRES, MOODS, PROCESS_TAGS, validSelections } from "~/config/music-metadata";

export interface SubmissionEditorialFields {
  title: string;
  releaseTitle: string;
  summary: string;
  genres: string[];
  moods: string[];
  processTags: string[];
}

export function validateEditorialFields(value: unknown): SubmissionEditorialFields {
  if (!value || typeof value !== "object") throw new Error("Enter the submission details.");
  const v = value as SubmissionEditorialFields;
  if ([v.title, v.releaseTitle].some((s) => typeof s !== "string" || !s.trim() || s.length > 200))
    throw new Error("Track and release titles must contain 1–200 characters.");
  if (typeof v.summary !== "string" || v.summary.length > 5000)
    throw new Error("Keep the release description within 5000 characters.");
  const choices = (value: unknown, options: readonly string[]) =>
    Array.isArray(value) && (value.length === 0 || validSelections(value, options));
  if (
    !choices(v.genres, GENRES) ||
    !choices(v.moods, MOODS) ||
    !choices(v.processTags, PROCESS_TAGS)
  )
    throw new Error("Choose genres, moods and process tags from the available options.");
  return {
    title: v.title.trim(),
    releaseTitle: v.releaseTitle.trim(),
    summary: v.summary.trim(),
    genres: v.genres,
    moods: v.moods,
    processTags: v.processTags,
  };
}

export interface SubmissionEditView {
  id: string;
  reference: string;
  status: string;
  artistName: string;
  trackId: string | null;
  releaseId: string | null;
  fields: SubmissionEditorialFields;
  revision: string;
  editable: boolean;
  releaseFieldsEditable?: boolean;
  coverUrl: string | null;
}
