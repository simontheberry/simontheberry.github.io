# TODO Tracker CLI: UX Research & Recommendations

## Executive Summary

This document synthesizes UX research from existing TODO tracker tools (leasot, todocheck, tickgit, todoctor), leading CLI UX guidelines (clig.dev, Atlassian's 10 CLI principles), and best-in-class developer CLI tools (gh, ripgrep, fzf, npm). The recommendations aim to make a TODO tracker CLI that feels instantly familiar to developers while offering genuinely useful workflow integration.

---

## 1. CLI Interface Design

### Command Structure

Follow the `<tool> <noun> <verb>` pattern used by `gh`, `docker`, and `kubectl`. This scales well as commands grow and reads naturally.

**Recommended command tree:**

```
todo scan              # Scan codebase for TODOs (the primary action)
todo list              # List all known TODOs (from last scan or cache)
todo show <id>         # Show details for a specific TODO
todo stats             # Summary statistics
todo check             # CI mode: exit non-zero if policy violations found
todo blame             # Attribute TODOs to authors via git blame
todo init              # Create a .todorc.toml config file interactively
todo config            # View/edit configuration
todo ignore <pattern>  # Add a file/directory to ignore list
todo clean             # Remove stale cache data
```

**Why this works:**
- `scan` and `list` are separate because scanning is expensive (filesystem + git), listing is cheap (cached)
- `check` is a dedicated CI command, not a flag on `scan`, because CI usage has different output/exit-code expectations
- `init` follows the convention of `npm init`, `git init`, `eslint --init`

### Flag Design

```
# Global flags (available on all commands)
--format, -f <format>    # Output format: table (default), json, csv, markdown
--color / --no-color     # Force color on/off (auto-detect by default)
--quiet, -q              # Suppress non-essential output
--verbose, -v            # More detailed output
--config, -c <path>      # Use specific config file
--cwd <path>             # Override working directory

# Scan-specific flags
todo scan --tags TODO,FIXME,HACK        # Which tags to scan for
todo scan --include "src/**/*.ts"       # Glob patterns to include
todo scan --exclude "node_modules,dist" # Glob patterns to exclude
todo scan --since "2 weeks ago"         # Only TODOs added since date/ref
todo scan --author "jane@example.com"   # Filter by git blame author
todo scan --stale 30                    # Flag TODOs older than N days

# List-specific flags
todo list --sort priority               # Sort by: file (default), priority, age, author
todo list --group-by file               # Group by: file, tag, author, priority
todo list --tag FIXME                   # Filter by specific tag
todo list --priority high               # Filter by priority level

# Check-specific flags (CI mode)
todo check --max-count 50               # Fail if more than N TODOs exist
todo check --max-age 90                 # Fail if any TODO is older than N days
todo check --require-issue              # Fail if TODOs lack issue tracker links
todo check --require-author             # Fail if TODOs lack author attribution
```

### First-Run Experience

When a user runs `todo scan` for the first time in a project without a config file:

```
$ todo scan

  No .todorc.toml found. Scanning with defaults...

  Found 47 TODOs across 23 files

  Tag      Count
  -------  -----
  TODO     31
  FIXME    12
  HACK     4

  Run `todo init` to create a config file for this project.
  Run `todo list` to see all results.
```

The tool should work with zero configuration, following the principle of sensible defaults.

---

## 2. Output Formatting

### Interactive Terminal Output (default)

Use color, alignment, and grouping to make output scannable. Reference: ripgrep's output format, which groups by file with colored matches.

```
$ todo list

  src/server/api/routes/auth.ts
    L42  TODO   Implement refresh token rotation          @jane  32d ago
    L87  FIXME  Race condition in session validation       @mike  14d ago

  src/server/services/ai/provider.ts
    L15  TODO   Add retry logic for API timeouts           @jane  45d ago  #GH-234
    L98  HACK   Hardcoded model name, needs config                 7d ago

  components/dashboard/StatsPanel.tsx
    L23  TODO   Replace hardcoded DEMO_DATA with API call  @team  60d ago

  ── 47 TODOs in 23 files (12 FIXME, 4 HACK, 31 TODO) ──
```

**Key formatting decisions:**
- Group by file (developers think in files)
- Show line number, tag, description, author, age
- Color-code by tag: TODO (yellow), FIXME (red), HACK (magenta), XXX (red bold)
- Age uses relative time ("32d ago") not absolute dates
- Issue tracker links shown inline when present
- Summary line at bottom with counts

### Machine-Readable Output (CI/scripting)

```
$ todo list --format json

[
  {
    "file": "src/server/api/routes/auth.ts",
    "line": 42,
    "tag": "TODO",
    "text": "Implement refresh token rotation",
    "author": "jane@example.com",
    "date": "2026-01-14",
    "age_days": 32,
    "issue": null
  }
]
```

```
$ todo list --format csv
file,line,tag,text,author,date,age_days,issue
src/server/api/routes/auth.ts,42,TODO,Implement refresh token rotation,jane@example.com,2026-01-14,32,
```

```
$ todo stats --format json

{
  "total": 47,
  "by_tag": { "TODO": 31, "FIXME": 12, "HACK": 4 },
  "by_author": { "jane@example.com": 18, "mike@example.com": 12, "unattributed": 17 },
  "oldest_days": 120,
  "median_age_days": 28,
  "stale_count": 8
}
```

### Stats Command Output

```
$ todo stats

  Summary
  -------
  Total TODOs:     47 across 23 files
  Oldest:          120 days (src/legacy/parser.ts:14)
  Median age:      28 days
  Stale (>30d):    8

  By Tag           By Author            By Priority
  --------         ----------           -----------
  TODO    31       jane        18       critical  2
  FIXME   12       mike        12       high      8
  HACK     4       unattributed 17      normal   31
                                        low       6

  Trend (last 30 days)
  --------------------
  Added:    14
  Resolved: 11
  Net:      +3
```

### Color and Accessibility

- Auto-detect terminal color support; disable when piped or when `NO_COLOR` env var is set (per no-color.org convention)
- Use semantic colors: red for warnings/FIXME, yellow for TODO, green for resolved
- Never rely on color alone -- always pair with text labels or symbols

---

## 3. Developer Workflow Integration

### Pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/your-org/todo-cli
    rev: v1.0.0
    hooks:
      - id: todo-check
        args: ["--require-issue", "--max-count", "50"]
```

Or as a standalone git hook:

```bash
# .git/hooks/pre-commit
#!/bin/sh
todo check --require-issue --max-age 90
```

**Behavior:** The pre-commit hook should only check *changed files* by default (fast), with an option for full-repo scan.

### CI Pipeline Integration

```yaml
# GitHub Actions example
- name: Check TODOs
  run: |
    npx todo-cli check \
      --require-issue \
      --max-age 90 \
      --max-count 100 \
      --format json > todo-report.json

- name: Comment PR with TODO summary
  if: github.event_name == 'pull_request'
  run: |
    npx todo-cli list --since ${{ github.event.pull_request.base.sha }} --format markdown
```

**CI-specific behaviors:**
- `todo check` exits with code 1 on policy violation (enables CI gating)
- `--format markdown` outputs a PR-friendly summary
- `--since <ref>` reports only TODOs introduced in the diff (prevents legacy TODOs from blocking PRs)

### Editor Integration

- **VS Code extension:** Use `todo list --format json --cwd <workspace>` as a data source for a tree view (similar to Todo Tree extension)
- **Neovim/Vim:** Populate quickfix list from `todo list --format json`
- Both integrate with existing editor patterns rather than requiring custom protocols

### Git Blame Attribution

```
$ todo blame

  Author             Count  Oldest    Stale
  -----------------  -----  --------  -----
  jane@example.com   18     120d ago  5
  mike@example.com   12     45d ago   2
  unattributed       17     --        --
```

Use `git blame` data to attribute TODOs to the developer who last touched that line. This enables team accountability without manual tagging.

---

## 4. TODO Syntax Conventions

### Default Recognized Tags (case-insensitive)

| Tag     | Meaning                    | Default Priority |
|---------|----------------------------|-----------------|
| `TODO`  | Something to be done       | normal          |
| `FIXME` | Known bug or broken code   | high            |
| `HACK`  | Workaround, needs cleanup  | normal          |
| `XXX`   | Danger, needs attention    | high            |
| `NOTE`  | Not actionable, informational | low (opt-in) |

### Structured Format Support

The tool should recognize progressively richer formats:

```
// Level 1: Basic (always recognized)
// TODO: Implement caching

// Level 2: Author attribution
// TODO(jane): Implement caching

// Level 3: Issue tracker link
// TODO(jane): Implement caching #GH-234
// TODO: Fix race condition JIRA-1234

// Level 4: Full structured format (opt-in)
// TODO(jane, p:high, d:2026-03-01): Implement caching #GH-234
```

**Parsing rules:**
- Tag is case-insensitive: `todo`, `TODO`, `Todo` all match
- Parenthetical after tag is treated as author: `TODO(jane)`
- Issue references detected by pattern: `#123`, `GH-123`, `JIRA-1234`, or full URLs
- Priority/deadline via `p:` and `d:` prefixes inside parenthetical (opt-in, not required)
- Description is everything after the colon

### Custom Tags

Allow users to define custom tags in config:

```toml
[tags]
custom = ["PERF", "SECURITY", "DEBT"]

[tags.priority]
SECURITY = "critical"
PERF = "high"
DEBT = "normal"
```

---

## 5. Configuration UX

### Config File Format: TOML

**Why TOML over YAML/JSON:**
- Readable and writable by humans (unlike JSON -- no comments, trailing commas)
- No indentation pitfalls (unlike YAML)
- Short spec that developers can learn in minutes
- Increasingly standard for developer tools (Rust's Cargo.toml, Python's pyproject.toml, Deno)

### Config File Name: `.todorc.toml`

Follows established conventions: `.eslintrc`, `.prettierrc`, but with `.toml` extension for editor syntax highlighting.

### Default Config (generated by `todo init`)

```toml
# .todorc.toml - TODO tracker configuration

[scan]
# File patterns to include (glob syntax)
include = ["**/*"]

# File patterns to exclude
exclude = [
  "node_modules",
  "dist",
  "build",
  ".git",
  "vendor",
  "*.min.js",
  "package-lock.json",
  "yarn.lock",
]

[tags]
# Tags to scan for (case-insensitive)
default = ["TODO", "FIXME", "HACK", "XXX"]
# custom = ["PERF", "SECURITY"]

[tags.priority]
TODO = "normal"
FIXME = "high"
HACK = "normal"
XXX = "high"

[policy]
# Maximum number of TODOs allowed (0 = unlimited)
max_count = 0
# Maximum age in days before a TODO is considered stale (0 = disabled)
max_age = 0
# Require issue tracker references
require_issue = false
# Require author attribution
require_author = false

[output]
# Default output format: table, json, csv, markdown
format = "table"
# Default grouping: file, tag, author, priority
group_by = "file"
# Default sort: file, priority, age, author
sort = "file"

# [issue_tracker]
# type = "github"                          # github, gitlab, jira
# url = "https://github.com/org/repo"      # auto-detected from git remote
```

### Config Resolution Order

1. CLI flags (highest priority)
2. `.todorc.toml` in project root
3. `~/.config/todo/config.toml` (global defaults)
4. Built-in defaults (lowest priority)

This mirrors how tools like ESLint, Prettier, and Git resolve configuration.

---

## 6. Notification & Alerting

### Staleness Detection

A TODO becomes "stale" based on configurable rules:

```toml
[policy]
max_age = 90     # Days since the TODO was introduced (via git blame)
```

```
$ todo list --stale 30

  Stale TODOs (older than 30 days)
  ================================

  src/legacy/parser.ts
    L14  TODO   Refactor to use new AST format   @jane  120d ago

  src/server/config/index.ts
    L45  FIXME  JWT default check is fragile      @mike   62d ago

  ── 8 stale TODOs found ──
```

### Issue Tracker Integration

**Approach:** Read-only integration. The tool checks if linked issues are still open, but does NOT automatically create/close issues. This avoids accidental side effects.

```
$ todo check --require-issue

  ERROR: 12 TODOs without issue tracker links

  src/server/api/routes/auth.ts:42
    TODO: Implement refresh token rotation
    >> Add an issue reference: // TODO: Implement refresh token rotation #GH-XXX

  src/server/services/ai/provider.ts:15
    TODO: Add retry logic for API timeouts
    >> Add an issue reference: // TODO: Add retry logic #GH-XXX
```

**Closed-issue detection (inspired by todocheck):**

```
$ todo scan

  WARNING: 2 TODOs reference closed issues

  src/old-feature.ts:30
    TODO: Migrate users to new API #GH-189
    >> Issue #GH-189 was closed 14 days ago. Consider removing this TODO.
```

### Trend Reporting (for dashboards/CI)

```
$ todo stats --format json --trend

{
  "current": { "total": 47, "stale": 8 },
  "trend_30d": { "added": 14, "resolved": 11, "net": 3 },
  "trend_90d": { "added": 42, "resolved": 35, "net": 7 }
}
```

This enables teams to track technical debt over time without a complex dashboard.

---

## 7. Reference: CLI Tools That Do UX Well

| Tool | What to learn from it |
|------|----------------------|
| **gh** (GitHub CLI) | `noun verb` command structure, interactive prompts when args missing, `--json` flag on every command, `--web` to open in browser |
| **ripgrep** (rg) | Grouped-by-file output, smart case sensitivity, respects .gitignore, colored matches, blazing speed |
| **npm** | `init` wizard, lifecycle hooks, config resolution (project -> user -> global) |
| **fzf** | Interactive filtering, preview panes, composability with other tools via pipes |
| **bat** | Syntax highlighting, git-aware diff markers, graceful fallback when features unavailable |
| **leasot** | Multiple reporters (table, json, markdown), glob-based file selection, `--exit-nicely` for non-blocking CI |
| **todocheck** | Issue tracker validation, `.todocheck.yaml` config, enforcing TODO-issue linkage |

---

## 8. Key Recommendations Summary

1. **Zero-config first run.** `todo scan` should work immediately with no setup, scanning the current directory with sensible defaults. Configuration is additive, not required.

2. **Separate human and machine output.** Default to pretty-printed, color-coded table output. Offer `--format json` for scripting/CI. Auto-detect piped output and disable colors.

3. **Two distinct modes: interactive and CI.** `todo list` is for humans browsing. `todo check` is for CI with strict exit codes and policy enforcement.

4. **Progressive syntax recognition.** Accept bare `TODO:` comments but reward structured formats like `TODO(author): description #issue` with richer features (blame, filtering, issue validation).

5. **TOML for config.** Simple, well-specified, comment-friendly. One project-level file (`.todorc.toml`) with optional global defaults.

6. **Git-native.** Use git blame for attribution and age tracking. Use git diff for `--since` filtering. Respect `.gitignore` by default.

7. **Read-only integrations.** Check issue tracker status but never auto-create/close issues. The tool observes and reports; humans act.

8. **Pre-commit + CI as first-class citizens.** Dedicated `check` command with policy flags, designed for non-interactive environments from day one.
