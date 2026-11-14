/**
 * NSYSU BMST Faculty — simple Sheets-first V4.
 * Only teacher_id identifies a teacher. Content rows have no IDs or sort numbers.
 * Order is the physical Google Sheets row order.
 * Install with FacultyConfig.gs + two companion HTML templates.
 */
const FTV = Object.freeze({
  spreadsheetId: '1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88',
  teachers:'Teachers',tabs:'TabDefinitions',categories:'FacultyCategories',fields:'FieldDefinitions',
  teacherColumns:['teacher_id','teacher_sheet','name_zh','name_en','title_zh','title_en',
    'unit_zh','unit_en','office_zh','office_en','expertise_zh','expertise_en',
    'email','profile_url','photo_url','publish_status','visible_zh','visible_en','category_key'],
  entryColumns:['section_key','entry_type','title_zh','title_en','content_zh','content_en',
    'link_url','visible_zh','visible_en','field_values_json','card_width','card_height']
});
function ftvSS_(){return SpreadsheetApp.openById(FTV.spreadsheetId);}
function ftvBool_(x){return x===true||String(x).toUpperCase()==='TRUE';}
function ftvTxt_(v,max,label){
  const s=String(v==null?'':v).trim();
  if(s.length>(max||20000))throw new Error((label||'內容')+'超過字數限制');
  return s;
}
function ftvKey_(x){const s=ftvTxt_(x,80);if(!/^[a-z][a-z0-9_]*$/.test(s))throw new Error('代碼僅接受小寫英文、數字、底線');return s;}
function ftvId_(x){const s=ftvTxt_(x,40);if(!/^[A-Za-z0-9_-]{2,40}$/.test(s))throw new Error('教師 ID 需 2–40 碼英數、_ 或 -');return s;}
function ftvSheet_(name){const s=ftvSS_().getSheetByName(name);if(!s)throw new Error('找不到 Google Sheets 工作表：'+name);return s;}
function ftvTable_(name){
  const sheet=ftvSheet_(name);
  const lastCol=sheet.getLastColumn();
  if(!lastCol)throw new Error(name+' 尚無標題');
  const cols=sheet.getRange(1,1,1,lastCol).getDisplayValues()[0].map(x=>String(x).trim());
  const length=sheet.getLastRow();
  const rows=length>1?sheet.getRange(2,1,length-1,lastCol).getValues():[];
  return {sheet,cols,items:rows.map((row,i)=>({
    ...Object.fromEntries(cols.map((c,k)=>[c,row[k]])),
    _row:i+2
  })).filter(x=>String(x[cols[0]]||'').trim())};
}
function ftvCheckColumns_(table,needed){
  if(needed.some(x=>!table.cols.includes(x)))throw new Error(
    table.sheet.getName()+' 欄位不符合簡化版 V4，請先更新 Sheet。');
}
function ftvWriteRows_(table,items){
  const sh=table.sheet, rowCount=items.length, oldCount=sh.getLastRow()-1;
  if(sh.getMaxRows()<rowCount+1)sh.insertRowsAfter(sh.getMaxRows(),rowCount+1-sh.getMaxRows());
  const n=Math.max(rowCount,oldCount);
  if(n)sh.getRange(2,1,n,table.cols.length).clearContent();
  if(rowCount)sh.getRange(2,1,rowCount,table.cols.length)
    .setValues(items.map(item=>table.cols.map(k=>item[k]===undefined?'':item[k])));
}
function ftvLock_(cb){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{return cb();}finally{lock.releaseLock();}
}
function ftvRevision_(teacher,rows){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify({teacher,rows}),Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}
function ftvCategories_(){
  return ftvTable_(FTV.categories).items.map(r=>({
    key:String(r.category_key),zh:String(r.name_zh||''),en:String(r.name_en||''),
    is_active:ftvBool_(r.is_active)
  }));
}
function ftvDefinitions_(){
  return ftvTable_(FTV.tabs).items.map(r=>({
    key:String(r.section_key),zh:String(r.title_zh||''),en:String(r.title_en||''),
    is_active:ftvBool_(r.is_active),entry_layout:String(r.entry_layout||'list')
  }));
}
function ftvFields_(){
  return ftvTable_(FTV.fields).items.map(r=>({
    section_key:String(r.section_key),key:String(r.field_key),
    zh:String(r.label_zh||''),en:String(r.label_en||''),type:String(r.field_type||'text'),
    required:ftvBool_(r.is_required),is_active:ftvBool_(r.is_active),
    show_public:ftvBool_(r.show_public)
  }));
}
function ftvGetBootstrap(token){
  const account=ftaSession_(token);
  const teachers=ftvTable_(FTV.teachers);ftvCheckColumns_(teachers,FTV.teacherColumns);
  return {
    teachers:teachers.items.filter(t=>account.role==='ADMIN'||String(t.teacher_id)===account.teacher_id).map(t=>({id:String(t.teacher_id),name:String(t.name_zh||t.teacher_id),status:String(t.publish_status)})),
    tabs:ftvDefinitions_().filter(d=>d.is_active),
    categories:ftvCategories_().filter(d=>d.is_active),
    fields:ftvFields_().filter(d=>d.is_active),
    spreadsheetUrl:account.role==='ADMIN'?ftvSS_().getUrl():''
  };
}
function ftvFindTeacher_(id){
  const t=ftvTable_(FTV.teachers);ftvCheckColumns_(t,FTV.teacherColumns);
  const row=t.items.find(r=>String(r.teacher_id)===String(id));
  if(!row)throw new Error('找不到教師：'+id);
  if(!row.teacher_sheet)throw new Error('此教師缺少資料工作表');
  return {table:t,teacher:row};
}
function ftvGetTeacher(id,token){
  ftaRequire_(token,id);
  const found=ftvFindTeacher_(id);
  const entries=ftvTable_(String(found.teacher.teacher_sheet));
  ftvCheckColumns_(entries,FTV.entryColumns);
  return {teacher:found.teacher,entries:entries.items,
    revision:ftvRevision_(found.teacher,entries.items)};
}
function ftvCreateTeacher(requestedId,token){
  ftaAdmin_(token);
  return ftvLock_(()=>{
    const existing=ftvTable_(FTV.teachers);ftvCheckColumns_(existing,FTV.teacherColumns);
    const defaults=ftvCategories_().filter(c=>c.is_active);
    if(!defaults.length||!ftvDefinitions_().some(t=>t.is_active))throw new Error('請先在設定表建立分類和 Tab');
    const id=ftvId_(requestedId);
    if(existing.items.some(t=>String(t.teacher_id).toLowerCase()===id.toLowerCase()))
      throw new Error('教師 ID 已存在');
    const sheetName=id+'_教師資料';
    if(ftvSS_().getSheetByName(sheetName))throw new Error('已有同名工作表');
    const sh=ftvSS_().insertSheet(sheetName);
    sh.getRange(1,1,1,FTV.entryColumns.length).setValues([FTV.entryColumns]);
    sh.setFrozenRows(1);sh.getRange(1,1,1,FTV.entryColumns.length)
      .setBackground('#17618c').setFontColor('#ffffff').setFontWeight('bold');
    const newTeacher=Object.fromEntries(existing.cols.map(k=>[k,'']));
    Object.assign(newTeacher,{teacher_id:id,teacher_sheet:sheetName,name_zh:'新教師（請修改）',
      publish_status:'DRAFT',visible_zh:true,visible_en:false,category_key:defaults[0].key});
    existing.sheet.appendRow(existing.cols.map(k=>newTeacher[k]));
    return {id,sheet:sheetName};
  });
}
function ftvEntry_(raw,allowed){
  const section=ftvKey_(raw.section_key);
  if(!allowed.has(section))throw new Error('未知 Tab：'+section);
  const link=ftvTxt_(raw.link_url,1500,'網址');
  if(link&&!/^https?:\/\/\S+$/i.test(link))throw new Error('內容網址需要 http/https');
  let fields={};
  if(raw.field_values_json){
    try{fields=JSON.parse(String(raw.field_values_json));}catch(_){throw new Error('自訂欄位 JSON 格式錯誤');}
    if(!fields||typeof fields!=='object'||Array.isArray(fields))throw new Error('自訂欄位需為物件');
  }
  const width=Number(raw.card_width||0),height=Number(raw.card_height||0);
  const clamp=(v,min,max)=>Number.isFinite(v)&&v>0?Math.max(min,Math.min(max,Math.round(v))):'';
  return {section_key:section,entry_type:raw.entry_type==='text'?'text':'list_item',
    title_zh:ftvTxt_(raw.title_zh,400),title_en:ftvTxt_(raw.title_en,400),
    content_zh:ftvTxt_(raw.content_zh,20000),content_en:ftvTxt_(raw.content_en,20000),
    link_url:link,visible_zh:ftvBool_(raw.visible_zh),
    visible_en:ftvBool_(raw.visible_en),field_values_json:JSON.stringify(fields),
    card_width:clamp(width,180,800),card_height:clamp(height,100,1200)};
}
function ftvSaveTeacher(payload,token){
  if(!payload||!payload.teacher||!Array.isArray(payload.entries))throw new Error('資料格式錯誤');
  const original=ftvId_(payload.originalTeacherId||payload.teacher.teacher_id);
  const actor=ftaRequire_(token,original);
  return ftvLock_(()=>{
    const requested=ftvId_(payload.teacher.teacher_id);
    if(actor.role!=='ADMIN'&&requested!==original)throw new Error('教師不能自行更改教師 ID');
    const found=ftvFindTeacher_(original),record=found.teacher;
    const entries=ftvTable_(String(record.teacher_sheet));
    ftvCheckColumns_(entries,FTV.entryColumns);
    if(ftvRevision_(record,entries.items)!==payload.revision)
      throw new Error('資料已被其他人更改，請重新載入後再儲存');
    if(found.table.items.some(t=>String(t.teacher_id).toLowerCase()===requested.toLowerCase()&&t._row!==record._row))
      throw new Error('教師 ID 重複');
    const allowed=new Set(ftvDefinitions_().map(x=>x.key)),cat=ftvCategories_();
    const category=actor.role==='ADMIN'?String(payload.teacher.category_key||record.category_key||''):String(record.category_key||'');
    if(!cat.some(c=>c.key===category&&c.is_active))throw new Error('分類不存在或未啟用');
    const out={...record,teacher_id:requested,category_key:category};
    const free=['name_zh','name_en','title_zh','title_en','unit_zh','unit_en','office_zh',
      'office_en','expertise_zh','expertise_en','email','profile_url','photo_url'];
    free.forEach(k=>out[k]=ftvTxt_(payload.teacher[k],k.includes('expertise')?3000:1500,k));
    if(!out.name_zh)throw new Error('中文姓名不可留空');
    if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw new Error('Email 格式錯誤');
    for(const k of ['profile_url','photo_url'])if(out[k]&&!/^https?:\/\/\S+$/i.test(out[k]))throw new Error(k+' 網址格式錯誤');
    out.publish_status=actor.role==='ADMIN'?String(payload.teacher.publish_status||'DRAFT'):String(record.publish_status||'DRAFT');
    if(!['DRAFT','PUBLISHED'].includes(out.publish_status))throw new Error('發布狀態錯誤');
    out.visible_zh=actor.role==='ADMIN'?ftvBool_(payload.teacher.visible_zh):ftvBool_(record.visible_zh);
    out.visible_en=actor.role==='ADMIN'?ftvBool_(payload.teacher.visible_en):ftvBool_(record.visible_en);
    if(out.publish_status==='PUBLISHED'&&out.visible_en&&!out.name_en)throw new Error('公開英文版前需有英文姓名');
    if(payload.entries.length>1200)throw new Error('內容最多 1200 筆');
    const normalized=payload.entries.map(r=>ftvEntry_(r,allowed));
    // Array sequence is the only ordering authority; no entry IDs or sort numbers.
    ftvWriteRows_(entries,normalized);
    found.table.sheet.getRange(record._row,1,1,found.table.cols.length)
      .setValues([found.table.cols.map(k=>out[k]===undefined?'':out[k])]);
    // Preserve teacher account permissions when an admin renames a teacher ID.
    if(requested!==original&&actor.role==='ADMIN'){
      const permissions=ftvTable_(FTA.permissions);
      ftvCheckColumns_(permissions,['email','role','teacher_id','is_active']);
      const idColumn=permissions.cols.indexOf('teacher_id')+1;
      permissions.items.filter(x=>String(x.teacher_id)===original)
        .forEach(x=>permissions.sheet.getRange(x._row,idColumn).setValue(requested));
    }
    SpreadsheetApp.flush();
    return ftvGetTeacher(requested,token);
  });
}
function ftvSetup(){
  const existing=[FTV.teachers,FTV.tabs,FTV.categories,FTV.fields];
  if(existing.some(x=>!ftvSS_().getSheetByName(x)))
    throw new Error('請先建立必要的設定表：'+existing.join('、'));
  const tables=[[FTV.teachers,FTV.teacherColumns],
    [FTV.tabs,['section_key','title_zh','title_en','is_active','entry_layout']],
    [FTV.categories,['category_key','name_zh','name_en','is_active']],
    [FTV.fields,['section_key','field_key','label_zh','label_en','field_type','is_required','is_active','show_public']]];
  tables.forEach(([name,cols])=>ftvCheckColumns_(ftvTable_(name),cols));
  SpreadsheetApp.getUi().alert('簡化版 V4 工作表已驗證，無須重新初始化');
}
function ftvOpenManager(){
  SpreadsheetApp.getUi().showModalDialog(
    ftaSheetAdminHtml_('FacultyManager').setWidth(1180).setHeight(780),'教師資料管理');
}
function doGet(e){
  if(e&&e.parameter&&e.parameter.page==='config')return fcfgGetAdminHtml();
  return HtmlService.createHtmlOutputFromFile('FacultyManager').setTitle('NSYSU Faculty Manager');
}
function onOpen(){
  SpreadsheetApp.getUi().createMenu('教師資料管理')
    .addItem('開啟教師編輯器','ftvOpenManager')
    .addItem('分類／Tab／欄位設定','fcfgOpenConfig')
    .addItem('驗證工作表結構','ftvSetup')
    .addSeparator()
    .addItem('開啟網站發布管理（管理員身分驗證）','ftvOpenPublishManager')
    .addToUi();
}
/**
 * The spreadsheet menu cannot safely pass a browser OTP session token to GAS.
 * Open the ADMIN-only config UI instead; it verifies email OTP and calls
 * fcfgPublishProduction/Preview with the authenticated session token.
 */
function ftvOpenPublishManager(){
  return fcfgOpenConfig();
}
/**
 * Compatibility callbacks for stale Google Sheets menus.
 * Never bypass server-side OTP by calling fcfgPublish* with no token.
 */
function ftvPublishProduction(){
  return ftvOpenPublishManager();
}
function ftvPublishPreview(){
  return ftvOpenPublishManager();
}
