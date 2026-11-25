import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const source = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('./admin.html', import.meta.url), 'utf8');
const embed = readFileSync(new URL('./embed.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('./guide.html', import.meta.url), 'utf8');
const built = source.replace('"__ADMIN_HTML__"', JSON.stringify(admin)).replace('"__EMBED_JS__"', JSON.stringify(embed)).replace('"__GUIDE_HTML__"', JSON.stringify(guide));
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/worker.js', import.meta.url), built);
