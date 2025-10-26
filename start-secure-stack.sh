#!/bin/bash

echo "🛡️ Starting ChoreBlimey Secure Architecture..."
echo

echo "📋 Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not running"
    exit 1
fi

echo "✅ Docker is available"

echo
echo "🏗️ Building secure containers..."
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build containers"
    exit 1
fi

echo
echo "🚀 Starting secure services..."
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services"
    exit 1
fi

echo
echo "⏳ Waiting for services to be ready..."
sleep 10

echo
echo "🔍 Checking service health..."

echo "📊 User Services:"
curl -s http://localhost:1500 >/dev/null 2>&1 && echo "✅ Web App (Port 1500)" || echo "❌ Web App (Port 1500)"
curl -s http://localhost:1501/health >/dev/null 2>&1 && echo "✅ User API (Port 1501)" || echo "❌ User API (Port 1501)"

echo
echo "🛡️ Admin Services:"
curl -s http://localhost:1502/health >/dev/null 2>&1 && echo "✅ Admin API (Port 1502)" || echo "❌ Admin API (Port 1502)"
curl -s http://localhost:1503 >/dev/null 2>&1 && echo "✅ Admin Web (Port 1503)" || echo "❌ Admin Web (Port 1503)"

echo
echo "🗄️ Database Services:"
curl -s http://localhost:1502/health >/dev/null 2>&1 && echo "✅ PostgreSQL (Port 1502)" || echo "❌ PostgreSQL (Port 1502)"
curl -s http://localhost:1507 >/dev/null 2>&1 && echo "✅ Redis (Port 1507)" || echo "❌ Redis (Port 1507)"

echo
echo "📧 Email Services:"
curl -s http://localhost:1506 >/dev/null 2>&1 && echo "✅ MailHog (Port 1506)" || echo "❌ MailHog (Port 1506)"

echo
echo "🎉 Secure ChoreBlimey Stack Started!"
echo
echo "🌐 Access Points:"
echo "   👥 User App:     http://localhost:1500"
echo "   🔧 User API:     http://localhost:1501"
echo "   🛡️ Admin Web:    http://localhost:1503"
echo "   🔧 Admin API:    http://localhost:1502"
echo "   📧 MailHog:      http://localhost:1506"
echo
echo "🔒 Security Features:"
echo "   ✅ Network isolation between user and admin services"
echo "   ✅ Separate authentication systems"
echo "   ✅ Enhanced admin security with 2FA"
echo "   ✅ Comprehensive audit logging"
echo "   ✅ IP whitelisting and session management"
echo
echo "📊 To view logs: docker compose -f docker/docker-compose-secure.yml logs -f"
echo "🛑 To stop: docker compose -f docker/docker-compose-secure.yml down"
echo

