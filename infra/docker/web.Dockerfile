FROM node:22-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Set UTF-8 locale and environment
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LC_CTYPE=C.UTF-8

WORKDIR /app/web

# Copy package files first for better caching
COPY web/package*.json ./

# Install dependencies
RUN npm install --no-audit --no-fund

# Copy web source code (will be overridden by volume mount in dev)
COPY web .

EXPOSE 1500

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:1500 || exit 1

# Start Vite dev server
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","1500"]
