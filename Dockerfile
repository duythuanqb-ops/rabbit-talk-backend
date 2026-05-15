# 1. Builder stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. Runtime stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production
RUN apk add --no-cache mysql-client bash

COPY --from=builder /app/dist ./dist
COPY src/database/migrations ./src/database/migrations
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_HOST=mysql
ENV DB_PORT=3306
ENV DB_USER=root
ENV DB_PASSWORD=root
ENV DB_DATABASE=ribbittalk
ENV FRONTEND_URL=http://localhost:3004

EXPOSE 3000

CMD ["node", "dist/main.js"]