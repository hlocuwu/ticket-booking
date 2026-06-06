#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="ticket-booking"
ARGOCD_VERSION="v2.13.3"
ARGOCD_NS="argocd"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── helpers ────────────────────────────────────────────────────────────────────
info()  { echo "[INFO]  $*"; }
ok()    { echo "[OK]    $*"; }
err()   { echo "[ERROR] $*" >&2; exit 1; }

wait_for_deploy() {
  local ns=$1 deploy=$2
  info "Waiting for deployment $deploy in $ns ..."
  kubectl rollout status deployment/"$deploy" -n "$ns" --timeout=180s
}

# ── 1. kind cluster ────────────────────────────────────────────────────────────
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  info "kind cluster '${CLUSTER_NAME}' already exists, skipping creation"
else
  info "Creating kind cluster '${CLUSTER_NAME}' ..."
  kind create cluster \
    --name "$CLUSTER_NAME" \
    --config "$REPO_ROOT/manifest/kind-config.yaml"
  ok "Cluster created"
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}"

# ── 2. ArgoCD ──────────────────────────────────────────────────────────────────
if kubectl get ns "$ARGOCD_NS" &>/dev/null; then
  info "ArgoCD namespace already exists, skipping install"
else
  info "Installing ArgoCD ${ARGOCD_VERSION} ..."
  kubectl create namespace "$ARGOCD_NS"
  kubectl apply -n "$ARGOCD_NS" \
    -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"
  wait_for_deploy "$ARGOCD_NS" argocd-server
  ok "ArgoCD installed"
fi

# ── 3. App of Apps ─────────────────────────────────────────────────────────────
info "Applying ArgoCD root-app (App of Apps) ..."
kubectl apply -f "$REPO_ROOT/manifest/argocd/root-app.yaml"
ok "root-app applied — ArgoCD will start syncing child apps"

# ── 4. Print access info ───────────────────────────────────────────────────────
ARGOCD_PASS=$(kubectl -n "$ARGOCD_NS" get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ArgoCD UI  : kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "               then open https://localhost:8080"
echo "  Username   : admin"
echo "  Password   : ${ARGOCD_PASS}"
echo ""
echo "  Add to /etc/hosts:"
echo "    127.0.0.1  ticket.local grafana.ticket.local opensearch.ticket.local"
echo "════════════════════════════════════════════════════════════"
echo ""
info "Run 'kubectl get applications -n argocd' to watch sync status"
