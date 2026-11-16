# User-facing versions and release notes

SunSyn starts its numbered release history at **0.1.0**. Older work was not
assigned public versions; do not invent retrospective versions or release dates.

The version badge in the listener header and curator workspace opens the current
release notes. `/updates` is the public, shareable history; each release has a
stable anchor such as `/updates#release-0.1.0`. These are product updates, separate
from music releases in the catalogue.

## Preparing an update

1. Choose a product version. Before 1.0, use a minor increment for a meaningful
   feature and a patch increment for fixes. Version numbers describe shipped
   user-visible changes, not individual commits.
2. Update the version with `npm version patch --no-git-tag-version` (or `minor`,
   or a specific version). This updates `package.json` and `package-lock.json`.
3. Prepend the matching entry to `app/data/product-releases.ts`: version, date,
   short title, summary and grouped notes. Keep all previous entries. Their
   anchors and historical notes must continue to work.
4. Explain what people can do or what has improved. Use plain language. Avoid
   commit messages, ticket numbers, dependency versions and internal tooling.
   Do not list unmerged features or planned work as available.
5. Run the focused version consistency test and inspect the shared production
   components under **Production / Product updates** in Storybook, in light and
   dark themes. The PR workflow performs broader verification when ready.

The notes and version ship in the same application build. Opening notes needs no
additional service, database or network request. The shared dialog supports
Escape, keyboard focus restoration and small screens. Navigating to the history
keeps the listener's existing player mounted.

Updating this metadata does not create a GitHub release, tag, merge or deploy.
Those remain separate release decisions.
