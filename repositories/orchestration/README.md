# orchestration

Runs the whole system on Kubernetes: a Helm umbrella chart (one chart per service, a shared library chart, hand-written charts for PostgreSQL, RabbitMQ and Redis), a local kind cluster with Calico, an ingress, network policies, and scripts to bring it up and check it.

The project root's `docker-compose.yml` is the simpler way to run the system and still works (see the root README). This is the second way, for a cluster.

## Quick start

Needs `docker`, `kind`, `kubectl`, `helm` and `openssl`, and internet access (node image, Calico, Traefik and the base images are pulled).

```bash
./scripts/up.sh        # cluster, Calico, ingress, images, secrets, charts (5 to 10 minutes the first time)
./scripts/verify.sh    # the system answers, an order goes through, the network rules block what they should
# open http://localhost:8080
./scripts/down.sh      # deletes the cluster and everything in it
```

`up.sh` can be run again at any time; every step checks what already exists. The compose stack publishes the same port 8080, so stop one before starting the other.

## What `up.sh` does

1. **kind cluster** (`kind/cluster.yaml`): one node, default network plugin turned off, host port 8080 mapped to the node's port 80.
2. **Calico** (version pinned in the script): kind's own network plugin does not apply NetworkPolicies, Calico does.
3. **Traefik** (chart version pinned; `charts/traefik-values.yaml`): the ingress controller. `ingress-nginx` was retired in March 2026 (no more fixes, not even security ones), so it is not used.
4. **Images**: builds the five service images from this repository and loads them straight into the cluster (`scripts/build-images.sh`), so the cluster needs no registry. Tag `local`.
5. **Namespace `sales`, Secret and ConfigMaps**: `scripts/create-secrets.sh` fills the Secret `sales-secrets` with random values, only if it does not exist yet (the database keeps the passwords it was created with). The seed file and the database init script each have one copy in the project and reach the cluster as ConfigMaps (`seed`, `postgres-init`).
6. **`helm upgrade --install sales charts/umbrella`**, waiting until everything is ready.

## The charts

```
charts/sales-lib      library chart: the Deployment, Service and NetworkPolicy templates every service uses
charts/postgres       StatefulSet + 1Gi volume; creates one schema and one role per service on its first start
charts/rabbitmq       StatefulSet + 1Gi volume (quorum queues need to survive a restart)
charts/redis          Deployment, no persistence (browser sessions only)
charts/umbrella       installs all of them; adds the Ingress and the namespace's default-deny policy
../<service>/k8s      one chart per service (web, catalog-api, identity-api, orders-api, notifications-api):
                      a values.yaml and three one-line templates that call the library
```

Everything is named after its chart (`catalog-api`, `postgres`...), not after the release, so the names the services use for each other are the same as in compose. A service's `values.yaml` lists its ports, its environment, which Secret keys it reads, and its network rules. The umbrella's `values.yaml` can override any of it under the chart's name (for example `orders-api.env.MIN_ORDER_CENTS`).

Settings every chart shares live under `global`: `imageTag`, `imageRegistry` (empty means images already on the node; set it, for example to `ghcr.io/kainanguerra`, and `imageTag` to `latest` (or a commit sha), to pull the published images instead) and `secretName`.

## Security settings

- Every pod runs as a non-root user with `seccompProfile: RuntimeDefault`; containers drop all capabilities and cannot gain privileges. Root filesystems are read-only (a `/tmp` volume holds temporary files), **except RabbitMQ's**: its start script writes its configuration under `/etc/rabbitmq`.
- No password or secret is in the repository. They are generated into a Kubernetes Secret when the cluster is first set up. The BFF's inner-auth secret reaches the `web` pod as a Secret, never as a public setting; `verify.sh` greps the files the browser downloads for it.
- Only the `web` pod can be reached from outside (through the ingress). The services have no ingress and no published port.

## Network policies

The namespace denies everything in both directions (`charts/umbrella/templates/default-deny.yaml`); each chart adds only what it needs (DNS is always allowed out):

| From | To | Port |
|---|---|---|
| ingress controller (`traefik` namespace) | web | 3000 |
| web | identity-api, catalog-api, orders-api, notifications-api | 3001, 3002, 3003, 3004 |
| web | redis | 6379 |
| orders-api | catalog-api, identity-api (gRPC) | 50052, 50051 |
| identity-api, catalog-api, orders-api, notifications-api | postgres | 5432 |
| identity-api, catalog-api, orders-api, notifications-api | rabbitmq | 5672 |

`scripts/verify.sh` proves it: it opens real connections from inside the pods and checks that the allowed ones work and the others time out. Deleting the policies makes every "denied" check fail, which is how we know the checks can fail.

The init containers that wait for dependencies run inside the pod, under the pod's policy, so they wait on the ports the pod is allowed to use (for example `orders-api` waits for catalog on its gRPC port, not its HTTP port).

## Troubleshooting

- **The node never becomes ready** (kubelet logs "unknown service runtime.v1.RuntimeService"; containerd logs "too many open files"): the host's inotify limit is too low, which a second kind cluster makes likelier. Raise it: `sudo sysctl fs.inotify.max_user_instances=512 fs.inotify.max_user_watches=524288` (add a file under `/etc/sysctl.d/` to keep it after a reboot).
- **Port 8080 is taken**: stop the compose stack (`docker compose stop`) or change `hostPort` in `kind/cluster.yaml`.
- **A pod is stuck in `Init`**: it is waiting for a dependency (`kubectl -n sales logs <pod> -c wait-for-dependencies`).
- **`up.sh` fails downloading something**: it needs the network for the node image, Calico's manifest, the Traefik chart and the base images.

## Not done here

- The images are built on the machine and loaded into kind. Publishing them to a registry (GHCR) and splitting the services into their own repositories, with this one as a submodule, is a separate step.
- One replica of everything. `notifications-api` keeps its list of open streams in the process (see `DECISIONS.md` D50), so it must not be scaled before that is changed.
- No TLS, no autoscaling, no resource tuning (the requests and limits are modest guesses, not measurements), no backups of the database volume.
- The charts are not linted in CI.
