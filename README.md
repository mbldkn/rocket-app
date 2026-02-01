# Rocket App

A real-time rocket tracking system built with Node.js/TypeScript microservices architecture, featuring the Repository pattern for clean data access abstraction.

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Repository Pattern](#repository-pattern)
- [Testing](#testing)
- [Key Assumptions](#key-assumptions)
- [Production Considerations](#production-considerations)

---

## Overview

This system tracks rocket state changes in real-time by:
1. **Ingesting** messages about rocket events (launch, speed changes, explosions, mission changes)
2. **Maintaining** current state for each rocket in a database
3. **Providing** a REST API to query rocket information

---

## Architecture

### System Design

```
┌─────────────────────┐
│   Test Program      │
│   (rockets.exe)     │
└──────────┬──────────┘
           │ POST /messages
           ▼
┌─────────────────────────────────────┐
│   Message Ingestion Service (8088)  │
│   ┌─────────────────────────────┐   │
│   │  MessageController          │   │
│   └──────────┬──────────────────┘   │
│              │                      │
│   ┌──────────▼──────────────────┐   │
│   │  MessageProcessorService    │   │
│   └──────────┬──────────────────┘   │
│              │                      │
│   ┌──────────▼──────────────────┐   │
│   │  Repositories               │   │
│   │  - RocketRepository         │   │
│   │  - MessageRepository        │   │
│   │  - BufferedMessageRepository│   │
│   └──────────┬──────────────────┘   │
└──────────────┼──────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │   SQLite Database   │
     │   (Prisma ORM)      │
     └─────────┬───────────┘
               │
               ▼
┌──────────────────────────────────┐
│   Rocket API Service (3000)      │
│   ┌──────────────────────────┐   │
│   │  RocketController        │   │
│   └──────────┬───────────────┘   │
│              │                    │
│   ┌──────────▼───────────────┐   │
│   │  RocketService           │   │
│   └──────────┬───────────────┘   │
│              │                    │
│   ┌──────────▼───────────────┐   │
│   │  RocketRepository (DI)   │   │
│   └──────────┬───────────────┘   │
└──────────────┼────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  API Clients │
        └──────────────┘
```

### Component Layers

**1. Controllers** - Handle HTTP requests/responses
**2. Services** - Business logic, use repositories via dependency injection
**3. Repositories** - Data access abstraction (implements interfaces)
**4. Prisma ORM** - Type-safe database client
**5. SQLite** - Embedded database

---

## Quick Start

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
# 1. Navigate to the project
cd rocket-app

# 2. Install shared dependencies
cd shared && npm install && cd ..

# 3. Generate Prisma Client
cd shared && npx prisma generate --schema=./database/prisma/schema.prisma && cd ..

# 4. Create database
cd shared && npx prisma db push --schema=./database/prisma/schema.prisma && cd ..

# 5. Build shared package (includes repositories)
cd shared && npm run build && cd ..

# 6. Install service dependencies
cd services/message-ingestion && npm install && cd ../..
cd services/rocket-api && npm install && cd ../..
```

### Running

**Terminal 1 - Message Ingestion Service:**
```bash
npm run dev:ingestion
# Starts on http://localhost:8088
```

**Terminal 2 - Rocket API Service:**
```bash
npm run dev:api
# Starts on http://localhost:3000
```

**Terminal 3 - Test Program:**
```
./rockets launch "http://localhost:8088/messages" --message-delay=500ms --concurrency-level=1
```

---

## API Documentation

### Message Ingestion Service (Port 8088)

#### POST /messages
Ingests a rocket state change message.

**Request Body:**
```json
{
  "metadata": {
    "channel": "193270a9-c9cf-404a-8f83-838e71d9ae67",
    "messageNumber": 1,
    "messageTime": "2022-02-02T19:39:05.863Z",
    "messageType": "RocketLaunched"
  },
  "message": {
    "type": "Falcon-9",
    "launchSpeed": 500,
    "mission": "ARTEMIS"
  }
}
```

**Message Types:**
1. **RocketLaunched** - Creates new rocket
   ```json
   { "type": "Falcon-9", "launchSpeed": 500, "mission": "ARTEMIS" }
   ```

2. **RocketSpeedIncreased** - Increases speed
   ```json
   { "by": 1000 }
   ```

3. **RocketSpeedDecreased** - Decreases speed (clamps to 0)
   ```json
   { "by": 500 }
   ```

4. **RocketExploded** - Marks rocket as exploded (speed → 0, ignores future updates)
   ```json
   { "reason": "PRESSURE_VESSEL_FAILURE" }
   ```

5. **RocketMissionChanged** - Updates mission
   ```json
   { "newMission": "SHUTTLE_MIR" }
   ```

**Response:**
```json
{
  "success": true,
  "data": {
    "channel": "193270a9-c9cf-404a-8f83-838e71d9ae67",
    "messageNumber": 1,
    "messageType": "RocketLaunched",
    "processedAt": "2022-02-02T19:39:05.900Z"
  }
}
```

**Status Codes:**
- `202 Accepted` - Message successfully processed
- `400 Bad Request` - Invalid message format
- `500 Internal Server Error` - Processing failed

---

### Rocket API Service (Port 3000)

#### GET /api/rockets
Retrieve all rockets with optional filtering, sorting, and pagination.

**Query Parameters:**
- `sortBy` - Field to sort by: `speed`, `mission`, `status`, `type`, `createdAt` (default: `createdAt`)
- `order` - Sort direction: `asc`, `desc` (default: `desc`)
- `page` - Page number (default: `1`)
- `pageSize` - Items per page, 1-100 (default: `50`)
- `status` - Filter by status: `ACTIVE`, `EXPLODED`

**Examples:**
```bash
# Get all rockets
curl http://localhost:3000/api/rockets

# Get active rockets sorted by speed
curl "http://localhost:3000/api/rockets?status=ACTIVE&sortBy=speed&order=desc"

# Paginate results
curl "http://localhost:3000/api/rockets?page=2&pageSize=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "channel": "193270a9-c9cf-404a-8f83-838e71d9ae67",
      "type": "Falcon-9",
      "currentSpeed": 5000,
      "mission": "ARTEMIS",
      "status": "ACTIVE",
      "explosionReason": null,
      "lastMessageNumber": 10,
      "lastMessageTime": "2022-02-02T19:45:05.863Z",
      "createdAt": "2022-02-02T19:39:05.863Z",
      "updatedAt": "2022-02-02T19:45:05.870Z"
    }
  ],
  "pagination": {
    "total": 23,
    "page": 1,
    "pageSize": 50,
    "totalPages": 1
  }
}
```

---

#### GET /api/rockets/:channel
Retrieve a specific rocket by channel UUID.

**Example:**
```bash
curl http://localhost:3000/api/rockets/193270a9-c9cf-404a-8f83-838e71d9ae67
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "channel": "193270a9-c9cf-404a-8f83-838e71d9ae67",
    "type": "Falcon-9",
    "currentSpeed": 5000,
    "mission": "ARTEMIS",
    "status": "ACTIVE",
    "explosionReason": null,
    "lastMessageNumber": 10,
    "lastMessageTime": "2022-02-02T19:45:05.863Z",
    "createdAt": "2022-02-02T19:39:05.863Z",
    "updatedAt": "2022-02-02T19:45:05.870Z"
  }
}
```

**Status Codes:**
- `200 OK` - Rocket found
- `404 Not Found` - Rocket not found

---

#### GET /api/rockets/stats
Get aggregate statistics across all rockets.

**Example:**
```bash
curl http://localhost:3000/api/rockets/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 23,
    "active": 20,
    "exploded": 3,
    "averageSpeed": 4250
  }
}
```

---

## Repository Pattern

This project implements the **Repository Pattern** to provide a clean abstraction layer between services and data access.

### Why Repository Pattern?

1. **Testability** - Easy to mock repositories in unit tests
2. **Flexibility** - Can swap ORMs (Prisma → TypeORM) without changing services
3. **Separation of Concerns** - Repositories handle only data access
4. **Dependency Injection** - Services don't depend on concrete implementations
5. **Single Responsibility** - Each repository manages one entity

### Architecture

```
Service Layer
    ↓
Repository Interface (Contract)
    ↓
Repository Implementation
    ↓
Prisma ORM
    ↓
Database
```
---

## Testing

### Run All Tests
```bash
npm test
```

### Test Individual Services

**Message Ingestion:**
```bash
cd services/message-ingestion
npm test
```

**Rocket API:**
```bash
cd services/rocket-api
npm test
```

## Key Assumptions

### Business Logic

1. **Exploded Rockets Are Final**
   - Once exploded, rockets ignore all speed/mission changes
   - Speed set to 0 permanently
   - Status cannot change from EXPLODED

2. **Speed Cannot Go Negative**
   - If decrease exceeds current speed, clamp to 0
   - Log warning when clamping occurs

3. **Message Ordering**
   - Only apply messages with `messageNumber > lastMessageNumber`
   - Store out-of-order messages for audit, but don't apply state

4. **Duplicate Detection**
   - Same `(channel, messageNumber)` = duplicate
   - Return success, don't reprocess

5. **Rocket Must Exist**
   - Cannot process speed/mission/explosion without rocket
   - `RocketLaunched` must come first

### Technical

6. **Single Database** - SQLite sufficient for demo/development
7. **Synchronous Processing** - Messages processed within HTTP request
8. **One Channel = One Rocket** - 1:1 relationship
9. **JSON Messages** - All payloads must be valid JSON
10. **No Authentication** - Public endpoints (add in production)

### Scalability

11. **Limited Concurrency** - SQLite handles moderate load
12. **Message Rate** - ~2 messages/second (500ms delay)
13. **Data Retention** - All messages stored forever (add cleanup in production)

---

## Production Considerations

### What Would Change

**1. Database → PostgreSQL**

**2. Message Queue**

**3. Caching Layer**

**4. Horizontal Scaling**

**5. Monitoring & Observability**

**6. CI/CD Pipeline**

**7. Security**

**8. Data Management**

---

## Project Structure

```
rocket-app/
├── services/
│   ├── message-ingestion/       # POST /messages endpoint
│   │   ├── src/
│   │   │   ├── controllers/     # HTTP request handlers
│   │   │   ├── services/        # Business logic
│   │   │   ├── middleware/      # Validation, error handling
│   │   │   └── routes/          # Express routes
│   │   └── tests/               # Unit & integration tests
│   │
│   └── rocket-api/              # GET /api/rockets endpoints
│       ├── src/
│       │   ├── controllers/     # HTTP request handlers
│       │   ├── services/        # Business logic (uses repositories)
│       │   └── routes/          # Express routes
│       └── tests/               # Unit & integration tests
│
└── shared/                      # Shared code between services
    ├── database/                # Prisma schema & client
    ├── repositories/            # Data access layer
    │   ├── interfaces/          # Repository interfaces
    │   ├── RocketRepository.ts  # Rocket CRUD operations
    │   └── MessageRepository.ts # Message CRUD operations
    │   └── BufferedMessageRepository.ts # Buffered Message CRUD operations
    ├── types/                   # TypeScript types
    └── logger/                  # Winston logger
```
---

## Documentation

- **README.md** (this file) - Overview and API documentation
- **QUICK_START.md** - Quick setup guide
---

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript (strict mode)
- **Framework:** Express.js
- **Database:** SQLite (Prisma ORM)
- **Validation:** Zod
- **Logging:** Winston
- **Testing:** Jest, Supertest
---
