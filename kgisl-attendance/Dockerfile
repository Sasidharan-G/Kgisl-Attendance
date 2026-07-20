# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
COPY backend/ .
RUN npx prisma generate
RUN npm run build

# Production runtime image
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl

# Copy backend dependencies and build
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/prisma ./backend/prisma

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose backend port
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT}/health/ready" || exit 1

WORKDIR /app/backend
# Apply schema changes and idempotently bootstrap missing catalog/users on every
# release. The seed never overwrites an existing account password.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && npm run prisma:seed && exec node dist/server.js"]
