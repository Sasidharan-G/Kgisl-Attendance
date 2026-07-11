# Build stage for frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Build stage for backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
COPY backend/ .
RUN npx prisma generate
RUN npm run build

# Production runtime image
FROM node:18-alpine
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

WORKDIR /app/backend
# Keep the Render database schema and idempotent seed data ready before boot.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed && npm start"]
