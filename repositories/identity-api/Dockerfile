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
COPY identity-api/package.json identity-api/pnpm-lock.yaml identity-api/pnpm-workspace.yaml identity-api/
RUN cd identity-api && pnpm install --frozen-lockfile
COPY identity-api identity-api
RUN cd identity-api && pnpm build && pnpm prune --prod

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/identity-api
COPY --from=build --chown=node:node /app/identity-api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/identity-api/dist ./dist
COPY --from=build --chown=node:node /app/identity-api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/identity-api/seed ./seed
COPY --from=build --chown=node:node /app/identity-api/package.json ./package.json
USER node
EXPOSE 3001 50051
CMD ["node", "dist/main.js"]
