#!/usr/bin/env bash
set -euo pipefail

# Bootstrap ArgoCD on a freshly provisioned GKE cluster
# Run AFTER terraform apply completes

ARGOCD_VERSION="v2.13.3"
ARGOCD_NS="argocd"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info()  { echo "[INFO]  $*"; }
ok()    { echo "[OK]    $*"; }
err()   { echo "[ERROR] $*" >&2; exit 1; }

# ── Required args ──────────────────────────────────────────────────────────────
PROJECT_ID="${1:-}"
CLUSTER_NAME="${2:-}"
REGION="${3:-asia-southeast1-a}"

if [[ -z "$PROJECT_ID" || -z "$CLUSTER_NAME" ]]; then
  echo "Usage: $0 <project-id> <cluster-name> [zone]"
  echo "Example: $0 my-gcp-project ticket-booking-gke asia-southeast1-a"
  exit 1
fi

# ── 1. Configure kubectl ───────────────────────────────────────────────────────
info "Fetching GKE credentials..."
gcloud container clusters get-credentials "$CLUSTER_NAME" \
  --zone "$REGION" \
  --project "$PROJECT_ID"
ok "kubectl context set to GKE cluster"

# ── 2. Install ArgoCD ─────────────────────────────────────────────────────────
if kubectl get ns "$ARGOCD_NS" &>/dev/null; then
  info "ArgoCD namespace already exists, skipping install"
else
  info "Installing ArgoCD ${ARGOCD_VERSION}..."
  kubectl create namespace "$ARGOCD_NS"
  kubectl apply -n "$ARGOCD_NS" \
    -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

  info "Waiting for ArgoCD server..."
  kubectl rollout status deployment/argocd-server -n "$ARGOCD_NS" --timeout=300s
  ok "ArgoCD installed"
fi

# ── 3. ArgoCD insecure mode (let ingress-nginx handle TLS) ────────────────────
info "Configuring ArgoCD server for ingress TLS termination..."
kubectl patch deployment argocd-server -n "$ARGOCD_NS" \
  --type json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--insecure"}]' \
  2>/dev/null || true
kubectl rollout status deployment/argocd-server -n "$ARGOCD_NS" --timeout=120s
ok "ArgoCD insecure mode enabled"

# ── 4. Bootstrap App of Apps ──────────────────────────────────────────────────
info "Applying ArgoCD root-app (App of Apps)..."
kubectl apply -f "$REPO_ROOT/manifest/argocd/root-app.yaml"
ok "root-app applied"

# ── 5. Apply ArgoCD ingress ───────────────────────────────────────────────────
info "Applying ArgoCD ingress..."
kubectl apply -f "$REPO_ROOT/manifest/argocd/argocd-ingress.yaml"
ok "ArgoCD ingress applied — https://argocd.flashticket.site"

# ── 6. Print access info ──────────────────────────────────────────────────────
ARGOCD_PASS=$(kubectl -n "$ARGOCD_NS" get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ArgoCD    : https://argocd.flashticket.site"
echo "  Grafana   : https://grafana.flashticket.site"
echo "  OpenSearch: https://opensearch.flashticket.site"
echo "  Production: https://flashticket.site"
echo "  Staging   : https://staging.flashticket.site"
echo ""
echo "  ArgoCD credentials:"
echo "  Username  : admin"
echo "  Password  : ${ARGOCD_PASS}"
echo ""
echo "  Note: DNS must point *.flashticket.site to ingress-nginx external IP"
echo "  Run: kubectl get svc -n ingress-nginx ingress-nginx-controller"
echo "════════════════════════════════════════════════════════════"
echo ""
info "Run 'kubectl get applications -n argocd' to watch sync status"
