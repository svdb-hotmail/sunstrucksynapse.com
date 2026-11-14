import { createStaticCatalogueRepository } from "~/repositories/catalogue.server";
import { createE2eCatalogueRepository } from "~/repositories/catalogue-fixture.server";
import type { CatalogueItem } from "~/types/catalogue";

/** Opt-in visual study only. Reuses fixture media; these names never enter published data. */
export async function createIdentityPreviewCatalogueRepository() {
  const fixture = createE2eCatalogueRepository();
  const sourceItems = await fixture.listPublishedTracks();
  const identities = [
    {
      artist: { id: "preview-artist-aster", slug: "preview-aster", name: "Aster / preview" },
      release: {
        id: "preview-release-aster",
        slug: "preview-aster-release",
        title: "Submerged Geometry / preview",
      },
    },
    {
      artist: { id: "preview-artist-vesper", slug: "preview-vesper", name: "Vesper / preview" },
      release: {
        id: "preview-release-vesper",
        slug: "preview-vesper-release",
        title: "Night Signals / preview",
      },
    },
  ];
  const items: CatalogueItem[] = sourceItems.map((item, index) => {
    if (index < 2) return item;
    const identity = identities[Math.floor((index - 2) / 2)];
    if (!identity) return item;
    const creator = {
      ...item.creator,
      ...identity.artist,
      href: `/artists/${identity.artist.slug}`,
    };
    const release = {
      ...item.release,
      ...identity.release,
      href: `/releases/${identity.release.slug}`,
    };
    const cover =
      index < 4
        ? "/assets/albums/Ethereal Underwater Geometric Halo-2.png"
        : "/assets/albums/Neon Space Lounge with Ringed Planet.png";
    return {
      ...item,
      creator,
      release,
      href: `/tracks/${release.slug}/${item.slug}`,
      artwork: { src: cover, alt: `Preview artwork for ${release.title}` },
      description: { ...item.description, subtitle: `${release.title} · ${creator.name}` },
    };
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  const collections = (await fixture.listPublishedCollections()).map((collection) => ({
    ...collection,
    items: collection.items.map((item) => byId.get(item.id) ?? item),
  }));
  const repository = createStaticCatalogueRepository(items, collections);
  repository.findPublicTrackDisclosure = fixture.findPublicTrackDisclosure;
  return repository;
}
