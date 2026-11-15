/**
 * NSYSU Faculty V4 configuration, editable tab/field definitions, JSON export.
 * Lists are always ordered by Google Sheets row order. Only teacher_id is a record ID.
 */
function fcfgGetConfig(token){
 ftaAdmin_(token);
 const base=ftvGetBootstrap(token);
 return {...base,categories:ftvCategories_(),tabs:ftvDefinitions_(),fields:ftvFields_(),
 teachers:ftvTable_(FTV.teachers).items.map(t=>({
   id:String(t.teacher_id),name:String(t.name_zh||t.teacher_id),
   category_key:String(t.category_key||''),sheet:String(t.teacher_sheet||'')
 }))};
}
function fcfgOpenConfig(){
 SpreadsheetApp.getUi().showModalDialog(
   ftaSheetAdminHtml_('FacultyConfigManager')
     .setWidth(1120).setHeight(760),'教師設定 / Faculty Configuration');
}
function fcfgGetAdminHtml(){
 return ftaSheetAdminHtml_('FacultyConfigManager')
   .setTitle('NSYSU Faculty Configuration');
}
function fcfgUpsertConfig(kind,data,token){
 ftaAdmin_(token);
 const config={
  category:{sheet:FTV.categories,key:['category_key'],labels:['category_key','name_zh','name_en','is_active']},
  tab:{sheet:FTV.tabs,key:['section_key'],labels:['section_key','title_zh','title_en','is_active','entry_layout']},
  field:{sheet:FTV.fields,key:['section_key','field_key'],
    labels:['section_key','field_key','label_zh','label_en','field_type','is_required','is_active','show_public']}
 }[String(kind)];
 if(!config||!data)throw new Error('設定類型無效');
 return ftvLock_(()=>{
  const table=ftvTable_(config.sheet);
  ftvCheckColumns_(table,config.labels);
  const key=kind==='field'?ftvKey_(data.section_key):ftvKey_(data.key);
  const fieldKey=kind==='field'?ftvKey_(data.key):'';
  const zh=ftvTxt_(data.zh,150),en=ftvTxt_(data.en,150);
  if(!zh||!en)throw new Error('中文及英文名稱都必須填寫');
  if(kind==='field'&&!ftvDefinitions_().some(t=>t.key===key))
   throw new Error('找不到所屬 Tab');
  const typ=String(data.type||'text');
  if(kind==='field'&&!['text','textarea','url','number','date'].includes(typ))
    throw new Error('欄位類型不支援');
  const record=kind==='category'?{
    category_key:key,name_zh:zh,name_en:en,is_active:data.is_active===true
  }:kind==='tab'?{
    section_key:key,title_zh:zh,title_en:en,
    is_active:data.is_active===true,entry_layout:'list'
  }:{
    section_key:key,field_key:fieldKey,label_zh:zh,label_en:en,
    field_type:typ,is_required:data.required===true,
    is_active:data.is_active===true,show_public:data.show_public===true
  };
  const i=table.items.findIndex(r=>kind==='category'?
    String(r.category_key)===key:kind==='tab'?
    String(r.section_key)===key:
    String(r.section_key)===key&&String(r.field_key)===fieldKey);
  if(i>=0){
   const row=table.items[i],merged={...row,...record};
   table.sheet.getRange(row._row,1,1,table.cols.length)
     .setValues([table.cols.map(c=>merged[c]===undefined?'':merged[c])]);
  }else{
   table.sheet.appendRow(table.cols.map(c=>record[c]===undefined?'':record[c]));
  }
  return fcfgGetConfig(token);
 });
}
/**
 * One-click sidebar Tab creation. The internal section_key is generated here;
 * editors never need to type or manage an ID for a category or content entry.
 * New tabs are appended at the bottom of TabDefinitions (sheet row order).
 */
function fcfgCreateTab(nameZh,nameEn,token){
 ftaAdmin_(token);
 return ftvLock_(()=>{
  const zh=ftvTxt_(nameZh,150,'中文分類名稱');
  const en=ftvTxt_(nameEn,150,'英文分類名稱')||zh;
  if(!zh)throw new Error('請填寫分類名稱');
  const table=ftvTable_(FTV.tabs);
  ftvCheckColumns_(table,['section_key','title_zh','title_en','is_active','entry_layout']);
  if(table.items.some(x=>String(x.title_zh).trim()===zh))
    throw new Error('已有同名分類，請在左側選擇既有分類');
  let key;
  do {
   key='section_'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toLowerCase();
  } while(table.items.some(x=>String(x.section_key)===key));
  const item={section_key:key,title_zh:zh,title_en:en,is_active:true,entry_layout:'list'};
  table.sheet.appendRow(table.cols.map(k=>item[k]===undefined?'':item[k]));
  return {key,zh,en,is_active:true,entry_layout:'list'};
 });
}
function fcfgSetTeacherCategory(id,categoryKey,token){
 ftaAdmin_(token);
 return ftvLock_(()=>{
  const active=ftvCategories_().some(c=>c.key===categoryKey&&c.is_active);
  if(!active)throw new Error('分類已停用或不存在');
  const {table,teacher}=ftvFindTeacher_(id);
  const col=table.cols.indexOf('category_key');
  if(col<0)throw new Error('教師缺少 category_key');
  table.sheet.getRange(teacher._row,col+1).setValue(categoryKey);
  return fcfgGetConfig(token);
 });
}
function fcfgLocale_(zh,en){return {zh:String(zh||''),en:String(en||'')};}

/** FIRST education entry only; never display a hidden language or graduation year. */
function fcfgHighestDegree_(sections){
 const edu=sections.find(s=>s.key==='education');
 const first=edu&&Array.isArray(edu.entries)?edu.entries[0]:null;
 const out={zh:'',en:''};
 if(!first)return out;
 ['zh','en'].forEach(lang=>{
  if(!first.visible||first.visible[lang]!==true)return;
  const content=String((first.content&&first.content[lang])||'').trim();
  if(content){out[lang]=content;return;}
  const fields=first.fields||{};
  const keys=lang==='zh'?['institution','department','degree']:['degree','department','institution'];
  out[lang]=keys.map(k=>String((fields[k]&&fields[k][lang])||'').trim()).filter(Boolean).join(lang==='zh'?'':' · ');
 });
 return out;
}

/**
 * Serialize one teacher, without scanning or touching other teacher sheets.
 * Shared with full publishing and teacher self-service publishing.
 */
function fcfgSerializeTeacher_(t,tabs){
 const status=String(t.publish_status||'DRAFT').toUpperCase();
 if(!t.teacher_id||!t.teacher_sheet)throw new Error('此教師缺少 ID 或資料工作表');
 const table=ftvTable_(String(t.teacher_sheet));
 ftvCheckColumns_(table,FTV.entryColumns);
 const sections=tabs.map(tab=>({
   key:tab.key,
   entries:table.items.filter(e=>String(e.section_key)===tab.key).map(e=>{
     let values={};
     try{values=JSON.parse(String(e.field_values_json||'{}'));}catch(_){}
     if(!values||typeof values!=='object'||Array.isArray(values))values={};
     const width=Number(e.card_width),height=Number(e.card_height);
     return {
       type:String(e.entry_type||'list_item'),
       title:fcfgLocale_(e.title_zh,e.title_en),
       content:fcfgLocale_(e.content_zh,e.content_en),
       url:String(e.link_url||''),
       visible:{zh:ftvBool_(e.visible_zh),en:ftvBool_(e.visible_en)},
       fields:values,
       card_width:Number.isFinite(width)&&width>0?width:null,
       card_height:Number.isFinite(height)&&height>0?height:null
     };
   })
 }));
 return {
   id:String(t.teacher_id),category_key:String(t.category_key||''),
   name:fcfgLocale_(t.name_zh,t.name_en),title:fcfgLocale_(t.title_zh,t.title_en),
   unit:fcfgLocale_(t.unit_zh,t.unit_en),
   office:fcfgLocale_(t.office_zh,t.office_en),
   expertise:fcfgLocale_(t.expertise_zh,t.expertise_en),
   highest_degree:fcfgHighestDegree_(sections),
   email:String(t.email||''),profile_url:String(t.profile_url||''),
   photo_url:String(t.photo_url||''),publish_status:status,
   visible:{zh:ftvBool_(t.visible_zh),en:ftvBool_(t.visible_en)},
   sections
 };
}
function fcfgBuildJson_(preview){
 const categories=ftvCategories_().filter(c=>c.is_active);
 const tabs=ftvDefinitions_().filter(d=>d.is_active);
 const fields=ftvFields_().filter(f=>f.is_active);
 const rows=ftvTable_(FTV.teachers);
 ftvCheckColumns_(rows,FTV.teacherColumns);
 const teachers=[];
 for(const t of rows.items){
   const status=String(t.publish_status||'DRAFT').toUpperCase();
   if(!preview&&status!=='PUBLISHED')continue;
   if(!t.teacher_id||!t.teacher_sheet)continue;
   teachers.push(fcfgSerializeTeacher_(t,tabs));
 }
 return {schema_version:3,generated_at:new Date().toISOString(),
         preview:!!preview,categories,tabs,fields,teachers};
}
/**
 * Publish the complete public dataset in ONE GitHub commit, to avoid a mixed
 * set of faculty-index / faculty-config / per-teacher files.
 * All code below runs server-side, after an ADMIN session check.
 */
function fcfgGit_(endpoint,headers,method,data){
 const options={method:method||'get',headers,muteHttpExceptions:true};
 if(data!==undefined){options.contentType='application/json';options.payload=JSON.stringify(data);}
 const response=UrlFetchApp.fetch(endpoint,options);
 const status=response.getResponseCode();
 if(status<200||status>=300){
  throw new Error('GitHub API '+status+'：'+response.getContentText().slice(0,400));
 }
 return JSON.parse(response.getContentText());
}
function fcfgPublish_(preview){
 const properties=PropertiesService.getScriptProperties();
 const token=properties.getProperty('GITHUB_TOKEN');
 if(!token)throw new Error('缺少 GITHUB_TOKEN：請先在 Apps Script 指令碼屬性中設定');
 const repo=properties.getProperty('GITHUB_REPO')||'bmstweb806/nsysu-faculty';
 if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo))throw new Error('GITHUB_REPO 格式錯誤');
 const base='https://api.github.com/repos/'+repo;
 const headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28','User-Agent':'NSYSU-Faculty-V6'};
 const full=fcfgBuildJson_(preview),root=preview?'data/preview/':'data/';
 const listFields=['id','category_key','name','title','unit','expertise','highest_degree','email',
                   'profile_url','photo_url','publish_status','visible'];
 const files=[];
 const file=(path,data)=>files.push({path,mode:'100644',type:'blob',
                                    content:JSON.stringify(data,null,2)+'\n'});
 const index={schema_version:4,preview:!!preview,categories:full.categories,
   teachers:full.teachers.map(t=>{
     const summary={};
     listFields.forEach(k=>{summary[k]=t[k];});
     return summary;
   })
 };
 const config={schema_version:4,preview:!!preview,tabs:full.tabs,fields:full.fields};
 file(root+'faculty-index.json',index);
 file(root+'faculty-config.json',config);
 const activePaths={};
 for(const teacher of full.teachers){
   const id=ftvId_(teacher.id);
   const path=root+'teachers/'+id+'.json';
   if(activePaths[path])throw new Error('教師 ID 重複：'+id);
   activePaths[path]=true;
   file(path,{schema_version:4,preview:!!preview,teacher});
 }
 // The Git Trees API updates all files atomically with a single branch commit.
 const oldRef=fcfgGit_(base+'/git/ref/heads/main',headers,'get');
 const parent=oldRef.object.sha;
 const parentCommit=fcfgGit_(base+'/git/commits/'+parent,headers,'get');
 const treeSha=parentCommit.tree.sha;
 const previous=fcfgGit_(base+'/git/trees/'+treeSha+'?recursive=1',headers,'get');
 if(previous.truncated)throw new Error('GitHub 樹狀清單不完整，發布已中止');
 const teacherPrefix=root+'teachers/';
 for(const entry of previous.tree||[]){
   if(entry.type==='blob'&&entry.path.indexOf(teacherPrefix)===0&&
      /\.json$/.test(entry.path)&&!activePaths[entry.path]){
     files.push({path:entry.path,mode:'100644',type:'blob',sha:null});
   }
 }
 const nextTree=fcfgGit_(base+'/git/trees',headers,'post',
                         {base_tree:treeSha,tree:files});
 const nextCommit=fcfgGit_(base+'/git/commits',headers,'post',{
   message:(preview?'Publish faculty preview V6':'Publish faculty production V6')+
           ' (split JSON; Sheet row order)',
   tree:nextTree.sha,parents:[parent]
 });
 // Non-force update: if somebody else changed main, retry after reconciling.
 fcfgGit_(base+'/git/refs/heads/main',headers,'patch',{sha:nextCommit.sha,force:false});
 const path=root+'faculty-index.json';
 return {ok:true,path,teachers:full.teachers.length,
         files:files.length,url:'https://github.com/'+repo+'/blob/main/'+path};
}
function fcfgPublishProduction(token){ftaAdmin_(token);return fcfgPublish_(false);}
function fcfgPublishPreview(token){ftaAdmin_(token);return fcfgPublish_(true);}

/**
 * Allow TEACHER to publish only their existing approved public profile;
 * ADMIN may publish any approved teacher. Other teachers/config are untouched.
 * Writes two JSON files in one Git commit: profile + index summary.
 */
function fcfgPublishOwnTeacher(teacherId,token){
 const id=ftvId_(teacherId);
 ftaRequire_(token,id);
 return ftvLock_(()=>{
   ftaRequire_(token,id);
   const record=ftvFindTeacher_(id).teacher;
   if(String(record.publish_status||'DRAFT').toUpperCase()!=='PUBLISHED')
     throw new Error('此教師仍是草稿，請系辦先核准公開並正式發布一次');
   const tabs=ftvDefinitions_().filter(t=>t.is_active);
   const teacher=fcfgSerializeTeacher_(record,tabs);
   const props=PropertiesService.getScriptProperties();
   const githubToken=props.getProperty('GITHUB_TOKEN');
   if(!githubToken)throw new Error('系統缺少 GITHUB_TOKEN，請聯絡系辦');
   const repo=props.getProperty('GITHUB_REPO')||'bmstweb806/nsysu-faculty';
   if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo))
     throw new Error('GITHUB_REPO 格式錯誤');
   const base='https://api.github.com/repos/'+repo;
   const headers={'Authorization':'Bearer '+githubToken,
     'Accept':'application/vnd.github+json',
     'X-GitHub-Api-Version':'2022-11-28','User-Agent':'NSYSU-Faculty-V7'};
   const head=fcfgGit_(base+'/git/ref/heads/main',headers,'get');
   const parent=head.object.sha;
   const parentCommit=fcfgGit_(base+'/git/commits/'+parent,headers,'get');
   const treeSha=parentCommit.tree.sha;
   const blob=fcfgGit_(
     base+'/contents/data/faculty-index.json?ref='+encodeURIComponent(parent),headers,'get');
   if(blob.encoding!=='base64'||!blob.content)
     throw new Error('網站索引資料無法讀取，請聯絡系辦');
   const index=JSON.parse(Utilities.newBlob(
     Utilities.base64Decode(String(blob.content).replace(/\s/g,'')))
     .getDataAsString('UTF-8'));
   if(index.schema_version!==4||index.preview!==false||!Array.isArray(index.teachers))
     throw new Error('網站索引版本不符，請系辦先執行一次全站正式發布');
   const position=index.teachers.findIndex(t=>String(t.id)===id);
   if(position<0)
     throw new Error('此教師尚未列入公開名單，請系辦先執行一次正式發布');
   const old=index.teachers[position];
   if(old.publish_status!=='PUBLISHED'||!old.visible||
      !(old.visible.zh===true||old.visible.en===true))
     throw new Error('此教師目前未開放公開，請聯絡系辦');
   // Publication status, visibility, category and list order remain ADMIN-owned.
   if(String(old.category_key)!==teacher.category_key||
      old.visible.zh!==teacher.visible.zh||old.visible.en!==teacher.visible.en)
     throw new Error('教師分類或公開設定有異動，請系辦先發布全站設定');
   const fields=['name','title','unit','expertise','highest_degree','email','profile_url','photo_url'];
   const summary={...old};
   fields.forEach(k=>{summary[k]=teacher[k];});
   index.teachers[position]=summary;
   // Do not include individual entries hidden in BOTH languages.
   const publicTeacher={...teacher,sections:teacher.sections.map(section=>({
     key:section.key,
     entries:section.entries.filter(e=>e.visible&&(e.visible.zh===true||e.visible.en===true))
   }))};
   const teacherPath='data/teachers/'+id+'.json';
   const entries=[
     {path:'data/faculty-index.json',mode:'100644',type:'blob',
      content:JSON.stringify(index,null,2)+'\n'},
     {path:teacherPath,mode:'100644',type:'blob',
      content:JSON.stringify({schema_version:4,preview:false,teacher:publicTeacher},null,2)+'\n'}
   ];
   const tree=fcfgGit_(base+'/git/trees',headers,'post',
                       {base_tree:treeSha,tree:entries});
   const commit=fcfgGit_(base+'/git/commits',headers,'post',{
     message:'Publish faculty profile '+id+' (self-service)',
     tree:tree.sha,parents:[parent]
   });
   // Never force a concurrent update; request should be retried.
   fcfgGit_(base+'/git/refs/heads/main',headers,'patch',
            {sha:commit.sha,force:false});
   return {ok:true,id,path:teacherPath,
     url:'https://github.com/'+repo+'/blob/main/'+teacherPath};
 });
}
