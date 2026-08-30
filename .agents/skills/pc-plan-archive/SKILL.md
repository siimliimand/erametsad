---
name: pc-plan-archive
description: Archive a completed OpenSpec change and update documentation. Interactive mode finds the oldest unarchived change with an open PR, archives it on that PR branch, and merges the PR when CI checks pass; autonomous mode archives a named change in place on the current branch. Invoked by the /plan-archive command (interactive) and the plan-goal pipeline (autonomous).
license: MIT
---

# Plan Archive

## Input

The caller provides (all optional):
- A mode (see below). Default: `interactive`.
- In autonomous mode: the change id to archive (required in that mode; the caller knows which change it just implemented).

## Modes

- interactive (default): full flow below. Find the oldest unarchived change with an open PR, confirm with the user, archive it on that PR branch, update docs with approval, push to the same PR, and merge it when CI checks pass. No input required.
- autonomous: the caller names the change to archive. Skip the working-tree prep, the PR lookup, the confirmation prompt, and the PR push-and-merge step. Instead, archive in place on the current branch:
  1. Archive the change by its id. Prefer the `@openspec-archive-change` skill if it is available. If it is not available, run the CLI directly, and it must be non-interactive, because there is no user to answer prompts:

     ```bash
     openspec archive "<change-id>" -y
     ```

     `-y` skips the confirmation prompt (without it the command blocks forever in an unattended run). Add `--skip-specs` only for infra/tooling/doc-only changes that produced no spec deltas. If the command reports the change is already archived, treat that as success.
  2. Verify the archive actually moved. The change folder must no longer exist at `openspec/changes/<change-id>/`, and a dated copy must now exist under `openspec/changes/archive/` (the CLI renames it to `archive/YYYY-MM-DD-<change-id>/`):

     ```bash
     REPO_ROOT="$(git rev-parse --show-toplevel)"
     test ! -d "$REPO_ROOT/openspec/changes/<change-id>" \
       && ls -d "$REPO_ROOT/openspec/changes/archive/"*"<change-id>" >/dev/null 2>&1 \
       && echo ARCHIVED_OK || echo ARCHIVE_FAILED
     ```

      If this prints `ARCHIVE_FAILED`, run the archive once more and repeat the check. If it still fails, report it to the caller as a failure; do not pretend it succeeded.
  3. Compare the archived change's specs against `ARCHITECTURE.md` and `DESIGN.md`; apply any needed doc updates directly (no approval prompt).
  4. If the change was a bug fix or new functionality with important impact, check if `@pc-guardrails-project` exists and update it.
  5. Do not commit or push: the caller owns the git operations.
   6. The ARCHIVE stage is complete. Hand control back to the caller (the `/plan-goal` pipeline) so it continues with evidence and output. Do not stop or end the turn here; archiving is not the end of the run.

---

## Interactive flow

Steps

1. Prepare working tree

   ```bash
   REPO_ROOT="$(git rev-parse --show-toplevel)"
   DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
   [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
   ```

   1. If the tree has uncommitted changes: `git stash push -u -m "WIP before archive"` and tell the user their work is stashed (it is restored in step 7).
   2. Sync the default branch (skip the pull if there is no `origin` remote):

   ```bash
   git switch "$DEFAULT_BRANCH" && git pull origin "$DEFAULT_BRANCH"
   ```

<!-- PC-PLATFORM-ARCHIVE-START -->
2. **Find the oldest change with an open PR**

   List unarchived changes (top-level only, excludes `archive/`):

   ```bash
   find "$REPO_ROOT/openspec/changes" -mindepth 1 -maxdepth 1 -type d -not -name 'archive' | sort
   ```

   If empty, report a blocker and stop.

   List open PRs:

   ```bash
   gh pr list --repo {owner}/{repo} --state open --json title,headRefName,createdAt,number --jq 'sort_by(.createdAt) | .[] | {name: .title, sourceRefName: .headRefName, createdAt: .createdAt, pullRequestId: .number}'
   ```

   Match each change to an open PR using its ID and slug as search hints:
   - No match → skip (record as blocked: `no open PR found (run /ops-ship first)`).
   - One match → eligible.
   - Multiple matches → ask the user which PR belongs to that change.

   If a change has no open PR match, run the same `gh pr list` with `--state merged`. If a merged PR matches, record the block reason as `PR already merged; the archive cannot join a merged PR`.

   If nothing is eligible, report a blocker and stop. Otherwise select the eligible change with the **oldest** open PR `createdAt` as the candidate.

3. **Confirm the candidate**

   Show the candidate (ID, title, PR ID, branch) and any blocked changes, then ask:

   ```text
   Oldest unarchived change with an open PR found:
     ID: {change-id}
     Title: {title from resolved PR}
     PR ID: {pullRequestId}
     Branch: {headRefName}

   Archive on this PR, then merge when CI checks pass? [yes/no]
   ```

   Stop if the user does not confirm.

4. **Archive in place on the PR branch**

   ```bash
   git fetch origin "{headRefName}"
   git switch "{headRefName}" 2>/dev/null || git switch --track "origin/{headRefName}"
   git pull --ff-only origin "{headRefName}"
   ```

   If the `--ff-only` pull fails, the local branch and the PR branch diverged. Report this to the user and stop. Do not force or discard anything.

   Load `@openspec-archive-change` skill and follow it to archive the change.

5. **Update docs**

   Compare the archived change's specs against `ARCHITECTURE.md` and `DESIGN.md`. If updates are needed, show them and get user approval before applying.

6. **Push the archive to the open PR**

   The archive rides the existing feature PR. Never create a separate archive PR: one merge must produce one deploy.

   ```bash
   git add -A
   git commit -m "archive: {title} ({change-id})"
   git push origin HEAD:"{headRefName}"
   ```

7. **Merge when CI checks pass**

   Watch the checks until they finish:

   ```bash
   gh pr checks {pullRequestId} --repo {owner}/{repo} --watch --interval 30
   ```

   `gh pr checks` exits non-zero when a check fails.

   - Any check fails → do not merge. Show the PR link and the failed checks to the user.
   - No checks are reported → ask the user whether to merge without checks. Checks can be missing right after the push. When in doubt, wait and run the command again.
   - All checks pass → merge and delete the branch:

   ```bash
   gh pr merge {pullRequestId} --repo {owner}/{repo} --merge --delete-branch
   ```

   If the merge command fails, show the PR link and stop. Do not resolve merge conflicts on your own.

   If work was stashed in step 1, restore it after this step ends, unless the user opts out.

8. **Report**

   Display:

   ```text
   Archive complete

     Change ID: {change-id}
     Title: {title}
     PR: {pr-link}
     Merged: yes | no (reason: {failed checks | user declined | no checks})

     Documentation updates:
     - ARCHITECTURE.md: {count} changes applied
     - DESIGN.md: {count} changes applied
   ```

## Rules

- All OpenSpec paths resolve from `git rev-parse --show-toplevel`. Never use `/openspec/...`.
- Only process top-level directories in `$REPO_ROOT/openspec/changes/`; exclude `archive/`.
- Use change ID and slug only as search hints; do not assume the source branch name.
- The eligible change with the oldest open PR is the only candidate: never ask the user which change to archive (but do ask which PR if multiple match one change).
- Never archive a change whose PR is already merged. Report it as blocked.
- Never create a separate archive PR. The archive must ship inside the feature PR, so one merge produces one deploy.
- Never merge a PR with failing or pending checks.
- Never use browser tools or direct web requests for GitHub. Use `gh` CLI only.
- Never invent or guess PR, branch, or merge metadata.
<!-- PC-PLATFORM-ARCHIVE-END -->
