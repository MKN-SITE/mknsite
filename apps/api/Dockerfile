FROM oven/bun:1.4.0-alpine AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN bun install --production --frozen-lockfile

COPY apps/api ./apps/api
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun src/index.ts"]
