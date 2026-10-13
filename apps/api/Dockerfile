FROM node:24-alpine AS build
RUN npm install --global pnpm@11.19.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @quizmaster/api... --frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter @quizmaster/api db:generate && pnpm --filter @quizmaster/api build

FROM node:24-alpine AS runtime
RUN npm install --global pnpm@11.19.0
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "/app/apps/api/scripts/start-render.sh"]
