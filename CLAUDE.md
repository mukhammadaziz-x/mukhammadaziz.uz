# CLAUDE.md — mukhammadaziz.uz

Personal portfolio site. The site lives in `My-portfolio/`; Netlify builds it with `node scripts/build.js` (see `netlify.toml`).

## Git workflow

- **Never commit or push.** The owner commits and pushes himself (2026-11-23). Only edit files and say which files changed.
- **Do not `git pull` either.** No git command changes the repository or its history.
- Read-only git commands are allowed for looking around: `status`, `diff`, `log`, `show`.
- Studio commits `My-portfolio/data/content.json` and uploads straight to GitHub.
  A local `content.json` can therefore be behind. Studio's Publish runs a three-way merge, so nothing is lost when both sides change it.

## Content

- Pages, texts and links live in `My-portfolio/data/content.json`, and the owner edits it in Studio.
- A subpage of `/projects` created in Studio starts from a project template. Its card is added to the Projects gallery automatically.
- Uploads go to `My-portfolio/assets/uploads/`. A PDF gets a PNG preview, and a large video is compressed in the browser before upload.
- Run `node scripts/build.js` after a change to check that the site still builds. Its output in `dist/` is not committed.
