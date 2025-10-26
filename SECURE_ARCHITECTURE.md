# Secure Admin Portal Architecture

## Overview

The ChoreBlimey secure admin portal implements a separated architecture with isolated admin services for enhanced security and better operational management.

## Architecture Components

### Service Isolation

The secure architecture separates admin functionality from user-facing services:

- **User Services**: `api`, `web`, `worker` - Handle all user-facing functionality
- **Admin Services**: `admin-api`, `admin-web` - Handle all administrative functionality
- **Shared Services**: `postgres`, `redis`, `mailhog` - Shared infrastructure

### Network Segmentation

The architecture implements proper network segmentation with dedicated networks:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Network  │    │  Admin Network  │    │Database Network │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │    web    │  │    │  │ admin-web │  │    │  │  postgres │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │    api    │  │    │  │ admin-api │  │    │  │   redis   │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │                 │    │                 │
│  │  worker   │  │    │                 │    │                 │
│  └───────────┘  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Shared Network  │
                    │                 │
                    │  ┌───────────┐  │
                    │  │  mailhog  │  │
                    │  └───────────┘  │
                    └─────────────────┘
```

### Network Details

- **user_network**: Isolated network for user-facing services
- **admin_network**: Isolated network for admin services
- **database_network**: Dedicated network for database access
- **shared_network**: Shared network for common services (email, etc.)

## Security Features

### Service Isolation
- Admin services cannot directly access user services
- User services cannot access admin services
- Proper network boundaries prevent lateral movement

### Authentication & Authorization
- Separate admin authentication system
- Enhanced 2FA support for admin accounts
- Role-based access control
- JWT tokens with proper expiration

### Data Protection
- Admin data isolated from user data
- Encrypted sensitive information
- Proper input validation and sanitization
- SQL injection prevention with Prisma ORM

### Network Security
- Dedicated networks prevent cross-service communication
- Health checks ensure service availability
- Proper port mapping and exposure control
- Container security with minimal attack surface

## Deployment

### Standard Stack
```bash
# For development and testing
docker compose -f docker/docker-compose.yml --env-file docker/dev.env up --build
```

### Secure Stack
```bash
# For production-ready deployment
docker compose -f docker/docker-compose-secure.yml --env-file docker/dev-secure.env up --build
```

## Service Ports

### User Services
- **Web**: `1500` - User interface
- **API**: `1501` - User API endpoints
- **Worker**: Internal - Background jobs

### Admin Services
- **Admin Web**: `1503` - Admin interface
- **Admin API**: `1502` - Admin API endpoints

### Infrastructure
- **PostgreSQL**: `1504` - Database
- **Redis**: `1505` - Cache and job queue
- **MailHog UI**: `1506` - Email testing interface
- **MailHog SMTP**: `2526` - Email server

## Admin Portal Features

### Authentication
- Email/password login
- Two-factor authentication (2FA)
- Account verification via email
- Secure session management

### Dashboard
- System overview and statistics
- Quick action buttons
- Service status monitoring
- Recent activity logs

### Account Management
- Automated account cleanup
- Inactive account detection
- Email warning system
- Data retention policies

### Email Management
- SMTP configuration
- Email template management
- Delivery monitoring
- Bounce handling

### Affiliate Management
- Amazon PA-API integration
- SiteStripe configuration
- Product management
- Commission tracking

### System Monitoring
- Performance metrics
- Error logging
- Security events
- Resource utilization

## Health Checks

All services include comprehensive health checks:

- **API Services**: HTTP endpoint checks
- **Web Services**: Nginx status checks
- **Database**: Connection and query checks
- **Cache**: Redis connectivity checks
- **Email**: SMTP connectivity checks

## Environment Configuration

### Development
- Uses `docker/dev-secure.env` for configuration
- MailHog for email testing
- Debug logging enabled
- Hot reloading for development

### Production
- Uses production environment variables
- Real SMTP configuration
- Optimized logging
- Security headers enabled

## Monitoring & Logging

### Application Logs
- Structured JSON logging
- Request/response tracking
- Error categorization
- Performance metrics

### System Monitoring
- Container health status
- Resource utilization
- Network connectivity
- Service availability

### Security Logging
- Authentication attempts
- Authorization failures
- Suspicious activities
- Admin actions audit trail

## Backup & Recovery

### Database Backups
- Automated PostgreSQL backups
- Point-in-time recovery
- Cross-region replication
- Data integrity checks

### Configuration Backups
- Environment configuration
- Docker Compose files
- SSL certificates
- Admin settings

## Maintenance

### Updates
- Rolling updates for zero downtime
- Database migration support
- Configuration hot-reloading
- Service restart capabilities

### Scaling
- Horizontal scaling support
- Load balancing ready
- Database connection pooling
- Cache clustering support

## Security Best Practices

1. **Network Isolation**: Services communicate only through defined interfaces
2. **Least Privilege**: Services have minimal required permissions
3. **Defense in Depth**: Multiple security layers
4. **Regular Updates**: Keep all components updated
5. **Monitoring**: Continuous security monitoring
6. **Access Control**: Strict authentication and authorization
7. **Data Encryption**: Encrypt sensitive data at rest and in transit
8. **Audit Logging**: Comprehensive audit trails

## Troubleshooting

### Common Issues
- Service health check failures
- Network connectivity problems
- Authentication issues
- Email delivery problems

### Debug Commands
```bash
# Check service status
docker compose -f docker/docker-compose-secure.yml ps

# View service logs
docker compose -f docker/docker-compose-secure.yml logs [service-name]

# Test service connectivity
docker compose -f docker/docker-compose-secure.yml exec [service-name] ping [target-service]

# Check network configuration
docker network ls
docker network inspect choreblimey-secure_admin_network
```

## Future Enhancements

- **API Gateway**: Centralized API management
- **Service Mesh**: Advanced service communication
- **Secrets Management**: Centralized secret storage
- **Compliance**: GDPR/SOC2 compliance features
- **Multi-Region**: Cross-region deployment support