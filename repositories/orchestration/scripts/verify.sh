#!/bin/sh
# Checks the running cluster: the system answers through the ingress, an order
# goes through, the inner-auth secret is not in what the browser downloads, and
# the network policies really block what they should.
#   usage: verify.sh
set -u

NAMESPACE=sales
BASE=http://localhost:8080
JAR="$(mktemp)"
failed=0

ok()   { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failed=1; }
check() { # description, expected, actual
  if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 (expected $2, got $3)"; fi
}

echo "-- pods"
kubectl -n "$NAMESPACE" wait --for=condition=Ready pod --all --timeout=120s >/dev/null && ok "every pod is ready" || fail "pods not ready"

echo "-- through the ingress"
check "health answers 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health")"
check "login as a seller" Carlos "$(curl -s -c "$JAR" -H 'content-type: application/json' -d '{"role":"SELLER","id":"V01"}' "$BASE/api/auth/login" | sed -n 's/.*"name":"\([^ "]*\).*/\1/p')"
CLIENT=C003
ORDER_ID="$(cat /proc/sys/kernel/random/uuid)"
STATUS="$(curl -s -b "$JAR" -H 'content-type: application/json' \
  -d "{\"orderId\":\"$ORDER_ID\",\"clientId\":\"$CLIENT\",\"orderDiscountBp\":0,\"items\":[{\"productId\":\"P008\",\"quantity\":70,\"unit\":\"UNIT\",\"discountBp\":0}]}" \
  "$BASE/api/orders" | sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p' | head -1)"
check "an order is accepted (catalog, identity, orders and RabbitMQ all took part)" SUBMITTED "$STATUS"
check "sending the same order id again returns the same order" "$ORDER_ID" "$(curl -s -b "$JAR" -H 'content-type: application/json' \
  -d "{\"orderId\":\"$ORDER_ID\",\"clientId\":\"$CLIENT\",\"orderDiscountBp\":0,\"items\":[{\"productId\":\"P008\",\"quantity\":70,\"unit\":\"UNIT\",\"discountBp\":0}]}" \
  "$BASE/api/orders" | sed -n 's/.*"id":"\([0-9a-f-]*\)".*/\1/p' | head -1)"
check "the server-sent events stream opens" "event: changed" "$(curl -s -N -b "$JAR" --max-time 4 "$BASE/api/notifications/stream" | grep -m1 '^event:' )"

echo "-- the secret"
SECRET="$(kubectl -n "$NAMESPACE" get secret sales-secrets -o jsonpath='{.data.inner-auth}' | base64 -d)"
LEAKS="$(kubectl -n "$NAMESPACE" exec deploy/web -- sh -c "grep -rlF '$SECRET' .output/public 2>/dev/null | wc -l" | tr -d ' ')"
check "the inner-auth secret is not in the files the browser downloads" 0 "$LEAKS"

echo "-- network policies (a connection that is not allowed must time out)"
reach() { # from-deployment, host, port -> "open" or "blocked"
  kubectl -n "$NAMESPACE" exec "deploy/$1" -- node -e "
    const s = require('net').connect({host:'$2', port:$3, timeout:3000});
    s.on('connect', () => { console.log('open'); process.exit(0); });
    s.on('timeout', () => { console.log('blocked'); process.exit(0); });
    s.on('error', () => { console.log('blocked'); process.exit(0); });
  " 2>/dev/null | tail -1
}
check "orders-api -> postgres        (allowed)" open    "$(reach orders-api postgres 5432)"
check "orders-api -> catalog gRPC    (allowed)" open    "$(reach orders-api catalog-api 50052)"
check "web -> orders-api             (allowed)" open    "$(reach web orders-api 3003)"
check "web -> redis                  (allowed)" open    "$(reach web redis 6379)"
check "web -> postgres               (denied)"  blocked "$(reach web postgres 5432)"
check "web -> rabbitmq               (denied)"  blocked "$(reach web rabbitmq 5672)"
check "catalog-api -> identity-api   (denied)"  blocked "$(reach catalog-api identity-api 3001)"
check "catalog-api -> orders-api     (denied)"  blocked "$(reach catalog-api orders-api 3003)"
check "notifications-api -> catalog  (denied)"  blocked "$(reach notifications-api catalog-api 3002)"
check "orders-api -> catalog HTTP    (denied: only gRPC is allowed)" blocked "$(reach orders-api catalog-api 3002)"
OUTSIDE="$(kubectl -n "$NAMESPACE" run netpol-probe --rm -i --restart=Never --image=busybox:1.37 --labels=app.kubernetes.io/name=probe --quiet \
  --command -- sh -c 'nc -z -w 3 web 3000 && echo open || echo blocked' 2>/dev/null | tail -1)"
check "an unknown pod -> web         (denied)"  blocked "$OUTSIDE"

rm -f "$JAR"
echo
if [ "$failed" -eq 0 ]; then echo "everything checked passed"; else echo "SOMETHING FAILED" >&2; exit 1; fi
