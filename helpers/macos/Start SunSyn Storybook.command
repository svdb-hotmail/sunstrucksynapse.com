#!/bin/zsh

emulate -L zsh
set -euo pipefail

die() {
  print -u2 -- "SunSyn Storybook launcher: $*"
  pause_for_readability
  exit 1
}

pause_for_readability() {
  print -r -- ""
  print -r -- "Press Enter to close this window."
  read -r </dev/tty || true
}

script_path="${0:A}"
script_dir="${script_path:h}"
repo_root="${script_dir:h:h}"

if [[ ! -d "$repo_root" ]]; then
  die "Could not locate the repository root from $script_path."
fi

cd "$repo_root"

if [[ ! -f .nvmrc ]]; then
  die "Missing .nvmrc at the repository root."
fi

nvm_loaded=0
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
for nvm_sh in \
  "$NVM_DIR/nvm.sh" \
  "/opt/homebrew/opt/nvm/nvm.sh" \
  "/usr/local/opt/nvm/nvm.sh"
do
  if [[ -s "$nvm_sh" ]]; then
    # shellcheck disable=SC1090
    . "$nvm_sh"
    nvm_loaded=1
    break
  fi
done

if (( nvm_loaded )); then
  nvm install || die "Unable to install the Node version from .nvmrc."
  nvm use || die "Unable to activate the Node version from .nvmrc."
else
  command -v node >/dev/null 2>&1 || die "Node.js 22.22.0 or later is required."
  command -v npm >/dev/null 2>&1 || die "npm is required."

  required_node_version="$(< .nvmrc)"
  current_node_version="$(node -p 'process.versions.node')"

  if ! node -e '
    const [required, current] = process.argv.slice(1);
    const parse = (value) => value.split(".").map((part) => Number.parseInt(part, 10));
    const [reqMajor, reqMinor, reqPatch] = parse(required);
    const [curMajor, curMinor, curPatch] = parse(current);
    const isAtLeast =
      curMajor > reqMajor ||
      (curMajor === reqMajor &&
        (curMinor > reqMinor || (curMinor === reqMinor && curPatch >= reqPatch)));
    process.exit(isAtLeast ? 0 : 1);
  ' "$required_node_version" "$current_node_version"; then
    die "Node.js $required_node_version or later is required; found $current_node_version."
  fi
fi

command -v npm >/dev/null 2>&1 || die "npm is required."

dependencies_stamp="node_modules/.package-lock.json"
if [[ ! -d node_modules || ! -f "$dependencies_stamp" || "$dependencies_stamp" -ot package-lock.json || "$dependencies_stamp" -ot package.json ]]; then
  print -r -- "Installing dependencies with npm ci --no-audit --no-fund..."
  npm ci --no-audit --no-fund || die "Dependency installation failed."
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:6006 -sTCP:LISTEN >/dev/null 2>&1; then
  die "Port 6006 is already in use. Quit the process using it and launch Storybook again."
fi

print -r -- "Launching SunSyn Storybook at http://127.0.0.1:6006"
print -r -- "Storybook runs from stories and mock inputs, not the Worker runtime, routes, or database."

int_received=0
trap 'int_received=1' INT
set +e
npm run storybook -- --host 127.0.0.1 --exact-port --disable-telemetry --no-version-updates
exit_status=$?
set -e
trap - INT

if (( int_received )); then
  print -r -- "Storybook stopped."
  pause_for_readability
  exit 0
fi

if (( exit_status != 0 )); then
  die "Storybook stopped with exit code $exit_status."
fi

print -r -- "Storybook stopped."
pause_for_readability
