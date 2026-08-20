# Accessibility and browser review

The critical listener contract uses semantic headings, labelled navigation, native media controls,
keyboard-operable buttons, visible focus, live status/error announcements, reduced-motion handling,
and responsive layouts without horizontal overflow.

The E2E matrix covers:

- Chromium desktop (Chrome and the shared Edge engine);
- Firefox desktop;
- WebKit desktop (Safari engine);
- Pixel 5 Chromium emulation (representative Android);
- iPhone 13 WebKit emulation (representative iOS).

The compatibility journey verifies keyboard activation, focus, reduced motion, global-player
selection, and semantic navigation on every desktop engine. The mobile journey verifies playback,
queueing, navigation, and overflow on Android and iOS profiles. Native assistive-technology checks
with VoiceOver, TalkBack, NVDA, and branded Edge/Safari releases remain a human release check;
engine automation does not replace them.

No critical or high-severity defect is known in the automated journeys. Any failure that prevents
navigation, track selection, playback control, queue control, error recovery, form completion, or
policy access blocks beta.
