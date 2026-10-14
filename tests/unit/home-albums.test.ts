import { describe, expect, it, vi } from "vitest";
import { loader } from "../../app/routes/home";
import { makeCatalogueItem } from "../fixtures/catalogue";

describe("homepage album presentation", () => {
  it("loads release artwork and all release credits instead of track presentation", async () => {
    const track = makeCatalogueItem("track");
    const album = {
      ...track.release,
      releaseDate: null,
      artwork: { src: "/album-cover.jpg", alt: "Album cover" },
      artists: [track.creator, { ...track.creator, id: "guest", name: "Guest artist" }],
      tracks: [track],
    };
    const findPublishedRelease = vi.fn().mockResolvedValue(album);
    const result = await loader({
      context: {
        get: () => ({
          catalogueRepository: {
            listPublishedTracks: async () => [track, { ...track, id: "other-track" }],
            findPublishedRelease,
          },
        }),
      },
    } as unknown as Parameters<typeof loader>[0]);
    expect(findPublishedRelease).toHaveBeenCalledTimes(1);
    expect(result.albums[0].artwork).toEqual(album.artwork);
    expect(result.albums[0].artists).toHaveLength(2);
  });
  it("preserves catalogue degradation when release presentation cannot be loaded", async () => {
    const result = await loader({
      context: {
        get: () => ({
          catalogueRepository: {
            listPublishedTracks: async () => {
              throw new Error("Database unavailable");
            },
          },
        }),
      },
    } as unknown as Parameters<typeof loader>[0]);
    expect(result.albums).toEqual([]);
  });
});
