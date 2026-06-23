#!/usr/bin/env bash
#
# Bygger om backend- och frontend-imagerna och (om)startar Quadlet-tjänsterna.
# Idempotent: kan köras både vid första deployen och vid varje ny version.
#
# Förutsätter att engångsstegen är gjorda (se deploy/quadlet/README.md):
#   - /etc/kalle/backend.env och /etc/kalle/frontend.env är ifyllda
#   - loginctl enable-linger $USER
#
# Rootless podman + systemd --user. Kör som din vanliga användare, INTE sudo.
#
# Användning:
#   deploy/redeploy.sh              # bygg + deploya backend och frontend
#   deploy/redeploy.sh backend      # bara backend
#   deploy/redeploy.sh frontend     # bara frontend

set -euo pipefail

# Repo-roten = en nivå upp från den här filen, oavsett varifrån skriptet körs.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUADLET_SRC="$REPO_ROOT/deploy/quadlet"
QUADLET_DST="$HOME/.config/containers/systemd"

# Vilka delar ska byggas/startas?
TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(backend frontend)
fi

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# 1. Synka Quadlet-unit-filerna (fångar ändringar i .container/.network).
log "Synkar Quadlet-units till $QUADLET_DST"
mkdir -p "$QUADLET_DST"
cp "$QUADLET_SRC/kalle.network" \
   "$QUADLET_SRC/kalle-backend.container" \
   "$QUADLET_SRC/kalle-frontend.container" \
   "$QUADLET_DST/"
systemctl --user daemon-reload

# 2. Bygg imagerna.
for t in "${TARGETS[@]}"; do
  case "$t" in
    backend)
      log "Bygger kalle-backend"
      podman build -t kalle-backend -f "$REPO_ROOT/backend/Containerfile" "$REPO_ROOT/backend"
      ;;
    frontend)
      log "Bygger kalle-frontend"
      podman build -t kalle-frontend -f "$REPO_ROOT/frontend/Containerfile" "$REPO_ROOT/frontend"
      ;;
    *)
      echo "Okänt mål: $t (välj backend och/eller frontend)" >&2
      exit 1
      ;;
  esac
done

# 3. (Om)starta tjänsterna så de plockar upp de nya imagerna.
#    restart fungerar även om tjänsten inte körde än (startar den då).
for t in "${TARGETS[@]}"; do
  log "Startar om kalle-$t"
  systemctl --user restart "kalle-$t.service"
done

# 4. Visa status.
log "Status"
systemctl --user --no-pager status "kalle-backend.service" "kalle-frontend.service" \
  | grep -E 'kalle-(backend|frontend)\.service|Active:' || true

log "Klart. Loggar: journalctl --user -u kalle-backend -f"
