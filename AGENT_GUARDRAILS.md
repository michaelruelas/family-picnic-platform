# Agent Safety Guardrails

This document provides safety guidelines for AI agents assisting with development on this project. These guardrails protect against unintended destructive changes.

---

## Operations Requiring Human Approval FIRST

**Before proceeding, ask the user to confirm these operations:**

### 🔴 High Risk (Always Ask)

| Operation                         | Why It's Dangerous                     | What to Do Instead                   |
| --------------------------------- | -------------------------------------- | ------------------------------------ |
| `git push --force`                | Can delete colleague's commits         | Never force push to shared branches  |
| `DROP TABLE` or `DELETE FROM`     | Permanently removes data               | Always use soft-delete or ask        |
| Modifying `prisma/schema.prisma`  | Can corrupt database structure         | Ask first, then run `db:generate`    |
| `npm run db:migrate`              | Can cause data loss in production      | Only run in development              |
| Deleting multiple files at once   | Files may not be recoverable           | Delete one at a time or confirm list |
| Installing new packages           | Can introduce security vulnerabilities | Check package reputation first       |
| Running scripts from the internet | Can contain malicious code             | Copy-paste and review first          |
| Modifying `.env` or secrets       | Can break authentication               | Never change secrets without asking  |
| `rm -rf` or `rm -r`               | Files gone forever                     | Use trash or confirm file list       |

### 🟡 Medium Risk (Ask for Risky Ones)

| Operation                       | Why It's Dangerous            | What to Do Instead         |
| ------------------------------- | ----------------------------- | -------------------------- |
| `git commit -am`                | Bypasses staging review       | Commit files individually  |
| Bulk file renaming              | Can break imports             | Rename one at a time       |
| Adding `console.log` statements | Leftover debug code           | Remove after debugging     |
| Modifying Kubernetes manifests  | Can cause deployment failures | Test in dev first          |
| Running full test suite         | Tests may fail unexpectedly   | Run specific tests instead |

---

## Always Safe Operations (No Approval Needed)

These are safe to do without asking first:

- Reading files and understanding code structure
- Running `npm run typecheck` or `npm run lint`
- Running `npm run format` (only formats, no destructive changes)
- Creating documentation files
- Reading test results
- Running `npm test` (read-only, doesn't modify files)
- Reading error messages and logs
- Exploring the codebase with glob/grep

---

## If Unsure, Ask First

**When in doubt, ask the user:**

> "This operation [description]. Should I proceed?"

It's always better to ask than to assume.

---

## Quick Reference: Safe Development Cycle

```
1. Make changes to files
2. Run npm run typecheck     ✓ No approval needed
3. Run npm run lint          ✓ No approval needed
4. Run npm test              ✓ No approval needed
5. Run npm run format        ✓ No approval needed
6. If all pass → Show user the changes → Ask before git commit
```

---

## How to Use This Document

1. Before any agent work session, review this document
2. If the agent suggests an operation in the "High Risk" table, insist on approval first
3. If an operation isn't listed, treat it as "ask first"
4. When in doubt, ask: "Should I proceed with [operation]?"

---

## Emergency Rollback

If something goes wrong:

1. **Stop the process** - Press Ctrl+C in the terminal
2. **Don't panic** - Most changes can be undone with git
3. **Rollback if needed** - `git checkout -- <file>` to discard changes
4. **Call for help** - The changes are rarely unrecoverable
