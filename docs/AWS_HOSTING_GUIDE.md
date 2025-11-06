# AWS Hosting Guide for ChoreBlimey

## Overview

This guide covers deploying ChoreBlimey to AWS. The application consists of:
- **Web App** (React/Vite SPA)
- **API** (Fastify/Node.js)
- **Worker** (Background jobs)
- **Admin Web** (React/Vite SPA)
- **Admin API** (Fastify/Node.js)
- **PostgreSQL** (Database)
- **Redis** (Cache/Queue)
- **MinIO/S3** (Object storage)

## AWS Hosting Options

### Option 1: ECS/Fargate with Application Load Balancer (Recommended)

**Best for:** Production deployments with auto-scaling

**Architecture:**
```
Internet → CloudFront → ALB → ECS Tasks (Web, API, Worker, Admin)
                         ↓
                    RDS (PostgreSQL)
                    ElastiCache (Redis)
                    S3 (Object Storage)
```

**Pros:**
- Auto-scaling
- Managed infrastructure
- High availability
- SSL/TLS termination at ALB
- Health checks

**Cons:**
- More complex setup
- Higher cost
- Requires VPC configuration

**nginx Recommendation:** ✅ **Recommended but not required**
- ALB can handle SSL termination and routing
- nginx still useful for:
  - Serving static files efficiently
  - Gzip compression
  - Additional security headers
  - Better caching control
  - Reverse proxy features

### Option 2: EC2 with Docker Compose

**Best for:** Simpler deployments, cost-effective

**Architecture:**
```
Internet → CloudFront/ALB → EC2 (Docker Compose)
                            ↓
                    RDS (PostgreSQL)
                    ElastiCache (Redis)
                    S3 (Object Storage)
```

**Pros:**
- Simpler setup
- Lower cost for small deployments
- Full control

**Cons:**
- Manual scaling
- Single point of failure (unless using multiple instances)
- More maintenance

**nginx Recommendation:** ✅ **Highly Recommended**
- Essential for serving static files
- SSL/TLS termination
- Security headers
- Gzip compression

### Option 3: S3 + CloudFront for Web App

**Best for:** Web app only (API still needs ECS/EC2)

**Architecture:**
```
Internet → CloudFront → S3 (Web App Static Files)
                    ↓
                ALB → ECS/EC2 (API, Worker, Admin)
```

**Pros:**
- Very fast static file delivery
- Global CDN
- Cost-effective for static content
- Automatic HTTPS

**Cons:**
- Only for static files (web app)
- API still needs separate hosting
- More complex routing setup

**nginx Recommendation:** ❌ **Not needed**
- CloudFront handles everything
- S3 serves static files directly

## nginx for AWS: When to Use

### ✅ Use nginx if:
1. **Using ECS/Fargate or EC2** - nginx provides:
   - Efficient static file serving
   - Gzip compression
   - Security headers
   - Better caching
   - Reverse proxy capabilities

2. **Want fine-grained control** over:
   - Caching policies
   - Compression settings
   - Security headers
   - Rate limiting

3. **Cost optimization** - nginx can reduce:
   - API load (by caching static assets)
   - Bandwidth costs (via compression)

### ❌ Skip nginx if:
1. **Using S3 + CloudFront** for web app
   - CloudFront handles everything
   - S3 serves files directly

2. **Using ALB with response headers policy** for security headers
   - ALB can add security headers
   - Still recommend nginx for static file serving

## Recommended AWS Architecture

### Production Setup (Recommended)

```
┌─────────────────────────────────────────────────────────┐
│                    CloudFront CDN                        │
│  (SSL/TLS, DDoS protection, global distribution)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Application Load Balancer                   │
│  (SSL termination, routing, health checks)              │
└──────┬──────────────────┬──────────────────┬────────────┘
       │                  │                  │
       ↓                  ↓                  ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  ECS Task   │  │  ECS Task   │  │  ECS Task   │
│  (Web+nginx)│  │  (API)      │  │  (Worker)   │
└─────────────┘  └─────────────┘  └─────────────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  RDS         │  │  ElastiCache │  │  S3          │
│  PostgreSQL  │  │  Redis       │  │  Object Store│
└──────────────┘  └──────────────┘  └──────────────┘
```

### Components:

1. **CloudFront** (Optional but recommended)
   - Global CDN
   - DDoS protection
   - SSL/TLS termination
   - Caching

2. **Application Load Balancer (ALB)**
   - SSL/TLS termination
   - Health checks
   - Routing to ECS tasks
   - Response headers policy (security headers)

3. **ECS/Fargate Tasks**
   - Web app (with nginx in production)
   - API (Fastify)
   - Worker (background jobs)
   - Admin services

4. **RDS PostgreSQL**
   - Managed database
   - Automated backups
   - Multi-AZ for HA

5. **ElastiCache Redis**
   - Managed Redis
   - High performance caching

6. **S3**
   - Object storage (images, files)
   - Static website hosting (if not using nginx)

## Deployment Steps

### 1. Build Production Images

```bash
# Build production web app (with nginx)
docker build -f infra/docker/web.Dockerfile.prod -t choreblimey-web:prod .

# Build API
docker build -f infra/docker/api.Dockerfile -t choreblimey-api:prod .

# Build Worker
docker build -f infra/docker/worker.Dockerfile -t choreblimey-worker:prod .

# Build Admin Web
docker build -f infra/docker/admin-web.Dockerfile -t choreblimey-admin-web:prod .

# Build Admin API
docker build -f admin-api/Dockerfile -t choreblimey-admin-api:prod .
```

### 2. Push to ECR (Elastic Container Registry)

```bash
# Create ECR repositories
aws ecr create-repository --repository-name choreblimey-web
aws ecr create-repository --repository-name choreblimey-api
aws ecr create-repository --repository-name choreblimey-worker
aws ecr create-repository --repository-name choreblimey-admin-web
aws ecr create-repository --repository-name choreblimey-admin-api

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push images
docker tag choreblimey-web:prod <account-id>.dkr.ecr.us-east-1.amazonaws.com/choreblimey-web:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/choreblimey-web:latest
# Repeat for other services
```

### 3. Set Up RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier choreblimey-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username choreblimey \
  --master-user-password <secure-password> \
  --allocated-storage 20 \
  --vpc-security-group-ids <security-group-id> \
  --db-subnet-group-name <subnet-group>
```

### 4. Set Up ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id choreblimey-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids <security-group-id>
```

### 5. Create ECS Task Definitions

Create task definitions for each service with:
- Container images from ECR
- Environment variables
- Resource limits
- Health checks

### 6. Create ECS Service

```bash
aws ecs create-service \
  --cluster choreblimey-cluster \
  --service-name choreblimey-web \
  --task-definition choreblimey-web:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### 7. Set Up Application Load Balancer

- Create ALB
- Configure target groups for each service
- Set up SSL certificate (ACM)
- Configure health checks
- Set up routing rules

### 8. Configure Security Groups

- Allow HTTPS (443) from internet to ALB
- Allow HTTP (80) from internet to ALB (redirect to HTTPS)
- Allow traffic from ALB to ECS tasks
- Allow ECS tasks to access RDS and ElastiCache

## Environment Variables for Production

Create a production environment file:

```env
# Database
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/choreblimey

# Redis
REDIS_URL=redis://elasticache-endpoint:6379

# JWT Secrets (use AWS Secrets Manager)
JWT_SECRET=<generate-secure-secret>
ADMIN_JWT_SECRET=<generate-secure-secret>

# S3
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=<aws-access-key>
S3_SECRET_KEY=<aws-secret-key>
S3_BUCKET=choreblimey-assets
S3_REGION=us-east-1

# API URLs
VITE_API_BASE_URL=https://api.choreblimey.com/v1
VITE_ADMIN_API_URL=https://admin-api.choreblimey.com

# Email (SES)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<ses-smtp-user>
SMTP_PASSWORD=<ses-smtp-password>
```

## Security Best Practices

1. **Use AWS Secrets Manager** for sensitive data
2. **Enable VPC** for network isolation
3. **Use IAM roles** instead of access keys where possible
4. **Enable CloudTrail** for audit logging
5. **Use WAF** (Web Application Firewall) with CloudFront
6. **Enable GuardDuty** for threat detection
7. **Regular security updates** for container images
8. **Enable encryption at rest** for RDS and S3
9. **Enable encryption in transit** (SSL/TLS everywhere)

## Cost Optimization

1. **Use Fargate Spot** for non-critical workloads
2. **Right-size** ECS tasks and RDS instances
3. **Use CloudFront** to reduce bandwidth costs
4. **Enable S3 lifecycle policies** for old files
5. **Use Reserved Instances** for RDS (if predictable usage)
6. **Monitor and optimize** with Cost Explorer

## Monitoring

1. **CloudWatch** for logs and metrics
2. **X-Ray** for distributed tracing
3. **ECS Service Discovery** for service communication
4. **ALB Access Logs** for request analysis
5. **RDS Performance Insights** for database monitoring

## Conclusion

**For AWS hosting:**
- ✅ **Use nginx** if deploying to ECS/Fargate or EC2 (recommended)
- ❌ **Skip nginx** if using S3 + CloudFront for web app
- ✅ **Use ALB** for SSL termination and routing
- ✅ **Use CloudFront** for global CDN and DDoS protection
- ✅ **Use RDS** for managed PostgreSQL
- ✅ **Use ElastiCache** for managed Redis
- ✅ **Use S3** for object storage

The production Dockerfile (`web.Dockerfile.prod`) includes nginx and is ready for AWS deployment.

