FROM node:22-alpine

# Create admin user for security
RUN addgroup -g 1001 -S admin && \
    adduser -S admin -u 1001 -G admin

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY admin-api/package*.json ./admin-api/
RUN cd admin-api && npm install && npm cache clean --force

# Copy source code
COPY admin-api ./admin-api

# Build TypeScript
RUN cd admin-api && npm run build

# Skip Prisma client generation - will use runtime connection
# RUN cd admin-api && npx prisma generate

# Set ownership to admin user
RUN chown -R admin:admin /app

# Switch to admin user
USER admin

# Expose admin API port
EXPOSE 1502

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1502/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start admin API
CMD ["dumb-init", "node", "admin-api/dist/server.js"]
