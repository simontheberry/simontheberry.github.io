# Phase 1 Readiness Checklist

**Purpose:** Verify all prerequisites before starting Phase 1 work

Run this checklist before assigning tasks. ✅ = Ready, ❌ = Needs setup

---

## 1. Node & npm Environment

```bash
node --version  # Should be v18+ (currently ?)
npm --version   # Should be v8+ (currently ?)
npm list | grep -E "bullmq|prisma|openai"
```

**Requirements:**
- ✅ Node v18+
- ✅ npm v8+
- ✅ BullMQ installed
- ✅ Prisma CLI available
- ✅ OpenAI/Anthropic SDK installed

---

## 2. PostgreSQL Database

```bash
# Check if postgres is running
psql --version

# Test connection
psql -U postgres -h localhost -d simontheberry_github_io -c "SELECT version();"

# Check if migrations applied
npx prisma migrate status

# Check tables exist
psql -U postgres -h localhost -d simontheberry_github_io -c "\dt"
```

**Requirements:**
- ✅ PostgreSQL running (localhost:5432)
- ✅ Database exists: `simontheberry_github_io` (or similar)
- ✅ Migrations applied (`npx prisma migrate deploy`)
- ✅ Tables exist: complaints, users, businesses, audit_logs, etc.
- ✅ Sample data seeded (optional but helpful)

---

## 3. Redis Cache

```bash
# Check if redis is running
redis-cli ping  # Should return PONG

# Test connection
redis-cli -h localhost -p 6379 PING

# Check version
redis-cli --version
```

**Requirements:**
- ✅ Redis running (localhost:6379)
- ✅ Can accept connections
- ✅ No authentication required (or credentials in .env)

---

## 4. API Keys & Environment Variables

```bash
# Check .env file exists
ls -la .env

# Verify critical variables (don't print values for security)
grep -E "OPENAI_API_KEY|ANTHROPIC_API_KEY|JWT_SECRET|DATABASE_URL|REDIS_URL" .env

# Or check via npm config
npm list dotenv
```

**Requirements:**
- ✅ `.env` file exists in project root
- ✅ `OPENAI_API_KEY` set (for Task #28 & #29)
- ✅ `ANTHROPIC_API_KEY` set (for Task #28, optional)
- ✅ `JWT_SECRET` set (should NOT be default)
- ✅ `DATABASE_URL` points to PostgreSQL
- ✅ `REDIS_URL` points to Redis (or localhost:6379 default)

---

## 5. Codebase Health

```bash
# Type checking
npm run typecheck
# Should return: 0 errors

# Linting
npm run lint
# Should return: 0 errors or only warnings

# Build
npm run build
# Should complete without errors
```

**Requirements:**
- ✅ `npm run typecheck` passes (zero errors)
- ✅ `npm run lint` passes (zero errors)
- ✅ `npm run build` completes successfully
- ✅ No breaking changes in dependencies

---

## 6. Git & Repository

```bash
# Check git status
git status

# Verify main branch is up to date
git log --oneline -5

# Check remotes
git remote -v
```

**Requirements:**
- ✅ Working directory clean (no uncommitted changes)
- ✅ On `main` branch
- ✅ Latest code pulled from origin
- ✅ Can push to origin/main (no permission issues)

---

## Quick Status Script

Run this to auto-check everything:

```bash
#!/bin/bash

echo "=== Phase 1 Readiness Check ==="
echo ""

echo "1. Node/npm:"
node --version && npm --version || echo "❌ Node/npm missing"
echo ""

echo "2. PostgreSQL:"
psql --version && psql -U postgres -h localhost -c "SELECT 1;" 2>/dev/null && echo "✅ PostgreSQL OK" || echo "❌ PostgreSQL not accessible"
echo ""

echo "3. Redis:"
redis-cli ping 2>/dev/null && echo "✅ Redis OK" || echo "❌ Redis not accessible"
echo ""

echo "4. Environment:"
[ -f .env ] && echo "✅ .env exists" || echo "❌ .env missing"
grep -q "OPENAI_API_KEY" .env 2>/dev/null && echo "✅ OPENAI_API_KEY set" || echo "❌ OPENAI_API_KEY missing"
grep -q "DATABASE_URL" .env 2>/dev/null && echo "✅ DATABASE_URL set" || echo "❌ DATABASE_URL missing"
echo ""

echo "5. Codebase:"
npm run typecheck 2>&1 | grep -q "0 errors" && echo "✅ TypeScript OK" || echo "❌ TypeScript errors"
npm run build 2>&1 | grep -q "error" && echo "❌ Build errors" || echo "✅ Build OK"
echo ""

echo "=== Done ==="
```

---

## What If Something Is Missing?

### ❌ PostgreSQL Not Running?
```bash
# Mac (if installed via Homebrew)
brew services start postgresql

# Or start manually
postgres -D /usr/local/var/postgres

# Linux
sudo systemctl start postgresql

# Docker
docker-compose up -d postgres
```

**Then initialize database:**
```bash
createdb simontheberry_github_io
npx prisma migrate deploy
npx prisma db seed  # Optional: seed demo data
```

### ❌ Redis Not Running?
```bash
# Mac
brew services start redis

# Or start manually
redis-server

# Docker
docker-compose up -d redis
```

### ❌ Missing API Keys?
```bash
# Get OpenAI key from: https://platform.openai.com/api-keys
# Get Anthropic key from: https://console.anthropic.com/

# Add to .env
echo "OPENAI_API_KEY=sk-..." >> .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
```

### ❌ Environment Variables Not Set?
```bash
# Copy example to .env
cp .env.example .env

# Edit to fill in real values
nano .env
```

### ❌ Git Has Uncommitted Changes?
```bash
# Stash changes
git stash

# Or commit them
git add .
git commit -m "wip: checkpoint before Phase 1"
```

---

## Recommended Setup Order

If you need to set things up from scratch:

1. **Database** (10 min)
   ```bash
   # Start PostgreSQL
   # Create database
   createdb simontheberry_github_io
   # Run migrations
   npx prisma migrate deploy
   ```

2. **Redis** (5 min)
   ```bash
   # Start Redis
   redis-server
   ```

3. **Environment** (5 min)
   ```bash
   # Copy and edit .env
   cp .env.example .env
   nano .env  # Add API keys
   ```

4. **Verify** (5 min)
   ```bash
   npm run typecheck
   npm run build
   ```

5. **Ready!** (0 min)
   ```bash
   echo "Phase 1 ready to kick off"
   ```

---

## Phase 1 Prerequisites Checklist

Before assigning Task #27, verify:

- [ ] PostgreSQL running and accessible
- [ ] Redis running and accessible
- [ ] `.env` configured with API keys
- [ ] `npm run typecheck` passes
- [ ] `npm run build` completes
- [ ] Git repository clean
- [ ] Team members have code access

---

## Once Verified

Once all checkboxes are ✅:

1. Assign Phase 1 tasks to team members
2. Start standup meetings (daily, 15 min)
3. Backend Engineer #1 claims Task #27 (workers)
4. Backend Engineer #2 claims Task #28 (AI calls)
5. Kick off!

---

**Status:** Awaiting setup verification
**Next:** Run checklist, fix any issues, assign Phase 1 tasks
**Est. Time to Ready:** 15-30 min (if all working) to 1-2 hours (if setup needed)
