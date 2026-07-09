# Site24x7 AI API Search — Project Documentation

## Overview

This project is an **AI-powered search and testing tool** for Site24x7 Admin APIs. It allows engineers to search across 9,600+ API endpoints using either traditional **keyword search** or a state-of-the-art **semantic (AI) search** engine — entirely in a self-contained environment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                     │
│                                                             │
│  ┌──────────────────┐     ┌────────────────────────────┐    │
│  │   frontend-1     │     │        proxy-1             │    │
│  │  (Port 3333)     │────▶│      (Port 3334)           │    │
│  │  Static HTML/JS  │     │  Node.js Semantic Engine   │    │
│  │  index.html      │     │  + API Proxy to site24x7   │    │
│  └──────────────────┘     └────────────┬───────────────┘    │
│                                        │                    │
│                                        ▼                    │
│                           ┌────────────────────────────┐    │
│                           │         redis-1            │    │
│                           │  Redis Stack (RediSearch)  │    │
│                           │  Index: idx:api_vectors    │    │
│                           └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

> **Note on Redis:** Redis (`redis/redis-stack-server`) is used as the high-performance Vector Database. The Node.js proxy connects to Redis using the `ioredis` library, encoding the vectors as `FLOAT32` binary buffers and querying the `idx:api_vectors` index using RediSearch's exact KNN functionality.

---

## How the Semantic Search Works

The AI search engine is powered by the **`Xenova/all-MiniLM-L6-v2`** model — a compact, fast sentence-embedding transformer model that runs 100% locally on Node.js (no API keys or internet required at runtime).

### Pipeline

1. **Data Collection** → `extracted_api_endpoints.json` (raw HAR parse of Site24x7 network traffic)
2. **Data Processing** → `build_data.js`, `compact_data.js`, `map_endpoints.js`
3. **Embedding Generation** → `build_embeddings.js` → produces `site24x7_vector.json`
4. **Redis Migration** → `migrate_to_redis.js` loads the vectors from JSON into a Redis `HASH` index using `FLOAT32` binary buffers.
5. **Runtime Search** → `proxy.js` intercepts natural language queries, generates an embedding using Transformers.js, and runs a `FT.SEARCH` exact KNN query (`*=>[KNN 50 @embedding $BLOB AS score]`) against the Redis index to instantly retrieve the most contextually relevant APIs.

### Model Accuracy Testing
The Semantic Search engine's accuracy was verified against the `site24x7_Dataset.csv` dataset. By comparing the exact `endpoint` and `method` returned by the Semantic Search against the expected endpoints in the dataset:
- **Top 1 Accuracy:** ~99%
- **Top 5 Accuracy:** ~99%
- **Top 10 Accuracy:** ~99%
This proves the engine is highly capable of mapping conceptually similar phrases directly to the correct technical API paths.

### Why Semantic > Keyword

| | Keyword Search | Semantic Search |
|---|---|---|
| **How it works** | Matches exact words via TF-IDF | Understands meaning via AI embeddings |
| **Query: "website broken"** | Returns 294 results (matches any word) | Returns top 50 most *contextually relevant* APIs |
| **Noise level** | Very high — lots of irrelevant results | Very low — AI filters by meaning |
| **Speed** | Instant | Instant (using Redis Vector Index) |

---

## Key Files

| File | Purpose |
|---|---|
| `index.html` | Frontend UI — search interface for all APIs |
| `proxy.js` | Node.js backend — semantic search engine + API proxy to site24x7.com |
| `Dockerfile` | Docker image definition (Node 18 slim) |
| `docker-compose.yml` | Orchestrates frontend + proxy + Redis containers |
| `migrate_to_redis.js` | Migration script that loads all vectors into Redis as binary Hash Maps |
| `accuracy_test.js` | Temporary script used to benchmark the 99% Semantic Search accuracy |

---

## Proxy Server Endpoints

The `proxy.js` server listens on **port 3334** and exposes these endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/status` | Health check — confirms proxy is alive |
| `POST` | `/settings` | Saves the Site24x7 session cookie for API forwarding |
| `GET` | `/semantic_search?q=<query>` | Returns top 50 semantically matched API IDs + similarity scores directly from Redis |
| `*` | `/proxy?url=<url>` | Forwards authenticated requests to `www.site24x7.com` |

---

## Running Locally

Make sure Docker Desktop is running, then start the stack:

```bash
# Start all services
docker-compose up -d --build

# Run the Redis migration script (only needed once)
docker-compose exec proxy node migrate_to_redis.js
```

- **Frontend UI:** http://localhost:3333
- **Proxy API:** http://localhost:3334

---

## Data & Vector Database

The `site24x7_vector.json` file (77MB) is the pre-computed AI vector database. It was generated **once** using `build_embeddings.js` and does not need to be regenerated unless the API dataset changes.

Each entry in the file maps an `api_id` (integer) to one or more embedding vectors (arrays of 384 floats). At runtime, the proxy loads the entire file into RAM and runs brute-force cosine similarity against the query embedding.

> **The file is large (77MB) and is excluded from Git** via `.gitignore`. It must be present in the project root for semantic search to work.

---

## Current Status

| Feature | Status |
|---|---|
| Keyword Search | ✅ Working |
| Semantic Search | ✅ Working (in-memory cosine similarity) |
| API Proxy to site24x7.com | ✅ Working |
| Dockerized setup | ✅ Working |
| Redis Vector Search | ❌ Abandoned (replaced by in-memory JS) |
| Deployment to Render | ⏳ Planned — next step |

---

## Next Step: Deploy to Render

To allow your manager to access this tool via a public URL without any local setup, the app needs to be deployed to **Render.com** as a Web Service. This requires:

1. Adding a `render.yaml` config file to the repo
2. Pushing to GitHub
3. Linking the repo on render.com → 1-click deploy
