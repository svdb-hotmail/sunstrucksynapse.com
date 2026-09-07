# macOS launchers

These Finder-clickable helpers start the local fixture-backed app or the component Storybook in a Terminal window.

How to use them:

- Double-click a `.command` file, or right-click it and choose `Open` the first time so macOS permits the script.
- Both launchers resolve the repository root relative to themselves, load a common `nvm` installation when available, and otherwise require local Node.js `22.22.0` or later plus `npm`.
- Both run `npm ci --no-audit --no-fund` only when `node_modules` is missing or stale compared with `package-lock.json` or `package.json`.
- Both keep the launched process in the foreground, pause after startup failure or shutdown, and use the same narrow Ctrl-C handling so interruption becomes a normal readable exit.

Comparison:

| Helper                           | Port   | What it exercises                                                                                 | What it does not exercise                                                 |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Start SunSyn UI.command`        | `5173` | The fixture-backed app in `--mode test` with the Worker runtime, routes, and local test fixtures. | Online data, production configuration, or live database/storage bindings. |
| `Start SunSyn Storybook.command` | `6006` | Component stories and mock inputs for isolated UI work.                                           | Routes, Worker runtime behavior, or database behavior.                    |

Fixture app on `5173`:

- Starts `npm run dev -- --mode test --host 127.0.0.1 --port 5173 --strictPort --open`.
- Uses the fixture-backed runtime defined for local E2E-style development in `workers/app.ts`.
- Each fresh launch starts from a clean in-memory/test fixture state rather than persisted online data.
- Press `Ctrl-C` in Terminal to stop it.

Storybook on `6006`:

- Starts `npm run storybook -- --host 127.0.0.1 --exact-port --disable-telemetry --no-version-updates`.
- Uses stories and mock inputs for component-level work.
- Proves the isolated UI layer without exercising routes, Worker logic, or database behavior.
- Press `Ctrl-C` in Terminal to stop it.

Running both together:

- After the first dependency installation finishes, both helpers can run at the same time.
- If you launch them back to back on a fresh setup, let the first `npm ci` finish before starting the second helper.
- If either port is already busy, the helper stops with a clear message instead of stealing the port.

Safety notes:

- The launchers do not configure or mutate `.env`.
- Underlying tooling may still discover environment files as part of its normal startup behavior.
- Neither launcher connects to the application's online catalogue, database, or storage.
- Dependency installation may contact npm during the first run or when `node_modules` is stale.
- If you need real data, use a separately approved isolated non-production configuration outside these helpers.
