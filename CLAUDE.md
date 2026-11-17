# loccit web frontend – notes for Claude Code

## Git: never merge into `main`

`main` changes only through pull requests that the owner merges on GitHub.

- Work on a branch of your own, push it, and open a pull request against
  `main` (`gh pr create` if `gh` is installed and logged in; otherwise give
  the owner the link to open one).
- Never run `git merge`, `git rebase`, `git push` or `git commit` on `main`,
  not even locally, not after an approval, and not for small fixes.
- Do not delete branches; the owner decides after merging.

## Conventions

- Talk to the owner in German. Code, comments and commit messages are in
  English; texts shown in the UI are German.
- Install packages with npm in this repo only, nothing globally.
- Run `npm run lint`, `npm run format` and `npm run build` (includes the type
  check) before committing.
- The frontend talks to the backend only through its HTTP API
  (`src/api.ts`, schema at `/api/openapi.json`).
