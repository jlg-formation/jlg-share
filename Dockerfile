FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN bun run build

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && mkdir /data && chown bun:bun /data
COPY --from=build /app/dist ./dist
COPY src/server ./src/server
COPY src/shared ./src/shared
USER bun
ENV NODE_ENV=production HOST=127.0.0.1 PORT=3000 DATA_DIR=/data COOKIE_SECURE=true
EXPOSE 3000
CMD ["bun", "src/server/index.ts"]
