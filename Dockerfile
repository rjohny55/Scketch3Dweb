# syntax=docker/dockerfile:1
FROM node:26.12.1-alpine3.24 AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 SCKETCH3DWEB_DOCKER_BUILD=true SCKETCH3DWEB_MCP_BUILD=true
ENV NEXT_PUBLIC_SOURCE_CODE_URL=/api/source
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencies AS builder
COPY . .
RUN tar --exclude='./node_modules' --exclude='./scripts/mcp-http/node_modules' \
    --exclude='./apps/web/.next*' --exclude='./apps/web/public/occt' \
    -czf /tmp/scketch3dweb-source.tar.gz .
RUN node --check scripts/scketch3dweb-mcp-server.mjs && node --check scripts/mcp-http/server.mjs && npm run build

FROM node:26.12.1-alpine3.24 AS mcp-deps
WORKDIR /mcp
COPY scripts/mcp-http/package.json scripts/mcp-http/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:26.12.1-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 \
    SCKETCH3DWEB_MCP_ENABLED=true SCKETCH3DWEB_MCP_HOST=0.0.0.0 SCKETCH3DWEB_MCP_PORT=3001 \
    SCKETCH3DWEB_URL=http://127.0.0.1:3000 SCKETCH3DWEB_SHARED_PROJECTS_DIR=/data/projects \
    SCKETCH3DWEB_MODELS_DIR=/data/models SCKETCH3DWEB_SOURCE_ARCHIVE=/app/source.tar.gz
RUN mkdir -p /data/models /data/projects && chown -R node:node /data
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=node:node /tmp/scketch3dweb-source.tar.gz ./source.tar.gz
COPY --chown=node:node scripts/scketch3dweb-mcp-server.mjs scripts/start-container.mjs ./scripts/
COPY --chown=node:node scripts/mcp-http/server.mjs scripts/mcp-http/package.json ./scripts/mcp-http/
COPY --from=mcp-deps --chown=node:node /mcp/node_modules ./scripts/mcp-http/node_modules
USER node
EXPOSE 3000 3001
VOLUME ["/data/projects", "/data/models"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e 'Promise.all([fetch("http://127.0.0.1:3000/api/health").then(r=>{if(!r.ok)throw Error(r.status)}),fetch("http://127.0.0.1:3001/health").then(r=>{if(!r.ok)throw Error(r.status)})]).catch(()=>process.exit(1))'
CMD ["node", "scripts/start-container.mjs"]
