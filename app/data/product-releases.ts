export interface ProductRelease {
  version: string;
  date: string;
  title: string;
  summary: string;
  groups: readonly { heading: string; items: readonly string[] }[];
}

/** Newest first. Published entries remain here when a new version is added. */
export const PRODUCT_RELEASES = [
  {
    version: "0.1.0",
    date: "2026-11-16",
    title: "A clearer view of what’s new",
    summary:
      "SunSyn now has a visible version and a home for updates, written for the people listening, submitting music and curating it.",
    groups: [
      {
        heading: "New in this version",
        items: [
          "Select the version badge to see what has changed without leaving your music.",
          "Read the full release history and share a link to a specific version.",
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
