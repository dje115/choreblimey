Write-Host "Containers:" -ForegroundColor Cyan
docker ps --format 'table {{.Names}}	{{.Status}}	{{.Ports}}'
Write-Host "`nService status:" -ForegroundColor Cyan
$services = @('postgres','redis','api','web','minio','mailhog')
foreach ($s in $services) {
  Write-Host ("- {0}:" -f $s)
  docker compose -f docker/docker-compose.yml ps $s
}
Write-Host "`nOpen these in your browser:" -ForegroundColor Green
Write-Host " Web     → http://localhost:1500"
Write-Host " API     → http://localhost:1501/v1/health"
Write-Host " MailHog → http://localhost:1506"
Write-Host " MinIO   → http://localhost:1505"
