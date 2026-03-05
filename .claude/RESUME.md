# Automated Work Resumption Guide

This document explains how to set up automatic session resumption and continuous work execution.

## Quick Resumption (Manual)

After context reset or session end, immediately run:

```bash
bash .claude/resume-work.sh
```

This will:
1. Show git status and recent commits
2. Run TypeScript validation (fail if errors)
3. List all active tasks
4. Display work summary
5. Show next steps for each engineer
6. Verify everything is pushed to origin

## Automatic Resumption via Cron (Every Hour)

Set up a cron job to automatically check and log work status every hour:

```bash
# Open crontab editor
crontab -e

# Add this line to run every hour at :00
0 * * * * cd /Users/simonberry/Documents/GitHub/simontheberry.github.io && bash .claude/resume-work.sh >> .claude/resume.log 2>&1

# To run every 30 minutes instead:
*/30 * * * * cd /Users/simonberry/Documents/GitHub/simontheberry.github.io && bash .claude/resume-work.sh >> .claude/resume.log 2>&1
```

View the log:
```bash
tail -f .claude/resume.log
```

## Session Reset Recovery

When Claude Code context resets (after ~1 hour):

1. **First thing**: Run the resume script
   ```bash
   bash .claude/resume-work.sh
   ```

2. **Read the output** - Shows:
   - Last commit and work done
   - Current task status
   - TypeScript compilation status
   - Next steps for each engineer

3. **Update the team** about resumption
   ```bash
   # Claude Code will automatically continue based on team messages
   ```

## Continuous Integration (Optional)

For fully automated testing on every commit:

```bash
# In the project directory, create a post-commit hook:
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
npm run typecheck || exit 1
echo "✅ Post-commit verification: PASS"
EOF

chmod +x .git/hooks/post-commit
```

## Current Work Status

**Last Update**: 2026-03-05 13:21 UTC

### Completed Tasks
- Task #36: Evidence upload/download ✅
- Tasks 1-35, 37-49: Infrastructure setup ✅

### In-Progress Tasks
- **Task #41** (frontend-engineer): Conversational intake UI
  - Scaffolds: ✅ READY (4 new step components created)
  - Status: Testing and polish phase

- **Task #40** (backend-engineer): State machine & case management
  - Scaffolds: ✅ READY (complaint-state-machine.ts, transition-manager.ts)
  - Integration: ✅ WIRED (POST /complaints/:id/transition endpoint)
  - Status: Prisma query connection needed

- **Task #50-52** (security-officer): Post-deployment security audit
  - Status: Security scanning in progress

- **Task #51** (ai-engineer): Advanced systemic detection
  - Status: Vector search optimization in progress

### Pending Backlog
- Task #39: Multi-tenant customization
- Task #44: Backlog summary (17 improvement tasks)

## Environment

- **Node**: v18+
- **Database**: PostgreSQL with pgvector
- **TypeScript**: Strict mode, zero errors required
- **Frontend**: Next.js 14 with App Router
- **Backend**: Express.js + Prisma
- **Package Manager**: npm

## Commands Reference

```bash
# Development
npm run dev              # Start Next.js + Express concurrently
npm run dev:client      # Next.js only (port 3000)
npm run dev:server      # Express only (port 4000)

# Build & Check
npm run build           # Build client then server
npm run typecheck       # TypeScript validation (strict mode)
npm run lint           # ESLint check

# Database
npx prisma generate    # Regenerate Prisma client
npx prisma studio     # Visual DB browser (port 5555)
npm run db:seed       # Load demo data

# Testing
npm run test           # Vitest (watch mode)
npm run test:watch     # Vitest continuous

# Background Jobs
npm run queue:worker   # Start BullMQ worker
```

## Troubleshooting

**TypeScript Errors After Resume?**
```bash
npm install              # Reinstall dependencies
npm run typecheck        # Verify compilation
```

**Git State Dirty?**
```bash
git status              # See uncommitted changes
git diff                # Review changes
git add .               # Stage everything
git commit -m "message" # Commit with descriptive message
```

**Need Full Context?**
```bash
bash .claude/resume-work.sh    # Shows everything
git log --oneline -20          # See commit history
```

## Notes

- All work is tracked in task list (#20-52)
- Code follows CLAUDE.md standards (zero-error TypeScript, Tailwind CSS, Zod validation)
- Commits have bot signature: `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`
- Production deployment verified at https://[domain]
- All engineers work autonomously on assigned tasks

---

**Last Resume**: March 5, 2026 13:21 UTC
**Next Expected Reset**: ~1 hour from last activity
**Cron Status**: Set up per instructions above
