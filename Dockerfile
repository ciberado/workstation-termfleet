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

# Metadata labels (OCI standard)
LABEL org.opencontainers.image.title="Termfleet"
LABEL org.opencontainers.image.description="Centralized access to ttyd-based web terminals"
LABEL org.opencontainers.image.version="2.1.1"
LABEL org.opencontainers.image.authors="Javi Moreno"
LABEL org.opencontainers.image.vendor="Termfleet"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files (schema.sql to the same location as compiled code)
COPY --from=builder /app/src/server/db/schema.sql ./dist/server/db/schema.sql

# Create directories for data and logs with correct ownership
RUN mkdir -p /app/data /app/logs && \
    chown node:node /app/data /app/logs

# Switch to non-root user
USER node

# Expose port (default 8080, configurable via env)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${TERMFLEET_PORT:-8080}/health', (r) => { if (r.statusCode !== 200) throw new Error('Health check failed'); })"

# Start application
CMD ["node", "dist/server/index.js"]
