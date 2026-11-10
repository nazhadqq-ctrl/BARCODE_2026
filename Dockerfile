FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/

RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/barcode-app/dist ./artifacts/barcode-app/dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8000

CMD ["node", "artifacts/api-server/dist/index.mjs"]
