export const GENRES = [
  "Alternative",
  "Ambient",
  "Blues",
  "Classical",
  "Cinematic",
  "Country",
  "Dance",
  "Electronic",
  "Experimental",
  "Folk",
  "Funk",
  "Hip-hop",
  "House",
  "Indie",
  "Jazz",
  "Latin",
  "Metal",
  "Pop",
  "Reggae",
  "R&B",
  "Rock",
  "Soul",
  "Techno",
  "World",
] as const;
export const MOODS = [
  "Calm",
  "Dreamy",
  "Energetic",
  "Euphoric",
  "Hopeful",
  "Intense",
  "Melancholic",
  "Mysterious",
  "Nostalgic",
  "Playful",
  "Reflective",
  "Romantic",
  "Somber",
  "Uplifting",
] as const;
export const PROCESS_TAGS = [
  "AI-assisted composition",
  "AI-generated instrumental",
  "AI-generated vocals",
  "Human composition",
  "Human lyrics",
  "Human performance",
  "Arrangement & editing",
  "Live instruments",
  "Sampling",
  "Sound design",
  "Mixing",
  "Mastering",
] as const;
export const COVER_MIN_PIXELS = 1400;
export const COVER_RECOMMENDED_PIXELS = 3000;
export const COVER_MAX_BYTES = 20 * 1024 * 1024;
export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const COVER_RIGHTS_STATEMENT =
  "By uploading this cover, I confirm that I have permission for SunSyn to store it privately and publish it as this release's artwork.";
export const STREAMING_PROFILE = "sunsyn-mp3-320k-44100-stereo-v1";
export function validSelections(values: unknown, options: readonly string[]): values is string[] {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.length <= options.length &&
    values.every((value) => typeof value === "string" && options.includes(value)) &&
    new Set(values).size === values.length
  );
}
