#!/bin/sh
# Brings the whole system up on a local kind cluster, from nothing, and can be
# run again at any time (every step checks what already exists).
#   needs: docker, kind, kubectl, helm, openssl
#   usage: up.sh
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"          # repositories/orchestration
SERVICES="$(cd "$HERE/.." && pwd)"                  # repositories/
ROOT="$(cd "$SERVICES/.." && pwd)"                  # project root: seed.json, infra/

CLUSTER=sales
NAMESPACE=sales
# Pinned, so two runs on two days install the same thing.
CALICO_VERSION=v3.31.0
TRAEFIK_CHART_VERSION=42.1.3

for tool in docker kind kubectl helm openssl; do
  command -v "$tool" >/dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done

echo "==> cluster"
if kind get clusters | grep -qx "$CLUSTER"; then
  echo "cluster $CLUSTER already exists"
else
  kind create cluster --name "$CLUSTER" --config "$HERE/kind/cluster.yaml"
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

echo "==> Calico ($CALICO_VERSION): the network plugin that enforces the policies"
kubectl apply -f "https://raw.githubusercontent.com/projectcalico/calico/$CALICO_VERSION/manifests/calico.yaml" >/dev/null
kubectl -n kube-system rollout status daemonset/calico-node --timeout=300s
kubectl -n kube-system rollout status deployment/calico-kube-controllers --timeout=300s
kubectl wait --for=condition=Ready node --all --timeout=300s

echo "==> Traefik (chart $TRAEFIK_CHART_VERSION): the ingress controller"
helm upgrade --install traefik traefik --repo https://traefik.github.io/charts \
  --version "$TRAEFIK_CHART_VERSION" --namespace traefik --create-namespace \
  --values "$HERE/charts/traefik-values.yaml" --wait --timeout 5m

echo "==> images"
"$HERE/scripts/build-images.sh" "$CLUSTER"

echo "==> namespace, secrets and files"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
"$HERE/scripts/create-secrets.sh" "$NAMESPACE"
# The seed and the database init script have one copy each in the project; the
# cluster gets them as ConfigMaps (the charts mount them).
kubectl -n "$NAMESPACE" create configmap seed --from-file=seed.json="$ROOT/seed.json" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl -n "$NAMESPACE" create configmap postgres-init --from-file=init-schemas.sh="$ROOT/infra/postgres/init-schemas.sh" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "==> charts"
for chart in "$SERVICES"/*/k8s "$HERE"/charts/postgres "$HERE"/charts/rabbitmq "$HERE"/charts/redis; do
  [ -f "$chart/Chart.yaml" ] && helm dependency update "$chart" >/dev/null
done
helm dependency update "$HERE/charts/umbrella" >/dev/null
helm upgrade --install sales "$HERE/charts/umbrella" --namespace "$NAMESPACE" --wait --timeout 10m

echo
echo "Ready: http://localhost:8080"
