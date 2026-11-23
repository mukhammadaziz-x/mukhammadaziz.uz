# CLAUDE.md — mukhammadaziz.uz

Personal portfolio site. The site lives in `My-portfolio/`; Netlify builds it with `node scripts/build.js` (see `netlify.toml`).

## Git workflow

- **Commit and push the changes yourself when the work is done.** The owner does not want to run git commands.
- **Do not `git pull` before every change.** Just commit and `git push`.
- **Only when the push is rejected** (`fetch first` / non-fast-forward): `git pull --rebase`, then push again.
  This happens because the admin panel (Studio) commits `My-portfolio/data/content.json` and uploads straight to GitHub.
- **On a `content.json` conflict, never drop the owner's Studio edits.** Keep the remote version and re-apply your own change on top of it.
- Commit messages say what changed (not "updated").

## Content

- Pages, texts and links live in `My-portfolio/data/content.json`, and the owner edits it in Studio.
- A subpage of `/projects` created in Studio starts from a project template. Its card is added to the Projects gallery automatically.
- Uploads go to `My-portfolio/assets/uploads/`. A PDF gets a PNG preview, and a large video is compressed in the browser before upload.
- Run `node scripts/build.js` after a change to check that the site still builds. Its output in `dist/` is not committed.
