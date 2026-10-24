# 09 - Docker, Kubernetes, CI

## Dockerfile
- Multi-stage. Copy the `.csproj` / `package.json` first and restore, so the dependency layer caches; then `COPY . .`.
- .NET: `sdk:10.0` to `aspnet:10.0`, `USER app`, `ASPNETCORE_URLS=http://+:8080`, git installed to bake `build-info.json`. The build context is the repo root.
- Node: `node:24` builder, `npm prune --omit=dev`, final image distroless non-root, `NODE_OPTIONS=--max-old-space-size=1024`.
- Frontend: `node:22-alpine` then unprivileged `nginx:1.27-alpine`, CSP header in `nginx.conf`.
- Always run as non-root. A comment at the top explains the *why*.

## docker-compose (per service, standalone)
Postgres 16-alpine and RabbitMQ 3.13-management, both with healthchecks. The service uses `depends_on: condition: service_healthy`. `postgres-init/init-schema.sh` creates the schema, role and grants. `.env.example` is committed. A root compose file for the whole stack uses YAML anchors (`x-service`, `x-common-env`).

## Kubernetes
- Always a **Deployment**, never a bare Pod.
- Config lives in a ConfigMap or Secret and reaches the container through `configMapKeyRef` / `secretKeyRef`. Nothing is hardcoded.
- Each repo owns its manifests as a Helm subchart in `/k8s` (`Chart.yaml`, `values.yaml`, `templates/{deployment,service,configmap}.yaml`).
- Every DB-backed service has a `wait-for-postgres` init container.
- Security context: `runAsNonRoot`, fixed `runAsUser`, `allowPrivilegeEscalation: false`, drop all capabilities, `automountServiceAccountToken: false`. Resource requests and limits. Probes on `/health`.
- An umbrella chart depends on each subchart (`file://../<svc>/k8s`) and holds the namespace, Postgres, RabbitMQ, Secrets and a single Ingress with path-prefix routing.
- NetworkPolicy: deny all ingress, then add explicit allows. Local kind cluster with the default CNI off and Calico on, so policies are actually enforced. RBAC only where a service needs it, restricted by `resourceNames`.
- After a frontend change: build, lint, rebuild the image, `kind load docker-image`, `kubectl rollout restart`.

## CI
GitHub Actions `ci.yml`, identical in every service, on push and PR to `main`:
1. `build-and-test`: restore, build, test (frontend: `npm ci`, lint, build).
2. `docker-build-and-push` (needs 1; push to `main` only): registry login, tags `type=sha,format=long` and `latest`, build cache.

The shape to keep on any CI provider: one build-and-test step on every PR, an image push tagged with the commit SHA on the main branch, and only the app name and port differing between services. Every service has CI.
