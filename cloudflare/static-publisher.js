import { blake3 } from '@noble/hashes/blake3.js';
import { directoryPage } from './directory-page.js';

export const STATIC_ROUTES = { version:1, include:['/api/*','/preview','/health'], exclude:[] };
export const STATIC_HEADERS = `/*
  X-Faculty-Delivery: static
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
/data/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=60, must-revalidate
/teachers/*
  Cache-Control: public, max-age=60, must-revalidate
/embed.js
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300, must-revalidate
/admin
  Cache-Control: no-store
  X-Frame-Options: DENY
/
  Cache-Control: no-store
/guide
  Cache-Control: public, max-age=300, must-revalidate
`;
const locales = ['zh','en'];
const pair = (value, visible) => Object.fromEntries(locales.map(loc=>[loc,visible?.[loc]?String(value?.[loc]||''):'']));
export function sanitizePublicProfile(input, config) {
  const t = input.teacher;
  const visible = {zh:t.visible?.zh===true,en:t.visible?.en===true};
  const fields = new Set(config.fields.filter(f=>f.is_active&&f.show_public).map(f=>f.section_key+':'+f.key));
  const activeTabs = new Set(config.tabs.filter(t=>t.is_active).map(t=>t.key));
  const teacher = {id:t.id,category_key:t.category_key,email:t.email||'',profile_url:t.profile_url||'',photo_url:t.photo_url||'',
    publish_status:'PUBLISHED',visible};
  for (const key of ['name','title','unit','office','expertise']) teacher[key] = pair(t[key],visible);
  teacher.sections=(t.sections||[]).filter(s=>activeTabs.has(s.key)).map(s=>({
    key:s.key,entries:s.entries.filter(e=>locales.some(loc=>visible[loc]&&e.visible?.[loc])).map(e=>{
      const visibility=Object.fromEntries(locales.map(loc=>[loc,visible[loc]&&e.visible?.[loc]===true]));
      return {type:e.type==='text'?'text':'list_item',title:pair(e.title,visibility),content:pair(e.content,visibility),
        visible:visibility,url:e.url||'',card_width:e.card_width??null,card_height:e.card_height??null,
        fields:Object.fromEntries(Object.entries(e.fields||{}).filter(([key])=>fields.has(s.key+':'+key)).map(([key,value])=>[key,pair(value,visibility)]))};
    })
  }));
  return {schema_version:4,preview:false,teacher};
}
export function publicIndexFromProfiles(profiles, config) {
  return {schema_version:4,preview:false,categories:config.categories||[],teachers:profiles.map(p=>{
    const t=p.teacher,education=t.sections.find(s=>s.key==='education')?.entries||[];
    const degree=Object.fromEntries(locales.map(loc=>[loc,education.find(e=>e.visible?.[loc])?.content?.[loc]||'']));
    const { sections, ...summary } = t;
    return {...summary,highest_degree:degree};
  })};
}
export async function buildPublicFiles(snapshot, templates, renderProfile, includeData=true) {
  const files={...templates.files};
  if(files['/admin.html'])files['/index.html']=files['/admin.html'];
  if(includeData) {
    const config={schema_version:4,preview:false,categories:snapshot.config.categories||[],
      tabs:snapshot.config.tabs.filter(t=>t.is_active),fields:snapshot.config.fields.filter(f=>f.is_active&&f.show_public)};
    const profiles=snapshot.rows.map(row=>sanitizePublicProfile(JSON.parse(row.payload_json),config));
    files['/data/faculty-config.json']=JSON.stringify(config);
    const index=publicIndexFromProfiles(profiles,config);
    files['/data/faculty-index.json']=JSON.stringify(index);
    for(const loc of locales)files['/directory/'+loc+'.html']=directoryPage(index,loc);
    files['/index.html']=files['/directory/zh.html'];
    for(const profile of profiles) {
      const t=profile.teacher;
      if(!/^[A-Za-z0-9_-]{2,40}$/.test(t.id))throw Error('無效的公開教師 ID');
      files['/data/teachers/'+t.id+'.json']=JSON.stringify(profile);
      for(const loc of locales) if(t.visible[loc]) {
        const rendered=await renderProfile(t,config,loc);
        files['/teachers/'+t.id+'/'+loc+'.html']=rendered instanceof Response?await rendered.text():rendered;
      }
    }
    files['/release.json']=JSON.stringify({generation:snapshot.generation,release_id:snapshot.release_id});
  }
  return files;
}
export const contentType = path => path.endsWith('.json')?'application/json; charset=utf-8':
  path.endsWith('.js')?'application/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8';
export function assetRecord(path, content, knownHash) {
  const bytes=new TextEncoder().encode(content);
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const value=btoa(binary), extension=path.split('.').pop();
  const key=knownHash||Array.from(blake3(new TextEncoder().encode(value+extension)),x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
  return {key,value,metadata:{contentType:contentType(path)},base64:true};
}
export function deploymentForm(files, templates, includeData=true) {
  const manifest={},records=[];
  for(const [path,content] of Object.entries(files)){const record=assetRecord(path,content,templates.hashes?.[path]);manifest[path]=record.key;records.push(record)}
  const routes=includeData?STATIC_ROUTES:{version:1,include:[...STATIC_ROUTES.include,'/data/*','/faculty','/rpage-preview'],exclude:[]};
  const form=new FormData();form.append('manifest',JSON.stringify(manifest));form.append('branch','cloudflare-migration');
  form.append('_worker.js',new Blob([templates.ingress.replace('"__STATIC_DATA__"',String(includeData))],{type:'application/javascript+module'}),'_worker.js');
  form.append('_routes.json',new Blob([JSON.stringify(routes)],{type:'application/json'}),'_routes.json');
  form.append('_headers',new Blob([STATIC_HEADERS],{type:'text/plain'}),'_headers');
  return {form,records,manifest,routes};
}
async function cfApi(env,path,options={}) {
  const r=await fetch('https://api.cloudflare.com/client/v4'+path,{...options,
    headers:{Authorization:'Bearer '+env.PAGES_API_TOKEN,...options.headers}});
  const value=await r.json();
  if(!r.ok||!value.success)throw Error('Pages API '+r.status+'（'+(value.errors?.[0]?.code||'未知錯誤')+'）');
  return value.result;
}
export async function checkPagesDeployment(env,id) {
  return cfApi(env,'/accounts/'+env.CF_ACCOUNT_ID+'/pages/projects/'+env.PAGES_PROJECT+'/deployments/'+id);
}
export async function deployPages(env, files, templates, includeData=true, onCreated=async()=>{}) {
  const project='/accounts/'+env.CF_ACCOUNT_ID+'/pages/projects/'+env.PAGES_PROJECT;
  const {form,records}=deploymentForm(files,templates,includeData);
  const upload=await cfApi(env,project+'/upload-token');
  const r=await fetch('https://api.cloudflare.com/client/v4/pages/assets/upload',{method:'POST',
    headers:{Authorization:'Bearer '+upload.jwt,'Content-Type':'application/json'},body:JSON.stringify(records)});
  const uploaded=await r.json();if(!r.ok||!uploaded.success)throw Error('靜態檔案上傳失敗（HTTP '+r.status+'）');
  const deployment=await cfApi(env,project+'/deployments',{method:'POST',body:form});
  await onCreated(deployment);
  for(let i=0;i<15;i++){
    // A lost status response does not mean the submitted deployment failed.
    // Keep its ID and let the authenticated status endpoint reconcile it.
    let d;
    try { d=await cfApi(env,project+'/deployments/'+deployment.id); }
    catch { return {id:deployment.id,url:deployment.url,pending:true}; }
    const status=d.latest_stage?.status;
    if(status==='success')return {id:d.id,url:d.url};
    if(status==='failure'||status==='canceled')throw Error('Pages 部署失敗');
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  return {id:deployment.id,url:deployment.url,pending:true};
}
export function requiresPublication(request) {
  if(!['POST','DELETE'].includes(request.method))return false;
  return /^\/api\/teachers\/[A-Za-z0-9_-]{2,40}\/(publish|archive)$/.test(new URL(request.url).pathname)||
    ['/api/config/publish','/api/reorder','/api/publication/retry'].includes(new URL(request.url).pathname);
}
