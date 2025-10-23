FROM node:22-alpine

# Add wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S worker -u 1001

WORKDIR /app

# Copy package files
COPY worker/package*.json ./worker/

# Install dependencies
RUN cd worker && npm install --no-audit --no-fund && \
    npm cache clean --force

# Copy Prisma schema and generate client
COPY worker/prisma ./worker/prisma
RUN cd worker && npx prisma generate

# Copy worker source code
COPY worker ./worker

# Set working directory
WORKDIR /app/worker

# Change ownership
RUN chown -R worker:nodejs /app

# Switch to non-root user
USER worker

# Start worker
CMD ["npm", "run", "dev"]
