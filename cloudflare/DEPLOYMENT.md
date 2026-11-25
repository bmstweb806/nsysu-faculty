# NSYSU Faculty staging migration

This directory implements the Cloudflare staging service. The existing GitHub Pages and Rpage production pages remain unchanged.

## Architecture

- `0001_initial.sql` and `0002_seed_definitions.sql` are the original D1 schema and definitions.
- `0003_runtime.sql` adds CSRF session state, login throttling, edit compare tokens, and recoverable teacher/config revisions. `0004_pending_grants.sql` preserves imported permissions until passwords are set.
- `worker.js` contains the API. `admin.html` is the square blue teacher management interface. `embed.js` reads only published data from the public endpoints.
- `build.mjs` embeds the two static files into a single Worker module under `dist/`. Do not commit `dist/`; rebuild it for each deployment.
- The staging Worker binds only `nsysu-faculty-staging` (D1 ID `1c187979-3e84-44ba-93b9-741eba9aba1c`).

## First administrator

No password is stored in source or prefilled in D1. An operator with Cloudflare account access creates a random `SETUP_TOKEN` Worker secret. At `/admin`, open **首次建立管理員**, enter that token and an administrator email, and choose a password of at least 8 characters. The setup endpoint refuses further use after the first user exists. Delete or rotate the `SETUP_TOKEN` secret after enrollment.

Teacher accounts are created by an administrator and must change their temporary password on first login. Their authorization comes from `user_roles` and `user_teachers`; a teacher can access only assigned records. Password hashes use PBKDF2-SHA256 with 100,000 iterations and random 16-byte salts. Sessions store SHA-256 token hashes, expire after eight hours, and use HttpOnly, Secure, SameSite=Strict cookies. Mutations require a same-origin CSRF token. Login is blocked for 15 minutes after five failures from the same IP and username.

## Data migration

The private Sheets source was reconciled against the public v4 JSON on 2026-11-25. Private drafts were imported only into canonical D1 tables, with no public snapshot. Sheet permission records were imported into `pending_account_grants` without credentials. No old OTP tokens or passwords were imported. Public snapshots were seeded from the existing v4 JSON; canonical records use separate teacher, translation, entry, and field-value tables. The private row-level reconciliation report is not stored in this repository.

The import is idempotent through stable teacher IDs and entry IDs. Before rerunning an import, compare row versions and preserve post-migration edits. Do not export private Sheets or D1 dumps to the public repository.

## Operations and recovery

Use the Cloudflare D1 Time Travel bookmark before schema changes and data imports. Record the bookmark and an encrypted SQL export outside GitHub. The D1 export endpoint is `POST /accounts/{account_id}/d1/database/{database_id}/export` with `{"output_format":"polling"}`; poll with the returned bookmark and store the SQL dump in restricted storage. Test a restore on a separate D1 database before restoring staging. Restoring a D1 database changes all records; use teacher revision history in the admin panel for a single-teacher correction.

Run new migrations once in numbered order and record them in `schema_migrations`. Check `PRAGMA foreign_key_check` and teacher/public snapshot counts after each migration. A teacher save increments `row_version` and keeps the previous normalized draft in `teacher_revisions`; an administrator can restore a revision as a new draft and publish it separately. The audit log records actions without passwords or content.

## Checks

```sh
node cloudflare/build.mjs
node --test cloudflare/test.mjs
```

The local tests cover administrator enrollment, login, rate limiting, CSRF, role isolation, optimistic conflict, draft isolation, publication, password change, and logout. Before accepting staging, also verify the public URL, both languages, the three category embeds, drag sorting, setting publication, password reset, and a browser login with an operator-selected password. Do not switch the production Rpage embed until those checks pass.

## Admin interface and help

The admin UI groups editing into teacher selection, section tabs, and a persistent save/publish action bar. Website definitions use separate category/tab/field panels. The account screen lists pending grants with a direct password setup action and existing accounts with reset controls. Account dialogs prefill the email, role, and assigned teacher for imported grants, require password confirmation, and never display stored passwords. Administrator resets revoke existing sessions and require a password change at next login.

The single-page operating guide is served at `/guide`, linked from the login screen, header, and sidebar. It describes teacher password enrollment, draft/publish behavior, ordering, settings, embeds, and recovery, and includes print styles.

## Teacher page preview

The teacher editor provides Preview Draft (saves current edits before opening) and View Published Page links. `/preview?teacher=ID&lang=zh|en` requires an authenticated assigned teacher or administrator and reads the saved draft with no-store headers. `/faculty?teacher=ID&lang=zh|en` reads only the published snapshot and returns 404 for unpublished profiles or hidden languages. The preview has a draft banner and language controls; the published view offers only published languages.

## Per-teacher Rpage HTML

The Rpage panel generates a complete div and external script block for each teacher and language, and supports category lists in a separate tab. The teacher editor links directly to the selected teacher. `/rpage-preview` renders the generated div with the actual embed script and only the published data API. Both the complete block and div-only variant are available. The external renderer safely appends profile links and renders configured public field values.
