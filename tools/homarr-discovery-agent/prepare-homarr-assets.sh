#!/usr/bin/env bash
set -euo pipefail

task_agent_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
task_repo_root="$(cd -- "$task_agent_dir/../.." && pwd)"
task_asset_dir="$task_repo_root/apps/nextjs/public/discovery-agent"

(cd "$task_agent_dir" && bash build-release.sh)
mkdir -p "$task_asset_dir"
install -m 0644 "$task_agent_dir/install-agent.sh" "$task_asset_dir/install-agent.sh"
install -m 0644 "$task_agent_dir/dist/homarr-discovery-agent-linux-amd64" "$task_asset_dir/"
install -m 0644 "$task_agent_dir/dist/homarr-discovery-agent-linux-arm64" "$task_asset_dir/"
(cd "$task_asset_dir" && sha256sum install-agent.sh homarr-discovery-agent-linux-* > SHA256SUMS)
printf '%s\n' 'Agent downloads prepared for local Homarr development.'
