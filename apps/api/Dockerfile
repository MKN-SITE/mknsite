FROM oven/bun:1.4.0-alpine AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN bun install --production --frozen-lockfile

COPY apps/api ./apps/api
COPY form-templates ./form-templates
RUN test -f '/app/form-templates/hr/oncall/From Oncall.pdf' && \
    test -f '/app/form-templates/hr/overtime/From Overtime.pdf' && \
    test -f '/app/form-templates/hr/cuti/From Cuti.pdf'
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "bun run db:migrate && bun src/db/seed.ts && bun src/index.ts"]
