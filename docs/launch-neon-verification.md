# Isolated Neon verification

12 October 2026. Solo maintainer exception active; no independent approval claimed.

Target: `frosty-sunset-21512292`, child branch `br-divine-silence-b2q6v9do`, database `launch_verification_20261012`. It is separate from the production default branch and separate from the copied catalogue database. The existing committed migrations were applied in the new test database. No new launch migration was introduced.

Synthetic submissions, declarations, reviews, artists and asset metadata were used solely for database tests. These are not the maintainer's tracks or editorial decisions. R2 objects were not uploaded/copied and production data was not altered.

Actual Neon HTTP/Drizzle repository checks passed accepted-track regrouping with exact lineage, atomic rollback when a selected track is invalid, and rejection of private-only media. Initial long setup and full-publication test timeouts are recorded, not hidden. Publication had committed in the isolated target before the latter timeout. A focused follow-up passed two real repository publication retries with unchanged four publication audit entries and both exact accepted declaration/review links. Readback verifies published positions 1/2, separate public asset metadata and applied cover.

The temporary harness and privileged connection file were kept outside committed source and removed after verification. No connection string is recorded here. The isolated branch/database remain for inspection; no reset or destructive cleanup was performed.

This establishes the repository's actual Neon transaction behavior. It does not establish real R2 upload, private audition, browser playback, deployment or launch. Those checks still require the approved stack to be deployed and the maintainer to use the real human flow.
