/**
 * 國立中山大學｜護理學系活動日程 → GitHub Pages JSON
 * 來源：目前這份 Google Sheet（綁定型 Apps Script）
 * 需求：指令碼屬性 GITHUB_TOKEN，Contents: Read and write，僅限指定 repository。
 */
const CONFIG = Object.freeze({
  sheetName: '活動日程',
  owner: 'bmstweb806',
  repository: 'nsysu-faculty',
  branch: 'main',
  path: 'data/events.json'
});
const FIELD = Object.freeze({
  date:'活動日期', time:'活動時間', audience:'對象', category:'類別',
  title:'活動項目', location:'地點', notes:'備註', url:'活動連結',
  published:'是否發布', sort:'顯示順序', id:'活動ID'
});

function onOpen() {
  SpreadsheetApp.getUi().createMenu('活動日程發布')
    .addItem('檢查資料', 'validateEvents')
    .addItem('發布正式 JSON', 'publishEvents')
    .addToUi();
}

function setupMenu() { onOpen(); }

function normalizeDate_(value, display) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(display || value || '').trim();
  const m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (!m) throw new Error('日期格式須為 YYYY-MM-DD：' + s);
  const y=+m[1], mo=+m[2], d=+m[3];
  const check=new Date(Date.UTC(y,mo-1,d));
  if (check.getUTCFullYear()!==y || check.getUTCMonth()!==mo-1 || check.getUTCDate()!==d) {
    throw new Error('無效日期：' + s);
  }
  return [m[1],String(mo).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
}
function getEventPayload_() {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sheet) throw new Error('找不到「活動日程」工作表');
  const range=sheet.getDataRange(), actual=range.getValues(), display=range.getDisplayValues();
  const headers=display[0].map(v=>String(v).trim());
  const required=Object.values(FIELD), missing=required.filter(x=>!headers.includes(x));
  if (missing.length) throw new Error('缺少欄位：'+missing.join('、'));
  const index=Object.fromEntries(headers.map((h,i)=>[h,i]));
  const errors=[], usedIds=new Set(), events=[];
  for (let r=1;r<display.length;r++) {
    const get=key=>String(display[r][index[FIELD[key]]]||'').trim();
    if (!display[r].some(v=>String(v).trim())) continue;
    const published=get('published').toLowerCase();
    if (!['是','yes','true','1'].includes(published)) continue;
    try {
      const id=get('id'), title=get('title'), date=normalizeDate_(actual[r][index[FIELD.date]],get('date'));
      if (!id || !title) throw new Error('活動ID、活動項目不可空白');
      if (usedIds.has(id)) throw new Error('活動ID 重複：'+id);
      usedIds.add(id);
      const url=get('url');
      if (url && !/^https:\/\//i.test(url)) throw new Error('活動連結須使用 https://');
      const order=Number(get('sort')||0);
      if (!Number.isFinite(order)) throw new Error('顯示順序必須是數字');
      events.push({id,date,time:get('time'),audience:get('audience'),category:get('category'),
        title,location:get('location'),notes:get('notes'),url,sort_order:order});
    } catch(e) { errors.push('第 '+(r+1)+' 列：'+e.message); }
  }
  if (errors.length) throw new Error('發布前請修正：\n'+errors.join('\n'));
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.sort_order-b.sort_order||a.id.localeCompare(b.id));
  return {schema_version:1,published_at:new Date().toISOString(),events};
}
function validateEvents() {
  try { const payload=getEventPayload_();SpreadsheetApp.getUi().alert('檢查完成：'+payload.events.length+' 筆資料可發布。'); }
  catch(e) { SpreadsheetApp.getUi().alert('資料檢查失敗\n'+e.message); throw e; }
}
function publishEvents() {
  const payload=getEventPayload_();
  const token=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('請先在 GAS「專案設定 → 指令碼屬性」設定 GITHUB_TOKEN');
  const api='https://api.github.com/repos/'+CONFIG.owner+'/'+CONFIG.repository+'/contents/'+CONFIG.path;
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const existing=UrlFetchApp.fetch(api+'?ref='+encodeURIComponent(CONFIG.branch),{headers,muteHttpExceptions:true});
  const status=existing.getResponseCode();
  if (status!==200 && status!==404) throw new Error('GitHub 讀取失敗（HTTP '+status+'）: '+existing.getContentText().slice(0,250));
  const sha=status===200?JSON.parse(existing.getContentText()).sha:null;
  const text=JSON.stringify(payload,null,2)+'\n';
  const encoded=Utilities.base64Encode(Utilities.newBlob(text,'application/json').getBytes());
  const body={message:'Publish nursing events from Google Sheets',content:encoded,branch:CONFIG.branch};
  if (sha) body.sha=sha;
  const response=UrlFetchApp.fetch(api,{method:'put',headers,contentType:'application/json',payload:JSON.stringify(body),muteHttpExceptions:true});
  if (![200,201].includes(response.getResponseCode())) {
    throw new Error('GitHub 發布失敗（HTTP '+response.getResponseCode()+'）：'+response.getContentText().slice(0,300));
  }
  SpreadsheetApp.getUi().alert('成功發布 '+payload.events.length+' 筆活動到 GitHub！\n'+
    'https://'+CONFIG.owner+'.github.io/'+CONFIG.repository+'/events.html');
}
