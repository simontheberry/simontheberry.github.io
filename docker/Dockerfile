# ============================================================================
# Multi-stage Dockerfile for Complaint Triage Platform
# ============================================================================

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts
# Prisma generate needs the schema available at install time
RUN npx prisma generate

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js client
RUN npm run build:client

# Build server (TypeScript -> dist/)
RUN npm run build:server

# Prune dev dependencies for smaller production image
RUN npm prune --production

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy production node_modules (pruned)
COPY --from=build /app/node_modules ./node_modules

# Copy built assets
COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.js ./

# Copy entrypoint script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER appuser

EXPOSE 3000 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/server/index.js"]
