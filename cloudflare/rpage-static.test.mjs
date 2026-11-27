import test from 'node:test';
import assert from 'node:assert/strict';
import {renderRpageProfile,renderRpageList} from './rpage-static.js';
const config={tabs:[{key:'education',zh:'學歷',en:'Education',is_active:true},{key:'projects',zh:'計畫',en:'Projects',is_active:true}],fields:[{section_key:'education',key:'year',zh:'年份',is_active:true,show_public:true},{section_key:'education',key:'private',zh:'私密備註',is_active:true,show_public:false}]};
const data={preview:false,teacher:{id:'TEST001',publish_status:'PUBLISHED',visible:{zh:true,en:false},name:{zh:'測試教師 <script>alert(1)</script>',en:'HIDDEN ENGLISH'},photo_url:'javascript:alert(1)',sections:[{key:'education',entries:[{visible:{zh:true},title:{zh:'學歷'},content:{zh:'博士'},url:'javascript:alert(1)',fields:{year:{zh:'2020'},private:{zh:'SECRET NOTE'}}},{visible:{zh:false},content:{zh:'HIDDEN ENTRY'}}]},{key:'projects',entries:[{visible:{zh:true},title:{zh:'計畫'},content:{zh:'計畫內容'}}]}]}};
test('manual Rpage HTML contains real content and independent CSS radio panels without scripts',()=>{
 const html=renderRpageProfile(data,config,'zh');
 assert.ok(html.includes('博士'));assert.ok(html.includes('2020'));assert.ok(html.includes('&lt;script&gt;'));
 for(const forbidden of ['<script','<style','<iframe','<link','javascript:','SECRET NOTE','HIDDEN ENTRY','HIDDEN ENGLISH','fetch('])assert.ok(!html.includes(forbidden),forbidden);
 const inputs=[...html.matchAll(/<input[^>]+id="([^"]+)"[^>]*>/g)];assert.equal(inputs.length,2);
 assert.equal((html.match(/ checked/g)||[]).length,1);
 for(const input of inputs)assert.ok(html.includes('for="'+input[1]+'"'));
 const other=renderRpageProfile({...data,teacher:{...data.teacher,id:'TEST002'}},config,'zh');
 for(const input of inputs)assert.ok(!other.includes('id="'+input[1]+'"'));
});
test('manual exports refuse drafts and hidden languages, and lists omit invisible profiles',()=>{
 assert.throws(()=>renderRpageProfile({...data,preview:true},config,'zh'));
 assert.throws(()=>renderRpageProfile(data,config,'en'));
 const list=renderRpageList({preview:false,categories:[],teachers:[{...data.teacher,category_key:'full_time'},{...data.teacher,id:'HIDDEN_ID',name:{zh:'HIDDEN TEACHER'},visible:{zh:false}}]},'all','zh');
 assert.ok(list.includes('測試教師'));assert.ok(!list.includes('HIDDEN TEACHER'));assert.ok(!list.includes('<script'));
});
