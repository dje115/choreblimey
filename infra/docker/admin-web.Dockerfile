FROM node:22-alpine as builder

# Set UTF-8 locale and environment
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LC_CTYPE=C.UTF-8

# Create admin user for security
RUN addgroup -g 1001 -S admin && \
    adduser -S admin -u 1001 -G admin

# Set working directory
WORKDIR /app

# Copy package files
COPY admin-web/package*.json ./admin-web/
RUN cd admin-web && npm install

# Copy source code
COPY admin-web ./admin-web

# Build admin web app
RUN cd admin-web && npm run build

# Production stage
FROM nginx:alpine

# Set UTF-8 locale and environment
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LC_CTYPE=C.UTF-8

# Create admin user
RUN addgroup -g 1001 -S admin && \
    adduser -S admin -u 1001 -G admin

# Copy built app
COPY --from=builder /app/admin-web/dist /usr/share/nginx/html

# Copy nginx config
COPY infra/docker/admin-web.nginx.conf /etc/nginx/conf.d/default.conf

    # Set ownership for web files only
    RUN chown -R admin:admin /usr/share/nginx/html

# Keep running as root for nginx (required for port binding and PID file)
# USER admin

# Expose port
EXPOSE 1503

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:1503 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
