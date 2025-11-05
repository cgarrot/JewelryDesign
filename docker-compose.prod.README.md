# Production Docker Setup

This directory contains Docker configuration for running the application in production.

## Files

- `Dockerfile` - Multi-stage build for the Next.js application
- `docker-compose.prod.yml` - Production orchestration with all services
- `.dockerignore` - Files to exclude from Docker builds
- `.env.prod.example` - Example environment variables for production

## Prerequisites

1. Docker and Docker Compose installed
2. Copy `.env.prod.example` to `.env.prod` and update with your production values

## Quick Start

1. **Set up environment variables:**
   ```bash
   cp .env.prod.example .env.prod
   # Edit .env.prod with your production values
   ```

2. **Build and start all services:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
   ```

3. **Run database migrations:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   ```

4. **Check logs:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

## Services

- **app** - Next.js application (port 3000)
- **postgres** - PostgreSQL database (internal only)
- **minio** - MinIO object storage (internal only)
- **minio-setup** - One-time MinIO bucket setup

## Useful Commands

### View logs
```bash
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f postgres
docker-compose -f docker-compose.prod.yml logs -f minio
```

### Stop services
```bash
docker-compose -f docker-compose.prod.yml down
```

### Stop and remove volumes (⚠️ deletes data)
```bash
docker-compose -f docker-compose.prod.yml down -v
```

### Rebuild application
```bash
docker-compose -f docker-compose.prod.yml up -d --build app
```

### Execute commands in app container
```bash
docker-compose -f docker-compose.prod.yml exec app sh
```

### Run database migrations
```bash
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### Seed materials (if needed)
```bash
docker-compose -f docker-compose.prod.yml exec app npm run seed-materials
```

## Production Considerations

1. **Security:**
   - Change all default passwords in `.env.prod`
   - Use strong passwords for PostgreSQL and MinIO
   - Consider using Docker secrets or a secrets manager
   - Don't expose PostgreSQL or MinIO ports publicly

2. **Database:**
   - Run migrations: `npx prisma migrate deploy`
   - Consider setting up regular backups
   - Use a managed PostgreSQL service for production

3. **MinIO:**
   - The bucket is automatically created on first startup
   - Consider using a managed S3-compatible service for production
   - Set up proper access policies

4. **SSL/TLS:**
   - Use a reverse proxy (nginx, Traefik) with SSL certificates
   - Update `MINIO_USE_SSL` if using SSL for MinIO

5. **Monitoring:**
   - Set up health checks (already configured)
   - Consider adding monitoring tools (Prometheus, Grafana)
   - Set up log aggregation

6. **Scaling:**
   - The app service can be scaled: `docker-compose -f docker-compose.prod.yml up -d --scale app=3`
   - Use a load balancer for multiple app instances
   - Consider using Docker Swarm or Kubernetes for orchestration

## Troubleshooting

### Application won't start
- Check logs: `docker-compose -f docker-compose.prod.yml logs app`
- Verify environment variables are set correctly
- Ensure database and MinIO are healthy

### Database connection errors
- Check postgres service is running: `docker-compose -f docker-compose.prod.yml ps`
- Verify DATABASE_URL in environment variables
- Check postgres logs: `docker-compose -f docker-compose.prod.yml logs postgres`

### MinIO connection errors
- Check minio service is running
- Verify MINIO_* environment variables
- Check if bucket was created: `docker-compose -f docker-compose.prod.yml logs minio-setup`

