#!/usr/bin/env bash
set -euo pipefail

task_mode="${1:---start}"
if [[ "$#" -gt 1 || ( "$task_mode" != "--start" && "$task_mode" != "--build-only" && "$task_mode" != "--init-only" ) ]]; then
  printf '%s\n' 'Usage: setup.sh [--start|--build-only|--init-only]' >&2
  exit 2
fi

task_setup_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$task_setup_dir"
umask 077

if [[ ! -e .env ]]; then
  command -v openssl >/dev/null || { printf '%s\n' 'Install openssl before running setup.' >&2; exit 1; }
  task_config_temp="$(mktemp "$task_setup_dir/.env.tmp.XXXXXX")"
  trap 'rm -f -- "$task_config_temp"' EXIT
  task_encryption_key="$(openssl rand -hex 32)"
  printf 'SECRET_ENCRYPTION_KEY=%s\nHOMARR_PORT=7575\nTZ=Etc/UTC\n' "$task_encryption_key" > "$task_config_temp"
  unset task_encryption_key
  if ln "$task_config_temp" .env 2>/dev/null; then
    printf '%s\n' 'Created .env with a persistent encryption key. Keep this file with your data backups.'
  elif [[ ! -e .env ]]; then
    printf '%s\n' 'Could not create .env safely. Check directory permissions.' >&2
    exit 1
  fi
  rm -f -- "$task_config_temp"
  trap - EXIT
fi
chmod 0600 .env

task_existing_key="$(sed -n 's/^SECRET_ENCRYPTION_KEY=//p' .env)"
if [[ ! "$task_existing_key" =~ ^[[:xdigit:]]{64}$ ]]; then
  printf '%s\n' 'The existing .env needs a 64-character hexadecimal SECRET_ENCRYPTION_KEY. Preserve the original key when using existing Homarr data.' >&2
  exit 1
fi
unset task_existing_key

# Compose shell variables override --env-file; the data volume must always use its persisted key.
unset SECRET_ENCRYPTION_KEY

if [[ "$task_mode" == "--init-only" ]]; then
  printf '%s\n' 'Configuration ready. Existing encryption keys were preserved.'
  exit 0
fi

command -v docker >/dev/null || { printf '%s\n' 'Install Docker Engine and its Compose plugin before running setup.' >&2; exit 1; }
if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' 'Install the Docker Compose plugin before running setup.' >&2
  exit 1
fi

task_compose=(docker compose --project-name my-homarr --env-file "$task_setup_dir/.env" -f "$task_setup_dir/compose.yml")
"${task_compose[@]}" config --quiet
"${task_compose[@]}" build
if [[ "$task_mode" == "--build-only" ]]; then
  printf '%s\n' 'Homarr image built with agent downloads included.'
  exit 0
fi
"${task_compose[@]}" up --wait --wait-timeout 300
printf '%s\n' 'Homarr started. Open http://YOUR-VM-ADDRESS:7575 (or the port configured in .env).' \
  'Finish onboarding, then select Proxmox and your dashboard in Manage → Discovery.'
