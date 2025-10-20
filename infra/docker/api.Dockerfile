FROM node:22-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app
COPY api/package*.json ./api/

# Install dependencies as root, then change ownership
RUN cd api && npm install --no-audit --no-fund && \
    npm cache clean --force

COPY api ./api
RUN cd api && npx prisma generate

WORKDIR /app/api

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 1501

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1501/v1/health || exit 1

CMD ["npm","run","dev"]
