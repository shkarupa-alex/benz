#!/bin/sh
# Installs a systemd *user* timer that runs one Fuel Watch collection every monitoring.intervalMinutes, so the
# history keeps growing without an agent in the loop. Hermes (or any agent) then only reads it with
# dist/scripts/history-stats.mjs. The script never edits the user config and needs no root.
#
#   sh deploy/linux/install-systemd-user.sh            install or update, then start the timer
#   sh deploy/linux/install-systemd-user.sh --print    print the units it would install and exit
#   sh deploy/linux/install-systemd-user.sh --uninstall
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME=fuel-watch-collect
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
HOME_DIR="${FUEL_WATCH_HOME:-$HOME/.fuel-watch}"
MODE="${1:-install}"

die() { echo "fuel-watch: $*" >&2; exit 1; }
note() { echo "fuel-watch: $*" >&2; }

if [ "$MODE" = "--uninstall" ]; then
  systemctl --user disable --now "$NAME.timer" 2>/dev/null || true
  rm -f "$UNIT_DIR/$NAME.timer" "$UNIT_DIR/$NAME.service"
  systemctl --user daemon-reload
  note "timer removed; history in $HOME_DIR/history is kept"
  exit 0
fi
case "$MODE" in install|--print) ;; *) die "unknown argument: $MODE" ;; esac

command -v node >/dev/null 2>&1 || die "node is not on PATH (Node.js 22+ is required)"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || die "Node.js 22+ is required, found $(node --version)"
# Paths go into unit files, where systemd treats % as a specifier and $, quotes and backslashes specially; refuse
# them rather than escape them. Spaces are fine: every path is written inside double quotes.
unit_path() {
  case "$1" in *%*|*\$*|*\"*|*\\*|*"
"*) die "unsupported character (% \$ \" \\ or newline) in path: $1" ;; esac
}
unit_path "$ROOT"
unit_path "$HOME_DIR"
[ -f "$ROOT/dist/scripts/collect.mjs" ] || die "$ROOT/dist/scripts/collect.mjs is missing; install the whole skill directory"
if ! command -v agent-browser >/dev/null 2>&1; then
  [ "$MODE" = "--print" ] || die "agent-browser is not on PATH; install it yourself as SKILL.md describes (the skill never installs it)"
fi
# Chrome runs headed (the sources reject headless); on a server without a display agent-browser starts Xvfb itself
# when it is installed. Do not wrap the collector in xvfb-run.
if [ -z "${DISPLAY:-}" ] && ! command -v Xvfb >/dev/null 2>&1; then note "warning: no DISPLAY and no Xvfb; install the xvfb package or the headed browser cannot start"; fi

# The interval and retention come from the user config when it exists, otherwise from the template the first
# collection will copy there.
CONFIG="$HOME_DIR/config/config.json"
[ -f "$CONFIG" ] || CONFIG="$ROOT/dist/config/config.json"
SETTINGS="$(node -e 'const c = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); console.log(`${c.monitoring.intervalMinutes} ${c.history.retentionDays}`)' "$CONFIG")"
INTERVAL="${SETTINGS% *}"
RETENTION="${SETTINGS#* }"
if [ "$RETENTION" -lt 90 ]; then note "note: $CONFIG keeps history for $RETENTION days; set history.retentionDays to 90 there for long-range statistics"; fi

# The forecast treats a gap longer than three intervals as missing data, so the timer must fire at the configured
# interval. Wall-clock slots when the interval divides an hour or a day, otherwise a fixed period from the last run.
if [ $((60 % INTERVAL)) -eq 0 ]; then SCHEDULE="OnCalendar=*:0/$INTERVAL"
elif [ $((INTERVAL % 60)) -eq 0 ] && [ $((1440 % INTERVAL)) -eq 0 ]; then SCHEDULE="OnCalendar=0/$((INTERVAL / 60)):00"
else SCHEDULE="OnBootSec=2min
OnUnitActiveSec=${INTERVAL}min"; fi

NODE_DIR="$(dirname "$(command -v node)")"
BROWSER_DIR="$(dirname "$(command -v agent-browser 2>/dev/null || echo /usr/local/bin/agent-browser)")"
unit_path "$NODE_DIR"
unit_path "$BROWSER_DIR"
SERVICE="[Unit]
Description=Fuel Watch: one background AI-95 availability collection
Documentation=man:systemd.timer(5)

[Service]
Type=oneshot
Environment=\"FUEL_WATCH_ROOT=$ROOT\"
Environment=\"FUEL_WATCH_HOME=$HOME_DIR\"
Environment=\"PATH=$NODE_DIR:$BROWSER_DIR:/usr/local/bin:/usr/bin:/bin\"
ExecStart=/bin/sh \"$ROOT/deploy/linux/fuel-watch-collect.sh\"
TimeoutStartSec=15min
TimeoutStopSec=60
Nice=10
"
TIMER="[Unit]
Description=Fuel Watch: collect every $INTERVAL minutes

[Timer]
$SCHEDULE
RandomizedDelaySec=60
AccuracySec=1s
Unit=$NAME.service

[Install]
WantedBy=timers.target
"

if [ "$MODE" = "--print" ]; then printf '# %s.service\n%s\n# %s.timer\n%s' "$NAME" "$SERVICE" "$NAME" "$TIMER"; exit 0; fi

command -v systemctl >/dev/null 2>&1 || die "systemctl is not available; use cron with deploy/linux/fuel-watch-collect.sh instead"
mkdir -p "$UNIT_DIR"
printf '%s' "$SERVICE" >"$UNIT_DIR/$NAME.service"
printf '%s' "$TIMER" >"$UNIT_DIR/$NAME.timer"
systemctl --user daemon-reload
systemctl --user enable --now "$NAME.timer"
if [ "$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || echo unknown)" != "yes" ]; then
  note "user lingering is off: the timer stops when you log out. Ask an administrator to run: sudo loginctl enable-linger $(id -un)"
fi
note "installed: every $INTERVAL min. Next run: systemctl --user list-timers $NAME.timer; log: journalctl --user -u $NAME.service"
