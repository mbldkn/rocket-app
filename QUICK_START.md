# 🚀 Quick Setup Guide

## Prerequisites
- Node.js v18+ installed
- npm installed

## Setup Steps (5-10 minutes)

### 1. Navigate to project

```cm
cd rocket-app
```

### 2. Install shared package dependencies

```
cd shared
npm install
cd ..
```

### 3. Generate Prisma Client (IMPORTANT!)

```
cd shared
npx prisma generate --schema=./database/prisma/schema.prisma
cd ..
```

### 4. Create the database

```
cd shared
npx prisma db push --schema=./database/prisma/schema.prisma
cd ..
```

### 5. Build the shared package

```
cd shared
npm run build
cd ..
```

### 6. Install message-ingestion service dependencies

```
cd services\message-ingestion
npm install
cd ..\..
```

### 7. Install rocket-api service dependencies

```
cd services\rocket-api
npm install
cd ..\..
```

### 8. Start services (open 2 terminals)

**Terminal 1 - Message Ingestion Service:**
```
npm run dev:ingestion
```
Wait for: ` Message Ingestion Service started on port 8088`

**Terminal 2 - Rocket API Service:**
```bas
npm run dev:api
```
Wait for: ` Rocket API Service started on port 3000`

### 9. Run the test program

```
./rockets launch "http://localhost:8088/messages" --message-delay=500ms --concurrency-level=1
```

### 10. Test the API

# Get all rockets
http://localhost:3000/api/rockets

# Get specific rocket (use channel ID from logs)
http://localhost:3000/api/rockets/{channel-id}

# Get statistics
http://localhost:3000/api/rockets/stats
```

---

## What You Should See

### Database File
- Location: `shared/dev.db`
- Can view with Prisma Studio:
  ```bash
  cd shared
  npx prisma studio --schema=./database/prisma/schema.prisma
  ```

### Log Files
- `services/message-ingestion/logs/combined.log`
- `services/rocket-api/logs/combined.log`

---

## Running Tests

### Test All Services
```
npm test
```

### Test Individual Services

**Message Ingestion:**
```
cd services/message-ingestion
npm test
```

**Rocket API:**
```
cd services/rocket-api
npm test
```
---

## Troubleshooting

### "Cannot find module '@rocket-app/shared'"

Make sure you built the shared package:
```
cd shared
npm run build
cd ..
```

### Port already in use

Change ports in `.env` file:
```env
INGESTION_PORT=8089
API_PORT=3001
```

### Database issues

Delete and recreate:

**Windows:**
```
del shared\dev.db
cd shared
npx prisma db push --schema=./database/prisma/schema.prisma
cd ..
```

**Linux/Mac:**
```
rm shared/dev.db
cd shared
npx prisma db push --schema=./database/prisma/schema.prisma
cd ..
```

### Prisma Client errors

Regenerate Prisma Client:
```
cd shared
npx prisma generate --schema=./database/prisma/schema.prisma
cd ..
```

### Dependencies not installing

Clear and reinstall:

**Windows:**
```
rmdir /s /q node_modules
del package-lock.json
npm install
```

**Linux/Mac:**
```
rm -rf node_modules package-lock.json
npm install
```

---

## API Examples

### Get All Rockets (with filters)

```
# Get all rockets, sorted by speed descending
"http://localhost:3000/api/rockets?sortBy=speed&order=desc"

# Get only active rockets
"http://localhost:3000/api/rockets?status=ACTIVE"

# Paginate results
"http://localhost:3000/api/rockets?page=1&pageSize=10"

# Combine filters
"http://localhost:3000/api/rockets?status=ACTIVE&sortBy=speed&order=desc&page=1&pageSize=5"
```

### Get Specific Rocket

```
# Replace with actual channel UUID
http://localhost:3000/api/rockets/193270a9-c9cf-404a-8f83-838e71d9ae67
```

### Get Statistics

```bash
http://localhost:3000/api/rockets/stats
```

**Example Response:**
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
