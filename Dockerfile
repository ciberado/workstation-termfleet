# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (client and server)
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy necessary files
COPY --from=builder /app/src/server/db/schema.sql ./src/server/db/schema.sql

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose port (default 3000, configurable via env)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${TERMFLEET_PORT:-3000}/health', (r) => { if (r.statusCode !== 200) throw new Error('Health check failed'); })"

# Start application
CMD ["node", "dist/server/index.js"]
