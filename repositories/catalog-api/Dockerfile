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
COPY catalog-api/package.json catalog-api/pnpm-lock.yaml catalog-api/pnpm-workspace.yaml catalog-api/
RUN cd catalog-api && pnpm install --frozen-lockfile
COPY catalog-api catalog-api
RUN cd catalog-api && pnpm build && pnpm prune --prod

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/catalog-api
COPY --from=build --chown=node:node /app/catalog-api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/catalog-api/dist ./dist
COPY --from=build --chown=node:node /app/catalog-api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/catalog-api/seed ./seed
COPY --from=build --chown=node:node /app/catalog-api/package.json ./package.json
USER node
EXPOSE 3002 50052
CMD ["node", "dist/main.js"]
