# 深渊行者 API 镜像（测试服 / 云端跑测共用）。
# 构建上下文 = open-world/：docker build -f deploy/Dockerfile -t abyss-api .
# 只打包服务端运行所需的代码与配置；Web 客户端构建产物（apps/web/dist，含美术素材）
# 不进镜像，由部署时挂载到 /srv/web-dist（见 deploy/README.md）。
FROM node:24-bookworm-slim AS dependencies

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=1

WORKDIR /app
RUN corepack enable

# 先拷依赖清单，依赖层可缓存。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/asset-manifest/package.json packages/asset-manifest/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/rules/package.json packages/rules/package.json
COPY packages/simulation/package.json packages/simulation/package.json
RUN pnpm install --prod --frozen-lockfile
# tsx is the sole development tool needed in production. Keep it in a separate
# prefix, without changing the workspace manifest or installing other dev tools.
RUN npm install --prefix /tsx --omit=dev --no-audit --no-fund tsx@4.21.0

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /tsx /tsx
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json

COPY tsconfig.json ./
COPY config ./config
COPY packages ./packages
COPY apps/api ./apps/api

ENV NODE_ENV=production \
    AW_HOST=0.0.0.0 \
    AW_API_PORT=8611 \
    AW_STATIC_ROOT=/srv/web-dist

USER node
EXPOSE 8611
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:8611/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "/tsx/node_modules/tsx/dist/loader.mjs", "apps/api/src/main.ts"]
