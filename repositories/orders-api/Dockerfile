# Build context is the repositories/ folder, because the service installs the
# sibling "contracts" package.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

# Contracts first: its built output is what the service installs.
COPY contracts/package.json contracts/pnpm-lock.yaml contracts/pnpm-workspace.yaml contracts/
RUN cd contracts && pnpm install --frozen-lockfile
COPY contracts contracts
RUN cd contracts && pnpm build

# Dependencies before source, so editing code does not reinstall packages.
COPY orders-api/package.json orders-api/pnpm-lock.yaml orders-api/pnpm-workspace.yaml orders-api/
RUN cd orders-api && pnpm install --frozen-lockfile
COPY orders-api orders-api
RUN cd orders-api && pnpm build && pnpm prune --prod

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/orders-api
COPY --from=build --chown=node:node /app/orders-api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/orders-api/dist ./dist
COPY --from=build --chown=node:node /app/orders-api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/orders-api/seed ./seed
COPY --from=build --chown=node:node /app/orders-api/package.json ./package.json
USER node
EXPOSE 3003
CMD ["node", "dist/main.js"]
