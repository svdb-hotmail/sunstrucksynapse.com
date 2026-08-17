# Private beta release evaluation

## Current decision: STOP — external gates not yet executed

Repository implementation for Phases 3–5 is prepared, but a private beta cannot be represented as
complete without a rights-cleared catalogue, production-like delivery, provider recovery drill, and
real invited participants.

## Invitation and onboarding

Invite 20–50 listeners individually. The invitation must explain that this is a private evaluation,
link to the privacy notice, identify supported browsers, provide playback troubleshooting, and
direct:

- product/editorial feedback to the agreed feedback tracker;
- technical incidents to a separate incident form containing browser, device, time, track, and
  symptom, but no signed media URL.

## Release gates

| Gate                        | Required                                               | Current evidence                                            |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Prepared catalogue          | 10–20 artists, 30–50 reviewed tracks, five collections | Pending real content; run `npm run catalogue:audit`         |
| Return rate                 | At least 25% of invitees start a second session        | Pending cohort                                              |
| Curator release preparation | Prepared release published in under 15 minutes         | Workflow exists; timed operator exercise pending            |
| Playback starts             | Above 98%                                              | Semantic events exist; production-like sample pending       |
| Median playback start       | Below 1.5 seconds                                      | Measurement procedure documented; production sample pending |
| Backup restore              | Isolated provider restore verified                     | Local reconstruction passes; provider drill pending         |
| Accessibility               | No critical/high defects                               | Automated engine matrix exists; native AT check pending     |

## Evaluation

After the cohort window, export aggregate counts from the protected analytics dashboard and record
invited count, first-session count, second-session count, playback sample, median/p95 start time,
failure classes, curator timing, accessibility findings, product feedback themes, and technical
incidents. Do not publish low-volume participant-level data.

Convert confirmed findings into prioritized issues with severity, evidence, owner, and release
impact. The human maintainer records **GO**, **ITERATE**, or **STOP** only after every table row has
measured evidence. Silence and implementation readiness are not approval.
