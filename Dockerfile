FROM node:22-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY scripts ./scripts
RUN mkdir -p public && pnpm install --frozen-lockfile

FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "exec", "next", "dev", "-p", "3000", "-H", "::"]

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_SIGNALING_SERVER=ws://localhost:3000
ARG INTERNAL_API_URL=http://be:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SIGNALING_SERVER=$NEXT_PUBLIC_SIGNALING_SERVER
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV SKIP_BUILD_STRICT=true
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]