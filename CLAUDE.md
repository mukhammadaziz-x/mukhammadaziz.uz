# CLAUDE.md — mukhammadaziz.uz

Personal portfolio site. The site lives in `My-portfolio/`; Netlify builds it with `node scripts/build.js` (see `netlify.toml`).

## Git workflow

- **Never commit, push or pull.** The owner commits and pushes himself (2026-11-23). Only edit files and say which files changed.
  Read-only git commands are allowed for looking around: `status`, `diff`, `log`, `show`, `ls-remote`.
- **Two branches, so `git push` never needs a `git pull`** (set up 2026-11-23):
  - `main` is the live site. Netlify deploys it, and Studio commits `content.json` and uploads to it.
  - `code` is the owner's computer: the local branch is `code` and tracks `origin/code`. Nobody else writes to it.
  - `.github/workflows/merge-code.yml` runs `My-portfolio/scripts/merge-code.js` on every push to `code`. It merges `code` into `main`.
    `content.json` is merged as JSON with `assets/js/merge3.js`, the same merge Studio uses; when both sides changed one value, `code` wins.
    The merged site is built before the push. A conflict in any other file, or a failing build, pushes nothing and the Action fails.
- The local `content.json` and `assets/uploads/` lag behind Studio's edits on `main`. Before editing content, read the latest version from GitHub without touching git:
  `https://raw.githubusercontent.com/mukhammadaziz-x/mukhammadaziz.uz/main/My-portfolio/data/content.json`.
  Write the change on top of that version. The merge keeps everything either way.

## Content

- Pages, texts and links live in `My-portfolio/data/content.json`, and the owner edits it in Studio.
- A subpage of `/projects` created in Studio starts from a project template. Its card is added to the Projects gallery automatically.
- Uploads go to `My-portfolio/assets/uploads/`. A PDF gets a PNG preview, and a large video is compressed in the browser before upload.
- Run `node scripts/build.js` after a change to check that the site still builds. Its output in `dist/` is not committed.
