/**
 * NSYSU Faculty V3 - Configurable admin extension
 * Install alongside the existing Code.gs in the V3 bound Apps Script project.
 * Adds configurable groups, tabs, fields and per-teacher academic entries.
 * Does not replace the existing doGet or onOpen; add menu items manually.
 */
const FCFG_SHEET_ID = '1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88';
const FCFG_REPO = 'bmstweb806/nsysu-faculty';

function fcfgDb_() { return SpreadsheetApp.openById(FCFG_SHEET_ID); }
function fcfgSheet_(name) {
  const sh = fcfgDb_().getSheetByName(name);
  if (!sh) throw new Error('找不到工作表: ' + name);
  return sh;
}
function fcfgBool_(x) { return x === true || String(x).toUpperCase() === 'TRUE'; }
function fcfgSafe_(x, max) {
  const s = String(x == null ? '' : x).trim();
  if (s.length > (max || 20000)) throw new Error('資料字數超過限制');
  return s;
}
function fcfgKey_(x) {
  const s = fcfgSafe_(x, 80);
  if (!/^[a-z][a-z0-9_]*$/.test(s)) throw new Error('代碼只能使用小寫英文、數字與底線，且須以英文開頭: ' + s);
  return s;
}
function fcfgRead_(name) {
  const sheet = fcfgSheet_(name);
  const values = sheet.getDataRange().getValues();
  const cols = (values[0] || []).map(x => String(x).trim());
  return { sheet: sheet, cols: cols, rows: values.slice(1).filter(r => String(r[0] || '').trim()) };
}
function fcfgObjects_(name) {
  const data = fcfgRead_(name);
  return data.rows.map(r => {
    const o = {};
    data.cols.forEach((k, i) => { if (k) o[k] = r[i]; });
    return o;
  });
}
function fcfgLocal_(zh, en) { return { zh: String(zh || ''), en: String(en || '') }; }
function fcfgConfigs_() {
  const categories = fcfgObjects_('FacultyCategories')
    .map(r => ({
      key: String(r.category_key), zh: String(r.name_zh || ''), en: String(r.name_en || ''),
      order: Number(r.display_order) || 0, is_active: fcfgBool_(r.is_active)
    })).sort((a,b) => a.order-b.order);
  const tabs = fcfgObjects_('TabDefinitions')
    .map(r => ({
      key: String(r.section_key), zh: String(r.title_zh || ''), en: String(r.title_en || ''),
      order: Number(r.display_order) || 0, locked: fcfgBool_(r.order_locked),
      is_active: r.is_active === '' || r.is_active == null ? true : fcfgBool_(r.is_active),
      entry_layout: String(r.entry_layout || 'list')
    })).sort((a,b) => a.order-b.order);
  const fields = fcfgObjects_('FieldDefinitions')
    .map(r => ({
      section_key: String(r.section_key), key: String(r.field_key),
      zh: String(r.label_zh || ''), en: String(r.label_en || ''),
      type: String(r.field_type || 'text'), order: Number(r.display_order) || 0,
      required: fcfgBool_(r.is_required), is_active: fcfgBool_(r.is_active),
      show_public: fcfgBool_(r.show_public)
    })).sort((a,b) => a.order-b.order);
  return { categories:categories, tabs:tabs, fields:fields };
}
function fcfgGetConfig() {
  const config = fcfgConfigs_();
  config.teachers = fcfgObjects_('Teachers').map(t => ({
    id:String(t.teacher_id), name:String(t.name_zh||t.name_en||t.teacher_id),
    category_key:String(t.category_key||''), sheet:String(t.teacher_sheet||'')
  }));
  return config;
}
function fcfgOpenConfig() {
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile('FacultyConfigManager').setWidth(1150).setHeight(750),
    'NSYSU Faculty V3｜分類、分頁與欄位設定'
  );
}
// For use from an independent admin Web App HTML; can call directly with google.script.run.
function fcfgGetAdminHtml() {
  return HtmlService.createHtmlOutputFromFile('FacultyConfigManager')
    .setTitle('NSYSU Faculty Configurator');
}
function fcfgUpsertConfig(kind, data) {
  const definitions = {
    category: { sheet:'FacultyCategories', keys:['category_key','name_zh','name_en','display_order','is_active'] },
    tab: { sheet:'TabDefinitions', keys:['section_key','title_zh','title_en','display_order','order_locked','is_active','entry_layout'] },
    field: { sheet:'FieldDefinitions', keys:['section_key','field_key','label_zh','label_en','field_type','display_order','is_required','is_active','show_public'] }
  };
  const def = definitions[String(kind)];
  if (!def || !data) throw new Error('設定種類錯誤');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const table = fcfgRead_(def.sheet);
    def.keys.forEach(k => { if (!table.cols.includes(k)) throw new Error(def.sheet + ' 缺少欄位 ' + k); });
    const category = String(kind) === 'category', tab = String(kind) === 'tab';
    const key = category ? fcfgKey_(data.key) : tab ? fcfgKey_(data.key) : fcfgKey_(data.section_key);
    const fieldKey = category || tab ? '' : fcfgKey_(data.key);
    if (!category && !tab && !fcfgConfigs_().tabs.some(t=>t.key===key)) throw new Error('找不到對應的 Tab: '+key);
    const zh = fcfgSafe_(data.zh,150), en = fcfgSafe_(data.en,150);
    if (!zh || !en) throw new Error('中英文名稱不可留空');
    const order = Number(data.order);
    if (!Number.isInteger(order) || order < 0 || order > 99999) throw new Error('排序必須是 0–99999');
    const type = String(data.type || 'text');
    if (!['text','textarea','url','number','date'].includes(type)) throw new Error('不支援的欄位類型');
    const values = category ? {
      category_key:key, name_zh:zh, name_en:en, display_order:order, is_active:data.is_active===true
    } : tab ? {
      section_key:key,title_zh:zh,title_en:en,display_order:order,order_locked:data.locked===true,
      is_active:data.is_active===true,entry_layout:'list'
    } : {
      section_key:key,field_key:fieldKey,label_zh:zh,label_en:en,field_type:type,
      display_order:order,is_required:data.required===true,is_active:data.is_active===true,
      show_public:data.show_public===true
    };
    const match = table.rows.findIndex(r => {
      const rec = Object.fromEntries(table.cols.map((x,i)=>[x,r[i]]));
      return category ? String(rec.category_key)===key :
        tab ? String(rec.section_key)===key :
        String(rec.section_key)===key && String(rec.field_key)===fieldKey;
    });
    const row = match < 0 ? table.sheet.getLastRow()+1 : match+2;
    const before = match < 0 ? Array(table.cols.length).fill('') : table.sheet.getRange(row,1,1,table.cols.length).getValues()[0];
    Object.entries(values).forEach(([k,v])=>{before[table.cols.indexOf(k)]=v;});
    table.sheet.getRange(row,1,1,before.length).setValues([before]);
    return fcfgGetConfig();
  } finally { lock.releaseLock(); }
}
function fcfgSetTeacherCategory(id, categoryKey) {
  id = fcfgSafe_(id,80); categoryKey = fcfgKey_(categoryKey);
  if (!fcfgConfigs_().categories.some(c=>c.key===categoryKey&&c.is_active)) throw new Error('分類不存在或未啟用');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const table=fcfgRead_('Teachers'), col=table.cols.indexOf('category_key');
    if(col<0) throw new Error('Teachers 缺少 category_key 欄位');
    const idx=table.rows.findIndex(r=>String(r[table.cols.indexOf('teacher_id')])===id);
    if(idx<0) throw new Error('找不到教師 '+id);
    table.sheet.getRange(idx+2,col+1).setValue(categoryKey);
    return {ok:true,id:id,category_key:categoryKey};
  } finally { lock.releaseLock(); }
}
function fcfgGetEntries(teacherId, sectionKey) {
  const teacher = fcfgObjects_('Teachers').find(t=>String(t.teacher_id)===String(teacherId));
  const config = fcfgConfigs_();
  if(!teacher) throw new Error('找不到教師');
  if(!config.tabs.some(t=>t.key===sectionKey)) throw new Error('找不到內容 Tab');
  const rows = fcfgObjects_(String(teacher.teacher_sheet));
  const defs = config.fields.filter(f=>f.section_key===sectionKey&&f.is_active);
  return {teacher:{id:String(teacher.teacher_id),name:String(teacher.name_zh)},section_key:sectionKey,
    fields:defs,entries:rows.filter(r=>String(r.section_key)===sectionKey).map(r=>{
      let values={}; try{values=JSON.parse(String(r.field_values_json||'{}'));}catch(_){}
      if(!values||typeof values!=='object'||Array.isArray(values))values={};
      return {
        id:String(r.entry_id),type:String(r.entry_type||'text'),
        title_zh:String(r.title_zh||''),title_en:String(r.title_en||''),
        content_zh:String(r.content_zh||''),content_en:String(r.content_en||''),
        link_url:String(r.link_url||''),visible_zh:fcfgBool_(r.visible_zh),
        visible_en:fcfgBool_(r.visible_en),field_values:values
      };
    })};
}
function fcfgSaveEntries(teacherId, sectionKey, list) {
  if(!Array.isArray(list)||list.length>1000)throw new Error('資料筆數不合法');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const teacher=fcfgObjects_('Teachers').find(t=>String(t.teacher_id)===String(teacherId));
    const cfg=fcfgConfigs_();
    if(!teacher||!cfg.tabs.some(t=>t.key===sectionKey))throw new Error('教師或 Tab 不存在');
    const active=cfg.fields.filter(f=>f.section_key===sectionKey&&f.is_active);
    const fieldKeys=new Set(active.map(f=>f.key));
    const table=fcfgRead_(String(teacher.teacher_sheet));
    const required=['entry_id','section_key','entry_type','title_zh','title_en','content_zh','content_en','link_url','sort_order','visible_zh','visible_en','field_values_json'];
    required.forEach(k=>{if(!table.cols.includes(k))throw new Error('教師工作表缺少欄位 '+k);});
    const seen=new Set();
    const fresh=list.map((input,i)=>{
      const eid=fcfgSafe_(input.id||('E-'+Utilities.getUuid()),100);
      if(seen.has(eid))throw new Error('項目 ID 重複');seen.add(eid);
      const vals={};
      const inputVals=input.field_values&&typeof input.field_values==='object'?input.field_values:{};
      for(const field of active){
        const source=inputVals[field.key]||{};
        const zh=fcfgSafe_(source.zh,20000),en=fcfgSafe_(source.en,20000);
        if(field.required && !(zh||en))throw new Error('必填欄位缺值：'+field.zh);
        vals[field.key]={zh:zh,en:en};
      }
      // Keep already stored unknown/inactive fields on edits, unless administrator deletes an entry.
      const prev=table.rows.find(r=>String(r[table.cols.indexOf('entry_id')])===eid);
      if(prev){
        let old={};try{old=JSON.parse(String(prev[table.cols.indexOf('field_values_json')]||'{}'));}catch(_){}
        Object.entries(old).forEach(([k,v])=>{if(!fieldKeys.has(k))vals[k]=v;});
      }
      const out={
        entry_id:eid,section_key:sectionKey,entry_type:input.type==='list_item'?'list_item':'text',
        title_zh:fcfgSafe_(input.title_zh,300),title_en:fcfgSafe_(input.title_en,300),
        content_zh:fcfgSafe_(input.content_zh,20000),content_en:fcfgSafe_(input.content_en,20000),
        link_url:fcfgSafe_(input.link_url,1600),sort_order:(i+1)*10,
        visible_zh:input.visible_zh===true,visible_en:input.visible_en===true,
        field_values_json:JSON.stringify(vals)
      };
      return out;
    });
    const others=table.rows.filter(r=>String(r[table.cols.indexOf('section_key')])!==sectionKey);
    const final=others.concat(fresh.map(o=>table.cols.map(k=>Object.prototype.hasOwnProperty.call(o,k)?o[k]:'')));
    const capacity=table.sheet.getMaxRows();
    if(final.length+1>capacity)table.sheet.insertRowsAfter(capacity,final.length+1-capacity);
    if(table.sheet.getLastRow()>1)table.sheet.getRange(2,1,table.sheet.getLastRow()-1,table.cols.length).clearContent();
    if(final.length)table.sheet.getRange(2,1,final.length,table.cols.length).setValues(final);
    SpreadsheetApp.flush();
    return fcfgGetEntries(teacherId,sectionKey);
  }finally{lock.releaseLock();}
}

function fcfgBuildJson_(preview) {
  const config=fcfgConfigs_(), teachers=fcfgObjects_('Teachers');
  const validCats=new Set(config.categories.filter(c=>c.is_active).map(c=>c.key));
  const validTabs=config.tabs.filter(t=>t.is_active);
  const result=[];
  for(const t of teachers){
    const status=String(t.publish_status||'DRAFT').trim().toUpperCase();
    if(!preview&&status!=='PUBLISHED')continue;
    if(!t.teacher_id||!t.teacher_sheet)continue;
    const name=fcfgLocal_(t.name_zh,t.name_en);
    const visibility={zh:fcfgBool_(t.visible_zh),en:fcfgBool_(t.visible_en)};
    const tEntries=fcfgObjects_(String(t.teacher_sheet));
    const sections=validTabs.map(tab=>{
      const entries=tEntries.filter(e=>String(e.section_key)===tab.key)
        .map(e=>{
          let fields={};try{fields=JSON.parse(String(e.field_values_json||'{}'));}catch(_){}
          if(!fields||typeof fields!=='object'||Array.isArray(fields))fields={};
          return {
            id:String(e.entry_id),type:String(e.entry_type||'text'),title:fcfgLocal_(e.title_zh,e.title_en),
            content:fcfgLocal_(e.content_zh,e.content_en),url:String(e.link_url||''),
            sort_order:Number(e.sort_order)||0,visible:{zh:fcfgBool_(e.visible_zh),en:fcfgBool_(e.visible_en)},
            fields:fields
          };
        }).sort((a,b)=>a.sort_order-b.sort_order);
      return {key:tab.key,entries:entries};
    });
    result.push({
      id:String(t.teacher_id),category_key:validCats.has(String(t.category_key))?String(t.category_key):'',
      name:name,title:fcfgLocal_(t.title_zh,t.title_en),
      unit:fcfgLocal_(t.unit_zh,t.unit_en),office:fcfgLocal_(t.office_zh,t.office_en),
      expertise:fcfgLocal_(t.expertise_zh,t.expertise_en),email:String(t.email||''),
      profile_url:String(t.profile_url||''),photo_url:String(t.photo_url||''),
      display_order:Number(t.display_order)||0,publish_status:status,visible:visibility,
      sections:sections
    });
  }
  return {
    schema_version:3,generated_at:new Date().toISOString(),preview:!!preview,
    tabs:validTabs,categories:config.categories,fields:config.fields,teachers:result
  };
}
function fcfgPublish_(preview) {
  const token=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if(!token)throw new Error('請先在 Apps Script 專案設定中新增 GITHUB_TOKEN');
  const path=preview?'data/faculty-preview.json':'data/faculty.json';
  const endpoint='https://api.github.com/repos/'+FCFG_REPO+'/contents/'+path;
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','User-Agent':'NSYSU-Faculty-V3'};
  const current=UrlFetchApp.fetch(endpoint+'?ref=main',{headers:headers,muteHttpExceptions:true});
  const sc=current.getResponseCode();
  if(sc!==200 && sc!==404)throw new Error('讀取 GitHub SHA 失敗：HTTP '+sc+' '+current.getContentText().slice(0,500));
  const sha=sc===200?JSON.parse(current.getContentText()).sha:undefined;
  const data=JSON.stringify(fcfgBuildJson_(preview),null,2)+'\n';
  const payload={
    message:preview?'Publish faculty V3 preview':'Publish faculty V3 production',
    content:Utilities.base64Encode(Utilities.newBlob(data,'application/json').getBytes()),
    branch:'main'
  };
  if(sha)payload.sha=sha;
  const response=UrlFetchApp.fetch(endpoint,{
    method:'put',headers:headers,contentType:'application/json',
    payload:JSON.stringify(payload),muteHttpExceptions:true
  });
  if(![200,201].includes(response.getResponseCode()))
    throw new Error('GitHub 發布失敗：HTTP '+response.getResponseCode()+' '+response.getContentText().slice(0,800));
  return {ok:true,path:path,teachers:JSON.parse(data).teachers.length,
    url:'https://github.com/'+FCFG_REPO+'/blob/main/'+path};
}
function fcfgPublishProduction(){return fcfgPublish_(false);}
function fcfgPublishPreview(){return fcfgPublish_(true);}
