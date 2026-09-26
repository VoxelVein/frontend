# syntax=docker/dockerfile:1

###############################################################################
# Stage 1: Dependencies
###############################################################################
FROM node:24-alpine AS deps

# pnpm is managed via corepack (version pinned by packageManager field)
RUN corepack enable

WORKDIR /app

# Copy manifests first to leverage Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install dependencies (frozen lockfile for reproducible builds)
RUN pnpm install --frozen-lockfile

# Stage order matters: the migrate and api targets come before the web build
# so building them (even with the legacy builder, which runs every earlier
# stage) never needs VITE_API_URL. The web runtime stays last so a plain
# `docker build .` still produces the web image.

###############################################################################
# Stage 2: Migrations (one-shot)
###############################################################################
# Applies pending Drizzle migrations and exits. Compose runs it before the web
# and API services start. drizzle.config.ts loads env.config.ts, so this needs
# DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL.
FROM node:24-alpine AS migrate

ENV NODE_ENV=production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts env.config.ts ./
COPY drizzle ./drizzle
COPY src/db ./src/db

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

CMD ["node_modules/.bin/drizzle-kit", "migrate"]

###############################################################################
# Stage 3: API server
###############################################################################
# Runs the Elysia API (server/index.ts). It is TypeScript run through tsx, a
# dev dependency, so this stage keeps the full dependency tree from deps.
FROM node:24-alpine AS api

ENV NODE_ENV=production
ENV API_PORT=3002

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY server ./server
# The API imports shared modules (project constants, client-key parsing) from
# the web app's src/lib; copy the whole directory so new shared imports work.
COPY src/lib ./src/lib

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${API_PORT}/api/health || exit 1

CMD ["node", "--import", "tsx", "server/index.ts"]

###############################################################################
# Stage 4: Web build
###############################################################################
FROM node:24-alpine AS build

RUN corepack enable

WORKDIR /app

# Copy installed dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy source
COPY . .

# VITE_* variables are inlined into the client bundle at build time, so the
# public API origin has to be known here, not when the container starts.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the production bundle (Nitro output in .output/). Refuse to build
# without VITE_API_URL: the bundle would otherwise ship without live updates.
RUN test -n "$VITE_API_URL" \
    || (echo "VITE_API_URL build arg is required (public URL of the API server)" >&2 && exit 1) \
    && pnpm build

###############################################################################
# Stage 5: Web runtime (default target, keep last)
###############################################################################
FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Copy only the Nitro build output needed to run the server
COPY --from=build /app/.output ./.output

# Run as a non-root user for security
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs \
    && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

CMD ["node", ".output/server/index.mjs"]
