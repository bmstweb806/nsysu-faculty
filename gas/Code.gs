/**
 * NSYSU Faculty V3 — bilingual, teacher-owned sheet tabs.
 * V3 master GAS code for the existing BMST Google Sheets database.
 * Install alongside FacultyConfig.gs and its two companion HTML files.
 * No legacy Sections/Entries tables and no backward-compatibility layer.
 * Script Properties: GITHUB_TOKEN; optional GITHUB_REPO (default below).
 */
const FTV = Object.freeze({
  teachersSheet: 'Teachers',
  definitionsSheet: 'TabDefinitions',
  repo: 'bmstweb806/nsysu-faculty',
  teacherHeaders: [
    'teacher_id', 'teacher_sheet', 'name_zh', 'name_en',
    'title_zh', 'title_en', 'unit_zh', 'unit_en',
    'office_zh', 'office_en', 'expertise_zh', 'expertise_en',
    'email', 'profile_url', 'photo_url', 'display_order',
    'publish_status', 'visible_zh', 'visible_en', 'category_key'
  ],
  entryHeaders: [
    'entry_id', 'section_key', 'entry_type', 'title_zh', 'title_en',
    'content_zh', 'content_en', 'link_url', 'sort_order',
    'visible_zh', 'visible_en', 'field_values_json'
  ],
  definitionHeaders: [
    'section_key', 'title_zh', 'title_en', 'display_order', 'order_locked',
    'is_active', 'entry_layout'
  ],
  definitions: [
    ['education',  '學歷',                 'Education',                      10, true],
    ['experience', '經歷',                 'Experience',                     20, true],
    ['courses',    '授課課程',             'Courses Taught',                 30, true],
    ['projects',   '研究計畫',             'Research Projects',              40, true],
    ['journal',    '學術著作－期刊',       'Journal Publications',           50, true],
    ['conference', '學術著作－研討會',     'Conference Publications',        60, true],
    ['honors',     '榮譽與獎項',           'Honors and Awards',              70, true],
    ['service',    '學術服務',             'Academic Service',               80, true]
  ]
});

function onOpen() {
  SpreadsheetApp.getUi().createMenu('教師資料管理 V3')
    .addItem('開啟中英文分頁編輯器', 'ftvOpenManager')
    .addItem('教師分類／Tab／欄位設定', 'fcfgOpenConfig')
    .addSeparator()
    .addItem('初始化全新 V3 結構', 'ftvSetup')
    .addItem('發布預覽 JSON（公開測試資料）', 'ftvPublishPreview')
    .addItem('發布正式 JSON', 'ftvPublishProduction')
    .addToUi();
}

// V3 新資料庫：同時支援試算表選單與獨立 Web App。
const FTV_SPREADSHEET_ID = '1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88';

function ftvSS_() {
  return SpreadsheetApp.openById(FTV_SPREADSHEET_ID);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'config') return fcfgGetAdminHtml();
  ftvDefinitions_();
  return HtmlService.createHtmlOutputFromFile('FacultyManager')
    .setTitle('NSYSU 教師資料管理 V3｜中英文');
}

function ftvSheet_(name) {
  const sh = ftvSS_().getSheetByName(name);
  if (!sh) throw new Error('找不到工作表：' + name + '，請先初始化 V3。');
  return sh;
}

function ftvCheckHeaders_(sheet, expected) {
  if (sheet.getLastRow() < 1) throw new Error('工作表沒有標題列：' + sheet.getName());
  const got = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  if (expected.some((h, i) => got[i] !== h)) {
    throw new Error('工作表 ' + sheet.getName() + ' 並非 V3 格式。請使用全新空白試算表，不要覆蓋舊版資料。');
  }
}

function ftvReadTable_(name, headers) {
  const sh = ftvSheet_(name);
  ftvCheckHeaders_(sh, headers);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, headers.length).getValues();
  return {
    sheet: sh,
    data: rows.map((values, i) => {
      const o = {_row: i + 2};
      headers.forEach((h, j) => o[h] = values[j]);
      return o;
    }).filter(r => String(r[headers[0]] || '').trim() !== '')
  };
}

function ftvCreateTable_(name, headers, rows, color) {
  const ss = ftvSS_();
  const sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.setFrozenRows(1);
  sh.setTabColor(color || '#17618c');
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#17618c');
  sh.setColumnWidths(1, headers.length, 140);
  if (name !== FTV.definitionsSheet) {
    const col = headers.indexOf('content_zh');
    if (col >= 0) sh.setColumnWidth(col + 1, 350);
    const colEn = headers.indexOf('content_en');
    if (colEn >= 0) sh.setColumnWidth(colEn + 1, 350);
  }
  return sh;
}

/** Only initialize a new sheet; deliberately refuses an old schema. */
function ftvSetup() {
  const ss = ftvSS_();
  const existingT = ss.getSheetByName(FTV.teachersSheet);
  const existingD = ss.getSheetByName(FTV.definitionsSheet);
  if (existingT || existingD) {
    if (!existingT || !existingD) {
      throw new Error('發現不完整的 V3 工作表，請檢查後再操作。');
    }
    ftvCheckHeaders_(existingT, FTV.teacherHeaders);
    ftvCheckHeaders_(existingD, FTV.definitionHeaders);
    SpreadsheetApp.getUi().alert('V3 已初始化，不需要重複執行。');
    return;
  }
  ftvCreateTable_(FTV.teachersSheet, FTV.teacherHeaders, [], '#17618c');
  ftvCreateTable_(FTV.definitionsSheet, FTV.definitionHeaders, FTV.definitions, '#697583');
  SpreadsheetApp.getUi().alert('V3 初始化成功。請選「開啟中英文分頁編輯器」建立第一位教師。');
}

function ftvText_(v, max, field) {
  const s = String(v == null ? '' : v).trim();
  if (s.length > max) throw new Error(field + ' 超過 ' + max + ' 字元');
  return s;
}
function ftvBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function ftvInt_(v, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 999999) {
    throw new Error(field + ' 須為 0–999999 的整數');
  }
  return n;
}
function ftvUrl_(v, field) {
  const s = ftvText_(v, 1500, field);
  if (s && !/^https?:\/\/[^\s]+$/i.test(s)) throw new Error(field + ' 僅接受 http/https 網址');
  return s;
}
function ftvLock_(fn) {
  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function ftvDefinitions_() {
  // Every Tab is defined by the TabDefinitions worksheet, not hard-coded here.
  const data = ftvReadTable_(FTV.definitionsSheet, FTV.definitionHeaders).data;
  const defs = data.map(r => ({
    key: String(r.section_key || '').trim(),
    zh: String(r.title_zh || '').trim(),
    en: String(r.title_en || '').trim(),
    order: Number(r.display_order),
    locked: ftvBool_(r.order_locked),
    is_active: ftvBool_(r.is_active),
    entry_layout: String(r.entry_layout || 'list')
  })).sort((a,b) => a.order - b.order);
  if (!defs.length) throw new Error('TabDefinitions 尚無設定');
  if (defs.some(d => !/^[a-z][a-z0-9_]*$/.test(d.key) ||
      !d.zh || !d.en || !Number.isFinite(d.order)))
    throw new Error('TabDefinitions 有無效代碼、名稱或排序');
  if (new Set(defs.map(d => d.key)).size !== defs.length)
    throw new Error('TabDefinitions 的 section_key 不可重複');
  return defs;
}

function ftvTeachers_() {
  return ftvReadTable_(FTV.teachersSheet, FTV.teacherHeaders).data;
}
// 教師 ID 可修改，但不可重複。保留 teacher_sheet 作為穩定儲存位置。
function ftvValidateTeacherId_(value) {
  const id = String(value == null ? '' : value).trim();
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) {
    throw new Error('教師 ID 只能使用英文字母、數字、底線或連字號，長度 2–40 字元。');
  }
  return id;
}
function ftvEnsureUniqueTeacherId_(newId, originalId, teacherRows) {
  const rows = teacherRows || ftvTeachers_();
  const conflict = rows.find(t =>
    String(t.teacher_id).trim().toLowerCase() === newId.toLowerCase() &&
    String(t.teacher_id).trim() !== String(originalId || '')
  );
  if (conflict) throw new Error('教師 ID 已被使用：' + newId);
}

function ftvTeacher_(id) {
  const teachers = ftvTeachers_();
  const row = teachers.find(t => String(t.teacher_id) === String(id));
  if (!row) throw new Error('找不到教師 ID：' + id);
  const sheetName = String(row.teacher_sheet);
  if (!sheetName) throw new Error('教師沒有對應工作表：' + id);
  if (teachers.filter(t => String(t.teacher_sheet) === sheetName).length !== 1) {
    throw new Error('教師工作表對應重複，請先修正 Teachers');
  }
  return row;
}
function ftvEntries_(teacher) {
  return ftvReadTable_(String(teacher.teacher_sheet), FTV.entryHeaders).data;
}
function ftvRev_(teacher, entries) {
  const data = JSON.stringify({teacher, entries});
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, data, Utilities.Charset.UTF_8
  )).slice(0, 35);
}

/** For the HTML dialog; all content comes from the V3 teacher-specific sheet. */
function ftvGetBootstrap() {
  return {
    tabs: ftvDefinitions_().filter(t => t.is_active),
    categories: fcfgConfigs_().categories.filter(c=>c.is_active),
    teachers: ftvTeachers_().sort((a, b) => Number(a.display_order) - Number(b.display_order))
      .map(t => ({id: String(t.teacher_id), name: String(t.name_zh), status: String(t.publish_status)})),
    spreadsheetUrl: ftvSS_().getUrl()
  };
}
function ftvGetTeacher(id) {
  const teacher = ftvTeacher_(id);
  const entries = ftvEntries_(teacher);
  const allowed = new Set(ftvDefinitions_().map(d => d.key));
  if (entries.some(e => !allowed.has(String(e.section_key)))) {
    throw new Error('教師工作表包含未知 Tab 代碼，請先檢查資料。');
  }
  return {
    teacher: Object.assign({}, teacher),
    entries: [...entries].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    revision: ftvRev_(teacher, entries)
  };
}

function ftvOpenManager() {
  // Avoid opening the dialog before setup.
  ftvDefinitions_();
  const output = HtmlService.createHtmlOutputFromFile('FacultyManager')
    .setWidth(1150).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(output, '教師資料管理 V3｜中文／English');
}

function ftvCreateTeacher(customId) {
  return ftvLock_(() => {
    const table = ftvReadTable_(FTV.teachersSheet, FTV.teacherHeaders);
    ftvDefinitions_();
    const requested = String(customId == null ? '' : customId).trim();
    let id;
    if (requested) {
      id = ftvValidateTeacherId_(requested);
      ftvEnsureUniqueTeacherId_(id, '', table.data);
    } else {
      const nums = table.data.map(t => /^T(\d+)$/i.exec(String(t.teacher_id)))
        .filter(Boolean).map(m => Number(m[1]));
      let n = Math.max(0, ...nums) + 1;
      do {
        id = 'T' + String(n).padStart(3, '0');
        n++;
      } while (table.data.some(t => String(t.teacher_id).toLowerCase() === id.toLowerCase()) ||
               ftvSS_().getSheetByName(id + '_教師資料'));
    }
    // teacher_sheet 是實際工作表名稱，日後修改 ID 也不跟著重新命名。
    const name = id + '_教師資料';
    if (ftvSS_().getSheetByName(name)) {
      throw new Error('已有同名教師工作表：' + name);
    }
    ftvCreateTable_(name, FTV.entryHeaders, [], '#4c8eaa');
    const order = Math.max(0, ...table.data.map(t => Number(t.display_order) || 0)) + 10;
    const item = {
      teacher_id:id, teacher_sheet:name, name_zh:'新教師（請修改）', name_en:'',
      title_zh:'',title_en:'',unit_zh:'',unit_en:'',office_zh:'',office_en:'',
      expertise_zh:'',expertise_en:'',email:'',profile_url:'',photo_url:'',
      display_order:order, publish_status:'DRAFT', visible_zh:true, visible_en:false,
      category_key:'full_time'
    };
    table.sheet.appendRow(FTV.teacherHeaders.map(h => item[h]));
    return {id, sheet:name};
  });
}

/** Save validates complete teacher document then writes one teacher tab. */
function ftvSaveTeacher(payload) {
  if (!payload || !payload.teacher || !Array.isArray(payload.entries)) throw new Error('資料格式錯誤');
  return ftvLock_(() => {
    // originalTeacherId 不會隨輸入框編輯而變，確保改 ID 後仍能定位原紀錄。
    const oldId = ftvValidateTeacherId_(
      payload.originalTeacherId || payload.teacher.teacher_id
    );
    const newId = ftvValidateTeacherId_(payload.teacher.teacher_id);
    const existing = ftvTeacher_(oldId);
    const existingEntries = ftvEntries_(existing);
    if (payload.revision !== ftvRev_(existing, existingEntries)) {
      throw new Error('資料已由其他編輯者更新。請重新載入後再儲存，以免覆蓋他人變更。');
    }
    ftvEnsureUniqueTeacherId_(newId, oldId);
    const allowed = new Set(ftvDefinitions_().map(d => d.key));
    const email = ftvText_(payload.teacher.email, 200, 'Email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email 格式不正確');
    const status = String(payload.teacher.publish_status || 'DRAFT').toUpperCase();
    if (!['DRAFT','PUBLISHED'].includes(status)) throw new Error('發布狀態不正確');
    const teacher = Object.assign({}, existing, {
      teacher_id:newId,
      name_zh:ftvText_(payload.teacher.name_zh,150,'中文姓名'),
      name_en:ftvText_(payload.teacher.name_en,150,'English Name'),
      title_zh:ftvText_(payload.teacher.title_zh,250,'中文職稱'),
      title_en:ftvText_(payload.teacher.title_en,250,'English Title'),
      unit_zh:ftvText_(payload.teacher.unit_zh,250,'中文單位'),
      unit_en:ftvText_(payload.teacher.unit_en,250,'English Unit'),
      office_zh:ftvText_(payload.teacher.office_zh,250,'中文辦公室'),
      office_en:ftvText_(payload.teacher.office_en,250,'English Office'),
      expertise_zh:ftvText_(payload.teacher.expertise_zh,2500,'中文研究專長'),
      expertise_en:ftvText_(payload.teacher.expertise_en,2500,'English Expertise'),
      email, profile_url:ftvUrl_(payload.teacher.profile_url,'個人網站'),
      photo_url:ftvUrl_(payload.teacher.photo_url,'照片網址'),
      display_order:ftvInt_(payload.teacher.display_order,'教師排序'),
      publish_status:status,
      visible_zh:payload.teacher.visible_zh === true,
      visible_en:payload.teacher.visible_en === true,
      category_key: String(payload.teacher.category_key || existing.category_key || 'full_time')
    });
    if (!fcfgConfigs_().categories.some(c=>c.key===teacher.category_key && c.is_active))
      throw new Error('教師分類不存在或未啟用：' + teacher.category_key);
    if (!teacher.name_zh) throw new Error('中文姓名不能空白');
    if (status === 'PUBLISHED' && teacher.visible_en && !teacher.name_en) {
      throw new Error('要公開英文教師頁面，請先填寫英文姓名。');
    }
    if (payload.entries.length > 1200) throw new Error('單一教師最多 1200 筆資料');
    const oldIds = new Set(existingEntries.map(e => String(e.entry_id)));
    const newIds = new Set();
    const normalized = payload.entries.map((e, i) => {
      const sid = String(e.section_key || '');
      if (!allowed.has(sid)) throw new Error('不允許的 Tab 分類：'+sid);
      const typ = String(e.entry_type || 'list_item');
      if (!['text','list_item'].includes(typ)) throw new Error('不支援的內容類型');
      let eid = String(e.entry_id || '').trim();
      if (eid && !oldIds.has(eid)) throw new Error('資料 ID 不屬於這位教師：' + eid);
      if (!eid) eid = 'E-' + Utilities.getUuid().slice(0, 12).toUpperCase();
      if (newIds.has(eid)) throw new Error('重複的內容 ID：' + eid);
      newIds.add(eid);
      return {
        entry_id:eid, section_key:sid, entry_type:typ,
        title_zh:ftvText_(e.title_zh,400,'中文項目標題'),
        title_en:ftvText_(e.title_en,400,'English entry title'),
        content_zh:ftvText_(e.content_zh,20000,'中文內容'),
        content_en:ftvText_(e.content_en,20000,'English content'),
        link_url:ftvUrl_(e.link_url,'內容連結'),
        sort_order:ftvInt_(e.sort_order == null ? (i+1)*10 : e.sort_order,'內容順序'),
        visible_zh:e.visible_zh === true,
        visible_en:e.visible_en === true,
        field_values_json:(() => {
          const previous = existingEntries.find(o=>String(o.entry_id)===eid);
          const raw = e.field_values_json === undefined || e.field_values_json === null
            ? String(previous?.field_values_json || '{}')
            : String(e.field_values_json || '{}');
          let data;
          try { data = JSON.parse(raw); } catch (_) { throw new Error('field_values_json 格式有誤：' + eid); }
          if (!data || typeof data !== 'object' || Array.isArray(data))
            throw new Error('field_values_json 必須是 JSON 物件：' + eid);
          return JSON.stringify(data);
        })()
      };
    });
    // Stable tab order: never sorted by sheet row or any per-teacher setting.
    const defs = ftvDefinitions_();
    const rank = Object.fromEntries(defs.map((d, i) => [d.key, i]));
    normalized.sort((a, b) => rank[a.section_key] - rank[b.section_key] || a.sort_order - b.sort_order);
    const sh = ftvSheet_(String(existing.teacher_sheet));
    const needed = normalized.length + 1;
    if (sh.getMaxRows() < needed) sh.insertRowsAfter(sh.getMaxRows(), needed - sh.getMaxRows());
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow()-1, FTV.entryHeaders.length).clearContent();
    if (normalized.length) sh.getRange(2,1,normalized.length,FTV.entryHeaders.length)
      .setValues(normalized.map(e => FTV.entryHeaders.map(h => e[h])));
    const ts = ftvSheet_(FTV.teachersSheet);
    ts.getRange(existing._row,1,1,FTV.teacherHeaders.length)
      .setValues([FTV.teacherHeaders.map(h => teacher[h])]);
    SpreadsheetApp.flush();
    return ftvGetTeacher(newId);
  });
}

/**
 * V3 publication must use the config-driven exporter in FacultyConfig.gs.
 * Do not restore the old JSON publisher: it omits categories and dynamic fields.
 */
function ftvPublish_(preview) {
  const ui = SpreadsheetApp.getUi();
  const message = preview
    ? '測試 JSON 也會公開在 GitHub Pages。確定發布？'
    : '正式資料只發布 PUBLISHED 教師。確定發布？';
  if (ui.alert('V3 發布', message, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const result = preview ? fcfgPublishPreview() : fcfgPublishProduction();
  ui.alert('已發布：' + result.path + '（' + result.teachers + ' 位教師）');
}
function ftvPublishPreview(){ ftvPublish_(true); }
function ftvPublishProduction(){ ftvPublish_(false); }