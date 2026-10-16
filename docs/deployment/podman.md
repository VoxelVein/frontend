# Podman Deployment

The same multi-stage `Dockerfile` and Compose files used for Docker work
unchanged with Podman. Podman has no daemon, so there is nothing to
start before running the stack.

## Build an image

```bash
podman build --target runtime -t voxelvein-frontend .
podman build --target api -t voxelvein-api .
podman build --target migrate -t voxelvein-migrate .
```

Pass the same `VITE_*` build arguments as in [Docker](docker.md#build-the-images).

## Run the stack

Podman understands the same Compose schema, either through
`podman-compose` or the newer `podman compose` wrapper:

```bash
podman-compose -f compose.yaml -f compose.prod.yaml up -d --build
```

Rootless Podman cannot bind to ports below 1024 and cannot map host ports
onto them directly from rootless containers; the published ports in
`compose.host-ports.yaml` default to 1112/1113 to stay above that limit.

## Self-contained local stack

For a local stack with Postgres and Garage storage, add
`compose.dev.yaml` instead of `compose.prod.yaml`. Garage and the
migration runner are started by the same recipe, exactly as with Docker.
