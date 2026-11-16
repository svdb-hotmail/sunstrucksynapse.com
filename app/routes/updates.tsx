import { ProductReleaseHistory } from "~/components/ProductReleaseNotes";
import { SITE_NAME, SITE_URL } from "~/config/brand";

export const meta = () => [
  { title: `What’s new | ${SITE_NAME}` },
  {
    name: "description",
    content:
      "SunSyn release notes and version history: new features, improvements and fixes in plain language.",
  },
  { tagName: "link", rel: "canonical", href: new URL("/updates", SITE_URL).href },
];

export default ProductReleaseHistory;
