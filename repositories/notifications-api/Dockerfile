# Build context is the repositories/ folder, because the service installs the
# sibling "contracts" package. Once the services live in their own repos,
# contracts becomes a git submodule inside this one and the paths below lose
# their leading folder.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

# Contracts first: its built output is what the service installs.
COPY contracts/package.json contracts/pnpm-lock.yaml contracts/pnpm-workspace.yaml contracts/
RUN cd contracts && pnpm install --frozen-lockfile
COPY contracts contracts
RUN cd contracts && pnpm build

# Dependencies before source, so editing code does not reinstall packages.
COPY notifications-api/package.json notifications-api/pnpm-lock.yaml notifications-api/pnpm-workspace.yaml notifications-api/
RUN cd notifications-api && pnpm install --frozen-lockfile
COPY notifications-api notifications-api
RUN cd notifications-api && pnpm build && pnpm prune --prod

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/notifications-api
COPY --from=build --chown=node:node /app/notifications-api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/notifications-api/dist ./dist
COPY --from=build --chown=node:node /app/notifications-api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/notifications-api/package.json ./package.json
USER node
EXPOSE 3004
CMD ["node", "dist/main.js"]
