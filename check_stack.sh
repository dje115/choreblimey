#!/usr/bin/env bash
set -euo pipefail
echo "Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | sed 1d | sort
echo
echo "Service status:"
for s in postgres redis api web minio mailhog; do
  echo "- $s:"
  docker compose -f docker/docker-compose.yml ps $s || true
done
echo
echo "Open:"
echo "  Web     → http://localhost:1500"
echo "  API     → http://localhost:1501/v1/health"
echo "  MailHog → http://localhost:1506"
echo "  MinIO   → http://localhost:1505"
