import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePublicProfile,buildPublicFiles,deploymentForm,requiresPublication } from './static-publisher.js';
const config={tabs:[{key:'education',is_active:true,zh:'學歷',en:'Education'}],
  fields:[{section_key:'education',key:'degree',is_active:true,show_public:true},{section_key:'education',key:'note',is_active:true,show_public:false}],categories:[]};
const input={teacher:{id:'TEST001',category_key:'full_time',name:{zh:'公開名字',en:'HIDDEN NAME'},visible:{zh:true,en:false},
  draft_secret:'DO NOT EXPORT',sections:[{key:'education',entries:[
    {type:'list_item',title:{zh:'學歷',en:'HIDDEN TITLE'},content:{zh:'博士',en:'HIDDEN CONTENT'},visible:{zh:true,en:true},fields:{degree:{zh:'博士',en:'HIDDEN DEGREE'},note:{zh:'PRIVATE NOTE'}}},
    {content:{zh:'PRIVATE ENTRY'},visible:{zh:false,en:false},fields:{}}
  ]},{key:'private-tab',entries:[{content:{zh:'PRIVATE TAB'},visible:{zh:true}}]}]}};
test('static snapshots allowlist locales, fields and entries and omit drafts',async()=>{
  const clean=sanitizePublicProfile(input,config);
  const text=JSON.stringify(clean);
  for(const hidden of ['HIDDEN','PRIVATE','DO NOT EXPORT'])assert.ok(!text.includes(hidden));
  assert.equal(clean.teacher.name.zh,'公開名字');
  const files=await buildPublicFiles({config,rows:[{payload_json:JSON.stringify(input)}],generation:2,release_id:'release2'},
    {files:{'/embed.js':'// public script'}},()=>new Response('public page'));
  assert.ok(files['/teachers/TEST001/zh.html']);
  assert.ok(!files['/teachers/TEST001/en.html']);
  assert.ok(!files['/data/teachers/PRIVATE_DRAFT.json']);
  assert.equal(JSON.parse(files['/release.json']).generation,2);
  assert.equal(JSON.parse(files['/data/faculty-index.json']).teachers[0].highest_degree.en,'');
});
test('only private and operational endpoints invoke Functions',()=>{
  const {routes,records}=deploymentForm({'/embed.js':'// static','/data/test.json':'{}'},
    {ingress:'const staticData="__STATIC_DATA__";'});
  assert.deepEqual(routes.include,['/api/*','/preview','/health']);
  assert.equal(records[0].metadata.contentType,'application/javascript; charset=utf-8');
  assert.equal(records[0].key.length,32);
  assert.ok(requiresPublication(new Request('https://site/api/teachers/TEST001/publish',{method:'POST'})));
  assert.ok(requiresPublication(new Request('https://site/api/reorder',{method:'POST'})));
  assert.ok(!requiresPublication(new Request('https://site/api/teachers/TEST001',{method:'PUT'})));
});
