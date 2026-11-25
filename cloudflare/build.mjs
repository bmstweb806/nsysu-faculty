import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { assetRecord } from './static-publisher.js';
const source = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('./admin.html', import.meta.url), 'utf8');
const embed = readFileSync(new URL('./embed.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('./guide.html', import.meta.url), 'utf8');
const read = name => readFileSync(new URL('./'+name,import.meta.url),'utf8');
const templates = {files:{'/index.html':admin,'/admin.html':admin,'/guide.html':guide,'/embed.js':embed,
  '/faculty.html':read('faculty.html'),'/faculty-router.js':read('faculty-router.js'),
  '/rpage-preview.html':read('rpage-preview.html'),'/rpage-preview.js':read('rpage-preview.js'),'/404.html':read('404.html')},
  ingress:read('pages-ingress.js')};
templates.hashes=Object.fromEntries(Object.entries(templates.files).map(([path,content])=>[path,assetRecord(path,content).key]));
const extraFiles=Object.fromEntries(Object.entries(templates.files).filter(([path])=>!['/index.html','/admin.html','/guide.html','/embed.js'].includes(path)));
const templatesCode='({files:{...'+JSON.stringify(extraFiles)+',"/admin.html":ADMIN_HTML,"/guide.html":GUIDE_HTML,"/embed.js":EMBED_JS},ingress:'+JSON.stringify(templates.ingress)+',hashes:'+JSON.stringify(templates.hashes)+'})';
const built = source.replace('"__ADMIN_HTML__"', JSON.stringify(admin)).replace('"__EMBED_JS__"', JSON.stringify(embed)).replace('"__GUIDE_HTML__"', JSON.stringify(guide)).replace('"__STATIC_TEMPLATES__"',templatesCode);
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
await build({stdin:{contents:built,resolveDir:fileURLToPath(new URL('./',import.meta.url)),sourcefile:'worker.js'},
  bundle:true,format:'esm',platform:'browser',target:'es2022',charset:'utf8',minify:true,outfile:fileURLToPath(new URL('./dist/worker.js',import.meta.url))});
writeFileSync(new URL('./dist/templates.json',import.meta.url),JSON.stringify(templates));
