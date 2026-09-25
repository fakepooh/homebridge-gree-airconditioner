<!-- shiptact:managed:start -->
# ShipTact
This repository is adopted by ShipTact. Use the installed `shiptact` CLI for implemented ShipTact operations.
Durable project configuration is under `.shiptact/`; do not treat runtime cache or state as canonical.
Meaningful development changes should activate or resume ShipTact; explanation-only and non-development interactions remain no-op.
Use the selected ShipTact route while preserving stricter project and external constraints; reuse adequate existing process.
When an active change selects a Git delivery route, use its ShipTact continuation and `shiptact deliver`; do not independently create or change candidate branches, push, open PRs, or merge with raw git/gh.
Ordinary Git inspection and implementation work remain available when they do not bypass that selected delivery boundary.
ShipTact may select existing skills, tools, and repository capabilities; existing repository process remains authoritative.
BMAD is optional and lazy; ChatGPT handoff is a manual package boundary and never executes or transports work.
Local active-change state is operational/cache state, not canonical truth.
<!-- shiptact:managed:end -->

## Development and review route

Before the first push for a change, choose and record one review route in the
ShipTact checkpoint or task output:

- **FULL / REVIEWED** for runtime behavior, protocol or state handling,
  HomeKit/Homebridge behavior, configuration or schema changes, CI/release
  changes, dependency/API changes, non-trivial bug fixes, uncertain behavior,
  or changes with P0/P1/P2 or HIGH/MEDIUM correctness findings.
- **FAST** only for low-risk edits such as typos, formatting, comments without
  behavior impact, or similarly mechanical documentation/metadata changes.

When uncertain, choose **FULL / REVIEWED**. Never downgrade a selected route
after pushing. This repository review choice adds a code-review gate to the
Git delivery route selected by ShipTact; it determines verification and review
depth, not branch naming. The current supported `.shiptact/policy.yaml` has no
review-depth setting, so this section is the authoritative repository rule.

If an open GitHub pull request already tracks the intended feature branch,
continue on that established branch unless the user explicitly requests a
migration to a ShipTact candidate branch. Do not create a parallel
`shiptact/<change-id>` branch solely to satisfy ShipTact naming conventions.
For a user-authorized continuation of an existing PR, make the corrective
commit on its tracked branch and push that branch to its configured remote.
Creating a separate candidate branch requires an explicit user request.

For **FULL / REVIEWED** changes on a branch with a GitHub pull request, use
this loop:

1. Implement locally and run the applicable local checks.
2. Push the existing PR branch through its authorized delivery path.
3. Wait for GitHub CI, then add a top-level `@codex review` comment.
4. Wait for that review to complete and inspect its summary, inline comments,
   and top-level Codex comments for the exact pushed PR head.
5. If findings require a change, fix them locally, verify, push again, and
   request and inspect a fresh `@codex review` for the new PR head.
6. Repeat until the latest PR head has successful required CI and a completed
   review with no unresolved correctness finding requiring a code change.

CI passing alone does not complete the FULL / REVIEWED route. Every push that
changes the PR head makes earlier review results stale for completion. Silence
does not establish that a review completed. Record a clean review or explicitly
record each finding and its disposition. GitHub Codex is the independent
reviewer; local Codex implements fixes. Do not use `@codex address that
feedback` by default. Use it only when the user explicitly requests it or this
repository's selected workflow explicitly allows it for a trivial isolated
change.

The **FAST** route may skip `@codex review`, but still requires the local checks
appropriate to the change. Do not select FAST just to save time on a functional
change.
