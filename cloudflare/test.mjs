import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './dist/worker.js';

// Match the deployed Workers Web Crypto limit, which Node does not enforce.
const deriveBits = crypto.subtle.deriveBits.bind(crypto.subtle);
crypto.subtle.deriveBits = (algorithm, key, length) => {
  if (algorithm.name === 'PBKDF2' && algorithm.iterations > 100000)
    throw new Error('Workers PBKDF2 iteration limit exceeded');
  return deriveBits(algorithm, key, length);
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for (const name of ['0001_initial.sql','0002_seed_definitions.sql','0003_runtime.sql','0004_pending_grants.sql'])
  db.exec(readFileSync(new URL('./migrations/'+name, import.meta.url), 'utf8'));
db.exec("INSERT INTO public_config_snapshot(singleton,payload_json) VALUES(1,'{}')");
db.exec("INSERT INTO pending_account_grants(email,role,is_active) VALUES('admin@example.com','ADMIN',1)");
class D1Statement {
  constructor(sql, params=[]) { this.sql=sql; this.params=params }
  bind(...params){return new D1Statement(this.sql,params)}
  first(){return db.prepare(this.sql).get(...this.params)??null}
  all(){return {results:db.prepare(this.sql).all(...this.params)}}
  run(){return {meta:db.prepare(this.sql).run(...this.params)}}
}
const env={DB:{prepare:sql=>new D1Statement(sql),batch:async statements=>{
  db.exec('BEGIN');try{const result=statements.map(s=>s.run());db.exec('COMMIT');return result}
  catch(e){db.exec('ROLLBACK');throw e}
}},SETUP_TOKEN:'test-setup-token'};
const origin='https://staging.example';
let cookie='',csrf='';
async function call(path,method='GET',data,headers={}){
  const req=new Request(origin+path,{method,headers:{...(data?{'content-type':'application/json'}:{}),
    ...(method!=='GET'?{'origin':origin}:{}),...(cookie?{'cookie':cookie}:{}),
    ...(csrf?{'x-csrf-token':csrf}:{}),...headers},body:data?JSON.stringify(data):undefined});
  const res=await worker.fetch(req,env);
  return {status:res.status,data:res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text(),headers:res.headers}
}
test('setup, authentication, authorization, draft isolation, and publication',async()=>{
  assert.equal((await call('/api/bootstrap')).status,401);
  assert.equal((await call('/preview?teacher=TEST001')).status,401);
  assert.equal((await call('/api/setup/status')).data.setup_required,true);
  assert.equal((await call('/api/setup','POST',{username:'admin@example.com',password:'Short7!'},{'x-setup-token':env.SETUP_TOKEN})).status,400);
  assert.equal((await call('/api/setup','POST',{username:'admin@example.com',password:'Test123!'},{'x-setup-token':'wrong'})).status,403);
  assert.equal((await call('/api/setup','POST',{username:'admin@example.com',password:'Test123!'},{'x-setup-token':env.SETUP_TOKEN})).status,200);
  assert.equal((await call('/api/setup/status')).data.setup_required,false);
  assert.equal((await call('/api/setup','POST',{username:'other@example.com',password:'Test123!'},{'x-setup-token':env.SETUP_TOKEN})).status,409);
  assert.equal((await call('/api/login','POST',{username:'admin@example.com',password:'wrong'})).status,401);
  const login=await call('/api/login','POST',{username:'admin@example.com',password:'Test123!'});
  assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];csrf=login.data.csrf;
  assert.equal((await call('/api/config/publish','POST',{})).status,200);
  const cfg=(await call('/api/config')).data;
  cfg.tabs[0].zh='暫存學歷';
  assert.equal((await call('/api/config','PUT',cfg)).status,200);
  const revision=(await call('/api/config/revisions')).data[0].revision_id;
  assert.equal((await call('/api/config/revisions/'+revision+'/restore','POST',{})).status,200);
  assert.equal((await call('/api/config')).data.tabs[0].zh,'學歷');
  assert.equal((await call('/api/teachers','POST',{id:'TEST001'},{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await call('/api/teachers','POST',{id:'TEST001'})).status,201);
  let draft=(await call('/api/teachers/TEST001')).data;
  draft.teacher.name_zh='未公開草稿';
  draft.entries.push({section_key:'education',entry_type:'list_item',title_zh:'學歷',content_zh:'測試',title_en:'Education',content_en:'Test',visible_zh:true,visible_en:true,fields:{}});
  assert.equal((await call('/api/teachers/TEST001','PUT',draft)).status,200);
  const preview=await call('/preview?teacher=TEST001');
  assert.equal(preview.status,200);
  assert.match(preview.data,/未公開草稿/);
  assert.equal(preview.headers.get('cache-control'),'no-store');
  assert.equal((await call('/faculty?teacher=TEST001')).status,404);
  assert.equal((await call('/api/teachers/TEST001','PUT',draft)).status,409);
  db.exec("INSERT INTO pending_account_grants(email,role,teacher_id,is_active) VALUES('teacher@example.com','TEACHER','TEST001',1)");
  let index=await call('/data/faculty-index.json');
  assert.equal(index.data.teachers.length,0);
  assert.equal((await call('/data/teachers/TEST001.json')).status,404);
  assert.equal((await call('/api/teachers/TEST001/publish','POST',{})).status,200);
  assert.equal((await call('/faculty?teacher=TEST001')).status,200);
  index=await call('/data/faculty-index.json');
  assert.equal(index.data.teachers.length,1);
  assert.equal(index.data.teachers[0].name.zh,'未公開草稿');
  assert.equal((await call('/data/teachers/TEST001.json')).data.teacher.sections[0].entries[0].content.zh,'測試');
  assert.equal((await call('/api/teachers','POST',{id:'TEST002'})).status,201);
  assert.equal((await call('/api/users','POST',{username:'teacher@example.com',password:'teacher-test-password',role:'TEACHER',teacher_id:'TEST001'})).status,201);
  const adminCookie=cookie,adminCsrf=csrf;
  const teacher=await call('/api/login','POST',{username:'teacher@example.com',password:'teacher-test-password'});
  assert.equal(teacher.status,200);cookie=teacher.headers.get('set-cookie').split(';')[0];csrf=teacher.data.csrf;
  assert.equal((await call('/api/bootstrap')).status,403);
  assert.equal((await call('/api/teachers/TEST002')).status,403);
  assert.equal((await call('/api/reorder','POST',{ids:['TEST002','TEST001']})).status,403);
  const changed=await call('/api/password','POST',{current_password:'teacher-test-password',new_password:'teacher-new-password'});
  assert.equal(changed.status,200);
  assert.equal((await call('/api/bootstrap')).status,401);
  cookie=adminCookie;csrf=adminCsrf;
  const teacherId=(await call('/api/users')).data.find(u=>u.username==='teacher@example.com').user_id;
  assert.equal((await call('/api/users/'+teacherId+'/password','POST',{password:'Reset123!'})).status,200);
  const resetLogin=await call('/api/login','POST',{username:'teacher@example.com',password:'Reset123!'});
  assert.equal(resetLogin.status,200);
  assert.equal(resetLogin.data.must_change_password,true);
  assert.equal((await call('/api/logout','POST',{})).status,200);
  assert.equal((await call('/api/bootstrap')).status,401);
});
test('login limit blocks repeated failures',async()=>{
  for(let i=0;i<5;i++)assert.equal((await call('/api/login','POST',{username:'missing@example.com',password:'wrong'})).status,401);
  assert.equal((await call('/api/login','POST',{username:'missing@example.com',password:'wrong'})).status,429);
});
