# Build context is repositories/web.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

# Dependencies before source, so editing code does not reinstall packages.
# Install scripts are skipped: the build prepares Nuxt itself.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

# The Nitro output is self-contained: no node_modules needed to run it.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
