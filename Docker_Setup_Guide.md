# Docker Setup & Migration Log

This document tracks the changes made to containerize the AI-Testing-Site24x7 application and resolve the Redis vector database setup issues.

## 1. Codebase Modifications
- **`proxy.js`**: Updated the Redis client initialization (`createClient()`) to accept a connection URL via the `REDIS_URL` environment variable. This allows the Node.js server inside the Docker container to connect to the separate Redis container rather than looking for a local instance.
- **`migrate_to_redis.js`**: Similarly updated the Redis client to use the `REDIS_URL` environment variable.
- **`package.json`**: Downgraded the `redis` dependency from `^6.1.0` to `^4.6.14`. Version 6 of the Redis Node client introduced breaking changes (e.g., renaming `SchemaFieldTypes` to `SCHEMA_FIELD_TYPE`), which was causing the migration script to crash.

## 2. Docker Files Added
- **`Dockerfile`**: Defines the Node.js environment (`node:18-alpine`), installs dependencies, copies the source code, and sets up port exposures (`3333` for frontend, `3334` for the proxy server).
- **`docker-compose.yml`**: Wires three services together:
  1. **`redis`**: Uses `redis/redis-stack-server:latest` to ensure the RediSearch and RedisJSON modules are available for vector storage.
  2. **`proxy`**: Runs the backend semantic search proxy and connects to the Redis container.
  3. **`frontend`**: Serves the `index.html` frontend UI.
- **`.dockerignore`**: Added to exclude `node_modules` and hidden directories (like `.git`) from being transferred to the Docker engine during builds, drastically reducing the build time from minutes down to seconds.

## 3. How to Run the Application

The application is designed to be highly resilient. You can run it either traditionally via Node (with an automatic in-memory vector search fallback) or via Docker Compose (using Redis Stack for maximum performance).

### Option 1: Standard Run (Without Docker)
If you do not have Docker installed, the proxy will silently and automatically fall back to an **in-memory vector search**. 
You will need two terminal windows:

1. **Start the Proxy Server:**
   ```bash
   npm run proxy
   ```
2. **Start the Frontend UI:**
   ```bash
   npm run serve
   ```
3. Open your browser to [http://localhost:3333](http://localhost:3333)

### Option 2: Advanced Run (With Docker & Redis)
For the fastest performance and full Redis vector support, use Docker Compose. The application runs entirely in the background.

1. **Start the containers**:
   ```bash
   docker-compose up -d --build
   ```
2. **Access the Frontend Application**:
   Open your browser to [http://localhost:3333](http://localhost:3333)

### Useful Docker Commands
- **View logs for the proxy server**: `docker-compose logs -f proxy`
- **Stop all services**: `docker-compose down`
