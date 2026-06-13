#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../infra/terraform"

# Correct destroy order:
# 1. GKE first — stops all pods and closes Cloud SQL/Redis connections
# 2. Cloud SQL + Memorystore — safe to delete now that no clients are connected
# 3. Everything else (VPC, IAM, APIs)

echo "==> Step 1: Destroying GKE cluster (closes all DB connections)..."
terraform destroy \
  -target=module.gke \
  -auto-approve

echo "==> Step 2: Destroying Cloud SQL and Memorystore..."
terraform destroy \
  -target=module.cloudsql \
  -target=module.memorystore \
  -auto-approve

echo "==> Step 3: Destroying remaining infrastructure..."
terraform destroy -auto-approve
