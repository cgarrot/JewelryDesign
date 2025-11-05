# Stage 1: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files first (for better cache)
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies (will use cache if package files unchanged)
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --no-frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  else \
    npm install; \
  fi

# Copy application code (node_modules already installed, won't be overwritten)
COPY . .

# Generate Prisma Client (DATABASE_URL required for prisma.config.ts but not used for generate)
# Use build arg if provided, otherwise use dummy value
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-"postgresql://dummy:dummy@localhost:5432/dummy"}
RUN npx prisma generate

# Set production environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  else \
    npm run build; \
  fi

# Collect Prisma files to a known location for copying to runner stage
RUN mkdir -p /app/.prisma-collect && \
  if [ -d /app/node_modules/.prisma ]; then \
    cp -r /app/node_modules/.prisma /app/.prisma-collect/; \
  fi && \
  if [ -d /app/node_modules/@prisma ]; then \
    cp -r /app/node_modules/@prisma /app/.prisma-collect/; \
  fi && \
  find /app/node_modules -type d -name ".prisma" ! -path "*/node_modules/.prisma" -maxdepth 5 -exec sh -c 'mkdir -p /app/.prisma-collect/.prisma && cp -r {}/* /app/.prisma-collect/.prisma/ 2>/dev/null || true' \; && \
  find /app/node_modules -type d -path "*/@prisma" ! -path "*/node_modules/@prisma" -maxdepth 5 -exec sh -c 'mkdir -p /app/.prisma-collect/@prisma && cp -r {}/* /app/.prisma-collect/@prisma/ 2>/dev/null || true' \;

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install wget for health checks
RUN apk add --no-cache wget

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Copy Prisma client files from collected location
RUN mkdir -p ./node_modules
COPY --from=builder /app/.prisma-collect ./prisma-collect-temp
RUN if [ -d ./prisma-collect-temp/.prisma ]; then \
      cp -r ./prisma-collect-temp/.prisma ./node_modules/; \
    fi && \
    if [ -d ./prisma-collect-temp/@prisma ]; then \
      cp -r ./prisma-collect-temp/@prisma ./node_modules/; \
    fi && \
    rm -rf ./prisma-collect-temp

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

