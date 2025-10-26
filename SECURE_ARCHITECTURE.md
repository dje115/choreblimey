# 🛡️ ChoreBlimey Secure Admin Architecture

## Overview

This document describes the secure admin architecture that isolates admin functionality from user-facing services, providing enhanced security, network isolation, and comprehensive audit logging.

## 🏗️ Architecture Components

### **Network Isolation**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Network  │    │  Admin Network  │    │ Database Network│
│   (172.20.0.0)  │    │  (172.21.0.0)   │    │  (172.22.0.0)   │
│                 │    │                 │    │                 │
│ • Web App       │    │ • Admin Web     │    │ • PostgreSQL    │
│ • User API      │    │ • Admin API     │    │ • Redis         │
│ • Worker        │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Shared Network  │
                    │  (172.23.0.0)  │
                    │                 │
                    │ • MailHog       │
                    │ • Email Services│
                    └─────────────────┘
```

### **Service Ports**
- **User Services**: 1500-1501 (Web App, User API)
- **Admin Services**: 1502-1503 (Admin API, Admin Web)
- **Database Services**: 1502, 1507 (PostgreSQL, Redis)
- **Email Services**: 1506 (MailHog)

## 🔒 Security Features

### **1. Network Isolation**
- **User Network**: Isolated user-facing services
- **Admin Network**: Isolated admin services
- **Database Network**: Isolated database access
- **Shared Network**: Email and shared services only

### **2. Enhanced Authentication**
- **Separate JWT Secrets**: User and admin tokens use different secrets
- **2FA Required**: All admin logins require two-factor authentication
- **Session Management**: Admin sessions stored in database with IP tracking
- **Token Expiry**: Shorter expiry times for admin tokens (8 hours)

### **3. Audit Logging**
- **Admin Activity**: All admin actions logged with IP and user agent
- **Security Events**: Failed logins, suspicious activity, security scans
- **Database Queries**: All admin database queries logged
- **Session Tracking**: Login/logout events with IP addresses

### **4. Access Control**
- **Role-Based**: Admin vs Super Admin roles
- **IP Whitelisting**: Optional IP address restrictions
- **Session Timeout**: Automatic session expiry
- **Failed Login Protection**: Account lockout after failed attempts

## 🚀 Quick Start

### **Windows**
```bash
# Start secure stack
start-secure-stack.bat

# Or manually
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build -d
```

### **Linux/Mac**
```bash
# Start secure stack
./start-secure-stack.sh

# Or manually
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build -d
```

## 📊 Service Health Checks

### **User Services**
- **Web App**: http://localhost:1500
- **User API**: http://localhost:1501/health

### **Admin Services**
- **Admin Web**: http://localhost:1503
- **Admin API**: http://localhost:1502/health

### **Database Services**
- **PostgreSQL**: Port 1502
- **Redis**: Port 1507

### **Email Services**
- **MailHog**: http://localhost:1506

## 🔧 Configuration

### **Environment Variables**
```bash
# Admin API Configuration
ADMIN_API_PORT=1502
ADMIN_JWT_SECRET=admin-jwt-secret-change-in-production-2024
ADMIN_DATABASE_URL=postgresql://choreblimey:choreblimey-secure-2024@postgres:5432/choreblimey

# Security Configuration
ADMIN_IP_WHITELIST=false
ADMIN_SESSION_TIMEOUT=28800
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_LOCKOUT_DURATION=900

# Network Configuration
USER_NETWORK_SUBNET=172.20.0.0/16
ADMIN_NETWORK_SUBNET=172.21.0.0/16
DATABASE_NETWORK_SUBNET=172.22.0.0/16
SHARED_NETWORK_SUBNET=172.23.0.0/16
```

## 🛡️ Security Best Practices

### **1. Admin Access**
- Use strong, unique passwords
- Enable 2FA for all admin accounts
- Regularly rotate admin JWT secrets
- Monitor admin activity logs

### **2. Network Security**
- Admin services are isolated from user services
- Database access is restricted to necessary services
- Email services are shared but isolated from data access

### **3. Database Security**
- Admin database user has limited permissions
- All admin queries are logged for audit
- Sensitive data is encrypted at rest

### **4. Monitoring**
- All admin actions are logged
- Security events are tracked
- Failed login attempts are monitored
- Suspicious activity is flagged

## 📋 Admin Features

### **Account Cleanup Management**
- View cleanup logs and statistics
- Trigger manual cleanup processes
- Export cleanup data
- Monitor cleanup worker status

### **System Monitoring**
- System performance metrics
- Error logs and monitoring
- Security event tracking
- Database health monitoring

### **Security Management**
- Active session management
- IP address blocking
- Audit log viewing
- Security event monitoring

## 🔍 Troubleshooting

### **Service Not Starting**
```bash
# Check logs
docker compose -f docker/docker-compose-secure.yml logs [service-name]

# Restart specific service
docker compose -f docker/docker-compose-secure.yml restart [service-name]
```

### **Database Connection Issues**
```bash
# Check database health
docker compose -f docker/docker-compose-secure.yml exec postgres pg_isready

# Check admin database connection
curl http://localhost:1502/health
```

### **Network Issues**
```bash
# Check network connectivity
docker network ls
docker network inspect choreblimey-secure_user_network
docker network inspect choreblimey-secure_admin_network
```

## 📚 Additional Resources

- **User Documentation**: [README.md](README.md)
- **Development Guide**: [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- **API Documentation**: [API_DOCS.md](API_DOCS.md)
- **Security Guide**: [SECURITY.md](SECURITY.md)

## 🆘 Support

For security-related issues or questions:
1. Check the logs: `docker compose -f docker/docker-compose-secure.yml logs -f`
2. Verify network connectivity between services
3. Check database connection and permissions
4. Review admin authentication and session management

---

**⚠️ Security Notice**: This architecture provides enhanced security through network isolation and separate authentication systems. Always use strong passwords, enable 2FA, and regularly monitor admin activity logs.

