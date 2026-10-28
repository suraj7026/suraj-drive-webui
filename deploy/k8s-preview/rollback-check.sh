#!/usr/bin/env bash
# Only the isolated, non-production preview is eligible for this fault-injection check.
set -Eeuo pipefail
namespace=drive-web-preview
name=drive-webui
current_path() {
  kubectl get deployment "$name" -n "$namespace" -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}'
}
test "$(current_path)" = /login
revision=$(kubectl get deployment "$name" -n "$namespace" -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')
restore() {
  if test "$(current_path)" != /login; then
    kubectl rollout undo deployment/"$name" -n "$namespace" --to-revision="$revision"
  fi
  kubectl rollout status deployment/"$name" -n "$namespace" --timeout=180s
}
trap restore EXIT
kubectl patch deployment "$name" -n "$namespace" --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/__preview_readiness_fault"}]'
if output=$(kubectl rollout status deployment/"$name" -n "$namespace" --timeout=35s 2>&1); then
  echo 'FAIL: the deliberately unhealthy revision became available' >&2
  exit 1
fi
printf '%s\n' "$output"
grep -q 'timed out waiting for the condition' <<< "$output"
test "$(kubectl get deployment "$name" -n "$namespace" -o jsonpath='{.status.updatedReplicas}')" = 1
test "$(kubectl get deployment "$name" -n "$namespace" -o jsonpath='{.status.availableReplicas}')" = 1
origin="http://$(kubectl get service drive-gateway -n "$namespace" -o jsonpath='{.spec.clusterIP}')"
curl --fail --silent --show-error --max-time 10 "$origin/login" >/dev/null
printf 'PASS failed readiness blocked replacement; previous replica continued serving\n'
restore
trap - EXIT
test "$(current_path)" = /login
printf 'PASS live rollout undo restored the previous healthy template\n'
