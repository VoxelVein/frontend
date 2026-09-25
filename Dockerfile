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

###############################################################################
# Stage 2: Build
###############################################################################
FROM node:24-alpine AS build

RUN corepack enable

WORKDIR /app

# Copy installed dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy source
COPY . .

# Build the production bundle (Nitro output in .output/)
RUN pnpm build

###############################################################################
# Stage 3: Runtime
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
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
