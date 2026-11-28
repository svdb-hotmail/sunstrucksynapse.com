export interface ProductRelease {
  version: string;
  date: string | null;
  title: string;
  summary: string;
  groups: readonly { heading: string; items: readonly string[] }[];
}

/** Newest first. Published entries remain here when a new version is added. */
export const PRODUCT_RELEASES = [
  {
    version: "0.1.0",
    date: null,
    title: "A clearer view of what’s new",
    summary:
      "This starts SunSyn’s numbered release history. See what’s changed while you listen, and share links to individual updates.",
    groups: [
      {
        heading: "New in this version",
        items: [
          "Select the version badge to see what has changed without leaving your music.",
          "Read the full release history and share a link to a specific version.",
        ],
      },
      {
        heading: "Recent listening improvements",
        items: [
          "On a phone, open About directly from the header.",
          "Shared links can show a playable cover-art preview on services that support video previews, when one is available for the track.",
        ],
      },
      {
        heading: "Already part of SunSyn",
        items: [
          "Discover music by genre and mood, explore artists and releases, and build a listening queue.",
          "Invited artists can send private listening copies and describe how their music was made.",
          "Curators can listen, assess submissions and choose what to publish in their workspace.",
        ],
      },
    ],
  },
] as const satisfies readonly ProductRelease[];

export const CURRENT_RELEASE = PRODUCT_RELEASES[0];
export const APP_VERSION = CURRENT_RELEASE.version;
