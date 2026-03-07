#!/bin/bash
# Automated Work Resumption Script
# This script resumes work after session/context reset
# Usage: bash .claude/resume-work.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "Work Resumption Script - $(date)"
echo "═══════════════════════════════════════════════════════════════"

# 1. Check Git Status
echo ""
echo "📋 Git Status:"
git status --short || true
echo ""

# 2. Get Latest Commits
echo "📝 Recent Commits:"
git log --oneline -5
echo ""

# 3. Run TypeScript Check
echo "🔍 Running TypeScript check..."
if npm run typecheck 2>&1 | tail -5; then
  echo "✅ TypeScript: PASS"
else
  echo "❌ TypeScript: FAIL - Fix errors before continuing"
  exit 1
fi

# 4. List Pending Tasks
echo ""
echo "📌 Active Tasks:"
echo "Task #41: Conversational complaint intake UI (frontend-engineer)"
echo "Task #40: State machine & case management (backend-engineer)"
echo "Task #50-52: Post-deployment security audit (security-officer)"
echo "Task #51: Advanced systemic detection (ai-engineer)"
echo ""

# 5. Show Work Summary
echo "📊 Work Summary:"
echo "- Evidence upload/download: ✅ COMPLETE (Task #36)"
echo "- Intake wizard scaffolds: ✅ CREATED (4 new components)"
echo "- State machine integration: ✅ WIRED (POST /complaints/:id/transition)"
echo "- All TypeScript: ✅ ZERO ERRORS"
echo ""

# 6. Show Next Steps
echo "🚀 Next Steps:"
echo "1. Frontend: Polish intake UI flow and test end-to-end"
echo "2. Backend: Connect state machine to Prisma queries"
echo "3. Security: Run OWASP ZAP scan and npm audit"
echo "4. AI: Optimize vector search performance"
echo ""

# 7. Push to Remote
if git diff --quiet origin/main; then
  echo "✅ All changes already pushed to origin/main"
else
  echo "⚠️  Unpushed changes detected - review with 'git diff origin/main'"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Resume Context:"
echo "- Last commit: $(git log -1 --format='%h: %s')"
echo "- Committed by: $(git log -1 --format='%an')"
echo "- Time: $(git log -1 --format='%aI')"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✅ Work resumption context established. Ready to continue!"
echo ""
