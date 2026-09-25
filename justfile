# VoxelVein Frontend — command runner
#
# Thin wrapper around the package.json scripts so common tasks can be run
# with `just <recipe>` instead of `pnpm <script>`.
#
# Usage:
#   just            # list recipes
#   just dev        # start the complete development environment (app + API)
#   just check      # lint + format check (read-only)

set shell := ["bash", "-c"]

default:
    @just --list

# Start the complete development environment (web app + API server)
dev:
    pnpm dev

# Start only the Vite web app (port 3000)
dev:web:
    pnpm dev:web

# Start only the ElysiaJS API server (watch mode, port 3002)
dev:api:
    pnpm dev:api

# Build the production bundle
build:
    pnpm build

# Preview the production build
preview:
    pnpm preview

# Start the built Nitro server
start:
    pnpm start

# Run the Vitest test suite
test:
    pnpm test

# Run the TypeScript type checker
typecheck:
    pnpm typecheck

# Run the Oxlint linter
lint:
    pnpm lint

# Run markdownlint on Markdown files
lint:md:
    pnpm lint:md

# Run the Oxfmt formatter
format:
    pnpm format

# Run the Ultracite checker (lint + format check, read-only)
check:
    pnpm check

# Apply Ultracite checks and fixes
fix:
    pnpm fix

# Run the development environment with Docker
docker-dev:
    docker compose -f compose.yaml -f compose.dev.yaml up

# Build and run the production environment with Docker
docker-prod:
    docker compose -f compose.yaml -f compose.prod.yaml up -d --build