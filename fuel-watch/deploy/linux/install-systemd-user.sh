#!/bin/sh
# Installs a systemd *user* timer that runs one Fuel Watch collection on a schedule, so the history keeps growing
# without an agent in the loop. Hermes (or any agent) then only reads it with dist/scripts/history-stats.mjs. The
# script never edits the user config and needs no root.
#
#   sh deploy/linux/install-systemd-user.sh                     every history.sampleIntervalMinutes
#   sh deploy/linux/install-systemd-user.sh --on-calendar SPEC  at fixed times, e.g. "*-*-* 07,10,13,16,19,22:30:00"
#   sh deploy/linux/install-systemd-user.sh --print [...]       print the units it would install and exit
#   sh deploy/linux/install-systemd-user.sh --uninstall
#
# history.sampleIntervalMinutes must be set in the user config: it is both the background cadence and the spacing the
# forecast measures collection gaps against, so the timer and the forecast cannot drift apart. The urgent in-task
# cadence (monitoring.intervalMinutes) is far too frequent for a timer that runs all day.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME=fuel-watch-collect
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
HOME_DIR="${FUEL_WATCH_HOME:-$HOME/.fuel-watch}"
MODE=install
CALENDAR=

die() { echo "fuel-watch: $*" >&2; exit 1; }
note() { echo "fuel-watch: $*" >&2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --print|--uninstall) [ "$MODE" = install ] || [ "$MODE" = "$1" ] || die "--print and --uninstall exclude each other"; MODE="$1" ;;
    --on-calendar) [ $# -ge 2 ] && [ -n "$2" ] || die "--on-calendar requires a value"; CALENDAR="$2"; shift ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done

if [ "$MODE" = "--uninstall" ]; then
  systemctl --user disable --now "$NAME.timer" 2>/dev/null || true
  rm -f "$UNIT_DIR/$NAME.timer" "$UNIT_DIR/$NAME.service"
  systemctl --user daemon-reload
  note "timer removed; history in $HOME_DIR/history is kept"
  exit 0
fi

command -v node >/dev/null 2>&1 || die "node is not on PATH (Node.js 22+ is required)"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || die "Node.js 22+ is required, found $(node --version)"
# Paths go into unit files, where systemd treats % as a specifier and $, quotes and backslashes specially, and into
# a single-quoted shell word for nvm; refuse them rather than escape them. Spaces are fine: every path is quoted.
unit_path() {
  case "$1" in *%*|*\$*|*\"*|*\'*|*\\*|*"
"*) die "unsupported character (% \$ \" ' \\ or newline) in: $1" ;; esac
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

# The interval and retention come from the user config. Before the first collection it does not exist yet; the
# template inside the skill is never the place to set them (it is replaced on every sync).
CONFIG="$HOME_DIR/config/config.json"
[ -f "$CONFIG" ] || die "the user config $CONFIG does not exist yet. Create it from the template (mkdir -p \"$HOME_DIR/config\" && cp \"$ROOT/dist/config/config.json\" \"$CONFIG\") or let one collection create it, then set history.sampleIntervalMinutes in $CONFIG. Never edit the config inside the skill directory: it is replaced on every sync"
SETTINGS="$(node -e '
let c;
try { c = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); } catch { console.log("unreadable"); process.exit(0); }
const value = c.history?.sampleIntervalMinutes;
const retention = Number.isInteger(c.history?.retentionDays) ? c.history.retentionDays : 0;
console.log(value === undefined ? "unset" : Number.isInteger(value) && value >= 5 && value <= 1440 ? `${value} ${retention}` : "invalid");
' "$CONFIG")" || die "cannot read $CONFIG"
case "$SETTINGS" in
  unreadable) die "$CONFIG is not valid JSON" ;;
  unset) die "set history.sampleIntervalMinutes in $CONFIG first: the spacing between background collections (e.g. 175 for six runs a day at --on-calendar \"*-*-* 07,10,13,16,19,22:30:00\", or 60 for hourly). The forecast treats a gap longer than three of these as missing data" ;;
  invalid) die "history.sampleIntervalMinutes in $CONFIG must be an integer from 5 to 1440" ;;
esac
INTERVAL="${SETTINGS% *}"
RETENTION="${SETTINGS#* }"
if [ "$RETENTION" -lt 90 ]; then note "note: $CONFIG keeps history for $RETENTION days; set history.retentionDays to 90 there for long-range statistics"; fi

# The forecast treats a gap longer than three history.sampleIntervalMinutes as missing data, so the timer must match
# it. Wall-clock slots when the interval divides an hour or a day, otherwise a fixed period counted from the timer's
# start (not from boot, which on a long-running machine would fire a collection the moment the timer is enabled).
if [ -n "$CALENDAR" ]; then
  unit_path "$CALENDAR"
  # The schedule's usual spacing (the median between the next runs, so a night pause does not count) must stay well
  # under three sample intervals: a step only a little shorter would, with the timer's random delay and a wait for
  # another collection, often count as missing data, and no outage would ever complete. systemd prints the run times
  # in UTC on separate "(in UTC):" lines, or on the run lines themselves when the host's zone is UTC.
  if command -v systemd-analyze >/dev/null 2>&1; then
    ELAPSES="$(systemd-analyze calendar --iterations=60 "$CALENDAR" 2>&1)" || die "systemd does not understand --on-calendar \"$CALENDAR\": $ELAPSES"
    SPACING="$(printf '%s\n' "$ELAPSES" | node -e '
const times = require("node:fs").readFileSync(0, "utf8").split("\n").map(line => /(?:Next elapse|Iteration #\d+|\(in UTC\)): \S+ (\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) UTC$/.exec(line.trim())).filter(Boolean).map(([, day, time]) => Date.parse(`${day}T${time}Z`));
const gaps = times.slice(1).map((value, index) => (value - times[index]) / 60000).sort((a, b) => a - b);
console.log(gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)]) : "");
')" || die "could not compute the spacing of \"$CALENDAR\""
    if [ -n "$SPACING" ]; then
      [ $((SPACING * 2)) -le $((INTERVAL * 5)) ] || die "\"$CALENDAR\" usually runs every $SPACING min, more than 2.5 × history.sampleIntervalMinutes ($INTERVAL min): with the timer's random delay many steps would count as missing data. Set history.sampleIntervalMinutes in $CONFIG to about $SPACING"
      [ $((SPACING * 2)) -ge "$INTERVAL" ] || note "warning: \"$CALENDAR\" usually runs every $SPACING min, far more often than history.sampleIntervalMinutes ($INTERVAL min); gaps in collection will be noticed late"
      [ "$SPACING" -ge 30 ] || note "warning: \"$CALENDAR\" runs every $SPACING min and hits every source from one IP that often; benzonavt has banned the IP after about ten runs an hour"
    else note "warning: could not read the run times of \"$CALENDAR\"; make sure history.sampleIntervalMinutes ($INTERVAL min) is its usual spacing"; fi
  else note "warning: systemd-analyze is missing, so \"$CALENDAR\" is not checked against history.sampleIntervalMinutes ($INTERVAL min)"; fi
  SCHEDULE="OnCalendar=$CALENDAR"
  DESCRIPTION="at $CALENDAR"
elif [ $((60 % INTERVAL)) -eq 0 ]; then SCHEDULE="OnCalendar=*:0/$INTERVAL"; DESCRIPTION="every $INTERVAL minutes"
elif [ $((INTERVAL % 60)) -eq 0 ] && [ $((1440 % INTERVAL)) -eq 0 ]; then SCHEDULE="OnCalendar=0/$((INTERVAL / 60)):00"; DESCRIPTION="every $INTERVAL minutes"
else SCHEDULE="OnActiveSec=${INTERVAL}min
OnUnitActiveSec=${INTERVAL}min"; DESCRIPTION="every $INTERVAL minutes"; fi
[ -n "$CALENDAR" ] || note "every $INTERVAL min is about $(( (1440 + INTERVAL / 2) / INTERVAL )) full collections a day from all sources"
[ -n "$CALENDAR" ] || [ "$INTERVAL" -ge 30 ] || note "warning: background collections every $INTERVAL min hit every source from one IP that often; benzonavt has banned the IP after about ten runs an hour"

NODE_DIR="$(dirname "$(command -v node)")"
BROWSER_DIR="$(dirname "$(command -v agent-browser 2>/dev/null || echo /usr/local/bin/agent-browser)")"
unit_path "$NODE_DIR"
unit_path "$BROWSER_DIR"
# nvm has no stable path to node: a unit pinned to versions/<v>/bin breaks on the next Node upgrade. When node comes
# from nvm, the unit loads nvm.sh on every run and takes its "default" alias instead, as an interactive shell would;
# no versions/<v>/bin directory (node's, or agent-browser's after npm -g) goes into the unit's PATH.
NVM_ROOT="${NVM_DIR:-$HOME/.nvm}"
NVM_ROOT="${NVM_ROOT%/}"
EXEC="/bin/sh \"$ROOT/deploy/linux/fuel-watch-collect.sh\""
UNIT_PATH="$NODE_DIR:$BROWSER_DIR:/usr/local/bin:/usr/bin:/bin"
case "$NODE_DIR" in
  "$NVM_ROOT"/versions/*)
    if [ -s "$NVM_ROOT/nvm.sh" ] && [ -x /bin/bash ]; then
      unit_path "$NVM_ROOT"
      EXEC="/bin/bash -c \". '$NVM_ROOT/nvm.sh' >/dev/null 2>&1; exec /bin/sh '$ROOT/deploy/linux/fuel-watch-collect.sh'\""
      UNIT_PATH=/usr/local/bin:/usr/bin:/bin
      case "$BROWSER_DIR" in "$NVM_ROOT"/versions/*) ;; *) UNIT_PATH="$BROWSER_DIR:$UNIT_PATH" ;; esac
      # What the timer will run is nvm's default, not this shell's `nvm use`: check that one.
      PROBE="$(env -i HOME="$HOME" NVM_DIR="$NVM_ROOT" PATH="$UNIT_PATH" /bin/bash -c ". '$NVM_ROOT/nvm.sh' >/dev/null 2>&1; node -e 'process.stdout.write(process.versions.node.split(\".\")[0] >= 22 ? \"ok\" : process.version)' 2>/dev/null || printf none; printf ' '; command -v agent-browser >/dev/null 2>&1 && printf ok || printf none")" || true
      case "$PROBE" in
        "ok ok") note "node comes from nvm: the unit resolves nvm's default alias on every run" ;;
        "ok "*) [ "$MODE" = "--print" ] || die "agent-browser is not on PATH after loading nvm's default Node; install it for that Node or put it in /usr/local/bin" ; note "warning: agent-browser is not on PATH after loading nvm's default Node" ;;
        *) [ "$MODE" = "--print" ] || die "nvm's default Node is not 22+ (found: ${PROBE%% *}); set it with: nvm alias default 22" ; note "warning: nvm's default Node is not 22+ (found: ${PROBE%% *})" ;;
      esac
    else note "warning: node comes from nvm, but $NVM_ROOT/nvm.sh or /bin/bash is missing; the unit pins $NODE_DIR and breaks when that Node version is removed"; fi ;;
  */versions/node/*) note "warning: $NODE_DIR looks like nvm, but not under NVM_DIR ($NVM_ROOT); export NVM_DIR and rerun, or the unit pins this Node version" ;;
esac
SERVICE="[Unit]
Description=Fuel Watch: one background AI-95 availability collection
Documentation=man:systemd.timer(5)

[Service]
Type=oneshot
Environment=\"FUEL_WATCH_ROOT=$ROOT\"
Environment=\"FUEL_WATCH_HOME=$HOME_DIR\"
Environment=\"PATH=$UNIT_PATH\"
ExecStart=$EXEC
TimeoutStartSec=25min
TimeoutStopSec=60
Nice=10
"
TIMER="[Unit]
Description=Fuel Watch: collect $DESCRIPTION

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
for dropin in "$UNIT_DIR/$NAME.timer.d" "$UNIT_DIR/$NAME.service.d"; do
  [ -d "$dropin" ] && note "warning: $dropin exists and overrides what this script installs; remove it unless that is intended"
done
printf '%s' "$SERVICE" >"$UNIT_DIR/$NAME.service"
printf '%s' "$TIMER" >"$UNIT_DIR/$NAME.timer"
systemctl --user daemon-reload
systemctl --user enable --now "$NAME.timer"
if [ "$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || echo unknown)" != "yes" ]; then
  note "user lingering is off: the timer stops when you log out. Ask an administrator to run: sudo loginctl enable-linger $(id -un)"
fi
note "installed: $DESCRIPTION. Next run: systemctl --user list-timers $NAME.timer; log: journalctl --user -u $NAME.service"
