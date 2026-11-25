// Input contains derived public snapshots only, never a database dump.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPublicFiles, deploymentForm, STATIC_HEADERS } from './static-publisher.js';
import { profilePage } from './profile-page.js';
const snapshotPath=process.argv[2],outputPath=process.argv[3];
if(!snapshotPath||!outputPath)throw Error('Usage: node prepare-static.mjs PUBLIC_SNAPSHOT OUTPUT [--shell-only]');
const includeData=!process.argv.includes('--shell-only');
const snapshot=JSON.parse(readFileSync(snapshotPath,'utf8'));
const templates=JSON.parse(readFileSync(new URL('./dist/templates.json',import.meta.url),'utf8'));
const files=await buildPublicFiles(snapshot,templates,profilePage,includeData);
const {records,manifest,routes}=deploymentForm(files,templates,includeData);
writeFileSync(outputPath,JSON.stringify({files,records,manifest,routes,headers:STATIC_HEADERS,
  ingress:templates.ingress.replace('"__STATIC_DATA__"',String(includeData))}),{mode:0o600});
console.log(JSON.stringify({assets:Object.keys(files).length,staticData:includeData}));
