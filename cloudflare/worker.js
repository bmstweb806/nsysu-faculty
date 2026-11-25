const ADMIN_HTML = "__ADMIN_HTML__";
const EMBED_JS = "__EMBED_JS__";
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options':'nosniff', ...headers }
});
const publicJson = value => json(value, 200, { 'cache-control':'public, max-age=60',
  'access-control-allow-origin':'*' });
const fail = (message, status = 400) => json({ error: message }, status);
const now = () => Math.floor(Date.now() / 1000);
const bytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const hex = (v) => [...new Uint8Array(v)].map(x => x.toString(16).padStart(2, '0')).join('');
const fromHex = (s) => Uint8Array.from(s.match(/../g).map(x => parseInt(x, 16)));
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const equal = async (a, b) => {
  const x = await sha(a), y = await sha(b);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
};
async function passwordHash(password, salt = hex(bytes(16))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations: 100000 }, key, 256);
  return 'pbkdf2-sha256:100000:' + salt + ':' + hex(bits);
}
async function checkPassword(password, stored) {
  const m = /^pbkdf2-sha256:100000:([a-f0-9]{32}):([a-f0-9]{64})$/.exec(stored || '');
  if (!m) return false;
  return equal(await passwordHash(password, m[1]), stored);
}
const q = (env, sql, ...params) => env.DB.prepare(sql).bind(...params);
const all = async (env, sql, ...params) => (await q(env, sql, ...params).all()).results;
const first = async (env, sql, ...params) => q(env, sql, ...params).first();
const run = async (env, sql, ...params) => q(env, sql, ...params).run();
function cookie(request) {
  return /(?:^|; )faculty_session=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1] || '';
}
async function identity(request, env) {
  const token = cookie(request);
  if (!token) return null;
  const user = await first(env, `SELECT u.user_id,u.username,u.is_active,u.must_change_password,s.csrf_hash FROM sessions s JOIN users u ON u.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`, await sha(token), now());
  if (!user?.is_active) return null;
  user.roles = (await all(env, 'SELECT role FROM user_roles WHERE user_id=?', user.user_id)).map(x => x.role);
  user.teachers = (await all(env, 'SELECT teacher_id FROM user_teachers WHERE user_id=?', user.user_id)).map(x => x.teacher_id);
  return user;
}
function authorized(user, id, admin = false) {
  return !!user && (user.roles.includes('ADMIN') || (!admin && user.roles.includes('TEACHER') && user.teachers.includes(id)));
}
async function body(request) {
  if (Number(request.headers.get('content-length') || 0) > 400000) throw Error('資料過大');
  return request.json();
}
async function csrf(request, user) {
  if (!user) return false;
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return false;
  const value = request.headers.get('x-csrf-token') || '';
  return value.length >= 32 && await equal(await sha(value), user.csrf_hash);
}
async function login(request, env) {
  const input = await body(request);
  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!username || !password) return fail('帳號或密碼錯誤', 401);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await sha(ip + ':' + username);
  const attempt = await first(env, 'SELECT failures,blocked_until FROM login_attempts WHERE attempt_key=?', key);
  if (attempt?.blocked_until > now()) return fail('登入暫時受限，請稍後再試', 429);
  const user = await first(env, 'SELECT user_id,username,password_hash,is_active,must_change_password FROM users WHERE username=?', username);
  const ok = user?.is_active && await checkPassword(password, user.password_hash);
  if (!ok) {
    const failures = (attempt?.failures || 0) + 1;
    await run(env, `INSERT INTO login_attempts(attempt_key,failures,blocked_until,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(attempt_key) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at`,
      key, failures, failures >= 5 ? now() + 900 : 0, now());
    return fail('帳號或密碼錯誤', 401);
  }
  await run(env, 'DELETE FROM login_attempts WHERE attempt_key=?', key);
  const token = hex(bytes(32)), csrfToken = hex(bytes(32));
  await run(env, 'INSERT INTO sessions(token_hash,user_id,created_at,expires_at,csrf_hash) VALUES(?,?,?,?,?)',
    await sha(token), user.user_id, now(), now() + 28800, await sha(csrfToken));
  const roles = (await all(env, 'SELECT role FROM user_roles WHERE user_id=?', user.user_id)).map(x => x.role);
  return json({ username: user.username, roles, csrf: csrfToken, must_change_password: !!user.must_change_password }, 200,
    { 'set-cookie': `faculty_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` });
}
async function setup(request, env) {
  if (!env.SETUP_TOKEN) return fail('未啟用初始化', 503);
  const supplied = request.headers.get('x-setup-token') || '';
  if (!supplied || !await equal(supplied, env.SETUP_TOKEN)) return fail('無效初始化憑證', 403);
  if ((await first(env, 'SELECT count(*) AS n FROM users')).n !== 0) return fail('初始化已完成', 409);
  const input = await body(request);
  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username) || password.length < 8 || password.length > 200)
    return fail('請使用有效電子郵件與至少 8 字元密碼');
  const grant = await first(env, "SELECT role FROM pending_account_grants WHERE email=? AND role='ADMIN' AND is_active=1", username);
  if (!grant) return fail('此帳號不在已匯入的管理員授權名單', 403);
  const id = crypto.randomUUID();
  await env.DB.batch([
    q(env, 'INSERT INTO users(user_id,username,password_hash,is_active,must_change_password) VALUES(?,?,?,1,0)', id, username, await passwordHash(password)),
    q(env, "INSERT INTO user_roles(user_id,role) VALUES(?,'ADMIN')", id),
    q(env, "INSERT INTO audit_logs(actor_id,action) VALUES(?,'ADMIN_SETUP')", id)
  ]);
  return json({ ok: true });
}
async function draft(env, id) {
  const t = await first(env, 'SELECT * FROM teachers WHERE teacher_id=? AND archived_at IS NULL', id);
  if (!t) return null;
  const langs = await all(env, 'SELECT * FROM teacher_translations WHERE teacher_id=?', id);
  const entries = await all(env, `SELECT e.*,z.title AS title_zh,z.content AS content_zh,z.is_visible AS visible_zh,
    n.title AS title_en,n.content AS content_en,n.is_visible AS visible_en
    FROM teacher_entries e LEFT JOIN entry_translations z ON e.entry_id=z.entry_id AND z.locale='zh'
    LEFT JOIN entry_translations n ON e.entry_id=n.entry_id AND n.locale='en'
    WHERE e.teacher_id=? ORDER BY e.section_key,e.sort_order,e.entry_id`, id);
  const values = await all(env, `SELECT v.* FROM entry_field_values v JOIN teacher_entries e ON e.entry_id=v.entry_id WHERE e.teacher_id=?`, id);
  for (const e of entries) {
    e.fields = {};
    for (const v of values.filter(x => x.entry_id === e.entry_id)) (e.fields[v.field_key] ||= {})[v.locale] = v.value;
  }
  const z = langs.find(x => x.locale === 'zh') || {}, n = langs.find(x => x.locale === 'en') || {};
  return { teacher: {
    teacher_id: id, category_key: t.category_key, email: t.email, profile_url: t.profile_url, photo_url: t.photo_url,
    name_zh: z.name || '', name_en: n.name || '', title_zh: z.title || '', title_en: n.title || '',
    unit_zh: z.unit || '', unit_en: n.unit || '', office_zh: z.office || '', office_en: n.office || '',
    expertise_zh: z.expertise || '', expertise_en: n.expertise || '',
    visible_zh: !!z.is_visible, visible_en: !!n.is_visible,
    publish_status: await first(env, 'SELECT 1 AS x FROM public_teacher_snapshots WHERE teacher_id=?', id) ? 'PUBLISHED' : 'DRAFT'
  }, entries, revision: t.edit_token || String(t.row_version), row_version: t.row_version };
}
async function definitions(env) {
  const categories = (await all(env, 'SELECT * FROM faculty_categories ORDER BY sort_order,category_key')).map(x => ({ key: x.category_key, zh: x.label_zh, en: x.label_en, is_active: !!x.is_active }));
  const tabs = (await all(env, 'SELECT * FROM section_definitions ORDER BY sort_order,section_key')).map(x => ({ key: x.section_key, zh: x.label_zh, en: x.label_en, is_active: !!x.is_active, entry_layout: x.entry_layout }));
  const fields = (await all(env, 'SELECT * FROM field_definitions ORDER BY section_key,sort_order,field_key')).map(x => ({
    section_key: x.section_key, key: x.field_key, zh: x.label_zh, en: x.label_en, type: x.field_type,
    required: !!x.is_required, is_active: !!x.is_active, show_public: !!x.show_public
  }));
  return { schema_version: 4, preview: false, categories, tabs, fields };
}
async function bootstrap(env, user) {
  const where = user.roles.includes('ADMIN') ? '' : ' AND t.teacher_id IN (SELECT teacher_id FROM user_teachers WHERE user_id=?)';
  const teachers = await all(env, `SELECT t.teacher_id AS id,t.category_key,t.sort_order,z.name,
    CASE WHEN p.teacher_id IS NULL THEN 'DRAFT' ELSE 'PUBLISHED' END AS status
    FROM teachers t LEFT JOIN teacher_translations z ON z.teacher_id=t.teacher_id AND z.locale='zh'
    LEFT JOIN public_teacher_snapshots p ON p.teacher_id=t.teacher_id
    WHERE t.archived_at IS NULL${where} ORDER BY t.sort_order,t.teacher_id`, ...(where ? [user.user_id] : []));
  return { teachers, ...(await definitions(env)), role: user.roles.includes('ADMIN') ? 'ADMIN' : 'TEACHER', username: user.username };
}
function cleanText(value, max = 10000) {
  const s = String(value ?? '');
  if (s.length > max) throw Error('欄位長度超出限制');
  return s;
}
function safeUrl(s) {
  if (!s) return '';
  const u = new URL(s);
  if (!['http:', 'https:'].includes(u.protocol)) throw Error('網址必須使用 HTTP 或 HTTPS');
  return u.href;
}
async function saveTeacher(env, user, id, input) {
  if (!authorized(user, id)) return fail('沒有此教師的編輯權限', 403);
  const old = await draft(env, id);
  if (!old) return fail('找不到教師', 404);
  if (String(input.revision) !== old.revision) return fail('資料已被他人修改，請重新載入', 409);
  const t = input.teacher || {}, entries = input.entries;
  if (!Array.isArray(entries) || entries.length > 300) return fail('資料筆數無效');
  const isAdmin = user.roles.includes('ADMIN');
  if (!isAdmin && (t.category_key !== old.teacher.category_key || t.publish_status !== old.teacher.publish_status))
    return fail('教師不可修改分類或發布狀態', 403);
  if (!await first(env, 'SELECT 1 AS x FROM faculty_categories WHERE category_key=?', t.category_key)) return fail('教師分類無效');
  const defs = await all(env, 'SELECT section_key,field_key,field_type,is_required FROM field_definitions');
  const sections = new Set((await all(env, 'SELECT section_key FROM section_definitions')).map(x => x.section_key));
  const stmts = [], token = crypto.randomUUID(), next = old.row_version + 1;
  stmts.push(q(env, `UPDATE teachers SET category_key=?,email=?,profile_url=?,photo_url=?,row_version=?,edit_token=?,updated_at=CURRENT_TIMESTAMP
    WHERE teacher_id=? AND edit_token=? AND row_version=?`,
    t.category_key, cleanText(t.email, 300), safeUrl(t.profile_url), safeUrl(t.photo_url), next, token, id, old.revision === String(old.row_version) ? '' : old.revision, old.row_version));
  for (const loc of ['zh', 'en']) stmts.push(q(env, `UPDATE teacher_translations SET name=?,title=?,unit=?,office=?,expertise=?,is_visible=?
    WHERE teacher_id=? AND locale=? AND EXISTS(SELECT 1 FROM teachers WHERE teacher_id=? AND edit_token=?)`,
    ...['name', 'title', 'unit', 'office', 'expertise'].map(k => cleanText(t[k + '_' + loc], 3000)),
    t['visible_' + loc] ? 1 : 0, id, loc, id, token));
  stmts.push(q(env, 'DELETE FROM teacher_entries WHERE teacher_id=? AND EXISTS(SELECT 1 FROM teachers WHERE teacher_id=? AND edit_token=?)', id, id, token));
  let position = 0;
  for (const e of entries) {
    if (!sections.has(e.section_key)) return fail('內容分類無效');
    const eid = crypto.randomUUID();
    stmts.push(q(env, `INSERT INTO teacher_entries(entry_id,teacher_id,section_key,sort_order,entry_type,link_url,card_width,card_height)
      SELECT ?,teacher_id,?,?,?,?,?,? FROM teachers WHERE teacher_id=? AND edit_token=?`,
      eid, e.section_key, position++, ['list_item','text'].includes(e.entry_type) ? e.entry_type : 'list_item',
      safeUrl(e.link_url || ''), e.card_width == null ? null : Number(e.card_width), e.card_height == null ? null : Number(e.card_height), id, token));
    for (const loc of ['zh','en']) stmts.push(q(env, `INSERT INTO entry_translations(entry_id,locale,title,content,is_visible)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM teachers WHERE teacher_id=? AND edit_token=?)`,
      eid, loc, cleanText(e['title_' + loc]), cleanText(e['content_' + loc]), e['visible_' + loc] ? 1 : 0, id, token));
    for (const [key, pair] of Object.entries(e.fields || {})) {
      const def = defs.find(x => x.section_key === e.section_key && x.field_key === key);
      if (!def) return fail('自訂欄位與內容分類不符');
      for (const loc of ['zh','en']) if (pair?.[loc] != null && pair[loc] !== '') {
        const value = cleanText(pair[loc]);
        if (def.field_type === 'url') safeUrl(value);
        stmts.push(q(env, `INSERT INTO entry_field_values(entry_id,section_key,field_key,locale,value)
          SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM teachers WHERE teacher_id=? AND edit_token=?)`,
          eid, e.section_key, key, loc, value, id, token));
      }
    }
  }
  stmts.push(q(env, `INSERT INTO teacher_revisions(revision_id,teacher_id,row_version,payload_json,actor_id)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM teachers WHERE teacher_id=? AND edit_token=?)`,
    crypto.randomUUID(), id, old.row_version, JSON.stringify(old), user.user_id, id, token));
  stmts.push(q(env, `INSERT INTO audit_logs(actor_id,teacher_id,action)
    SELECT ?,?,'SAVE_DRAFT' WHERE EXISTS(SELECT 1 FROM teachers WHERE teacher_id=? AND edit_token=?)`,
    user.user_id, id, id, token));
  await env.DB.batch(stmts);
  const result = await draft(env, id);
  if (result.revision !== token) return fail('資料已被他人修改，請重新載入', 409);
  return json(result);
}
async function publicProfile(env, id) {
  const row = await first(env, `SELECT payload_json FROM public_teacher_snapshots p JOIN teachers t ON t.teacher_id=p.teacher_id
    WHERE p.teacher_id=? AND t.archived_at IS NULL`, id);
  if (!row) return null;
  const profile = JSON.parse(row.payload_json);
  const cfgRow = await first(env, 'SELECT payload_json FROM public_config_snapshot WHERE singleton=1');
  if (!cfgRow) return profile;
  const cfg = JSON.parse(cfgRow.payload_json);
  const tabs = new Set(cfg.tabs.filter(x => x.is_active).map(x => x.key));
  const fields = new Set(cfg.fields.filter(x => x.is_active && x.show_public).map(x => x.section_key + ':' + x.key));
  profile.teacher.sections = (profile.teacher.sections || []).filter(x => tabs.has(x.key)).map(s => ({
    ...s, entries: s.entries.map(e => ({
      ...e, fields: Object.fromEntries(Object.entries(e.fields || {}).filter(([key]) => fields.has(s.key + ':' + key)))
    }))
  }));
  return profile;
}
async function publish(env, user, id) {
  if (!authorized(user, id)) return fail('沒有發布權限', 403);
  const d = await draft(env, id);
  if (!d) return fail('找不到教師', 404);
  const existing = await publicProfile(env, id);
  if (!existing && !user.roles.includes('ADMIN')) return fail('首次發布需要管理員核准', 403);
  const config = JSON.parse((await first(env, 'SELECT payload_json FROM public_config_snapshot WHERE singleton=1')).payload_json);
  const visibleFields = new Set(config.fields.filter(x => x.is_active && x.show_public).map(x => x.section_key + ':' + x.key));
  const t = d.teacher, locales = ['zh','en'];
  const localized = key => Object.fromEntries(locales.map(loc => [loc, t['visible_' + loc] ? t[key + '_' + loc] : '']));
  const sections = config.tabs.filter(x => x.is_active).map(tab => ({
    key: tab.key, entries: d.entries.filter(e => e.section_key === tab.key).map(e => ({
      type: e.entry_type, title: Object.fromEntries(locales.map(loc => [loc, e['visible_' + loc] && t['visible_' + loc] ? e['title_' + loc] : ''])),
      content: Object.fromEntries(locales.map(loc => [loc, e['visible_' + loc] && t['visible_' + loc] ? e['content_' + loc] : ''])),
      url: e.link_url, visible: Object.fromEntries(locales.map(loc => [loc, !!(e['visible_' + loc] && t['visible_' + loc])])),
      fields: Object.fromEntries(Object.entries(e.fields || {}).filter(([key]) => visibleFields.has(tab.key + ':' + key))
        .map(([key,pair]) => [key,Object.fromEntries(locales.map(loc => [loc, e['visible_' + loc] && t['visible_' + loc] ? pair[loc] || '' : '']))])),
      card_width: e.card_width, card_height: e.card_height
    }))
  }));
  const profile = { schema_version: 4, preview: false, teacher: {
    id, category_key: t.category_key, name: localized('name'), title: localized('title'), unit: localized('unit'),
    office: localized('office'), expertise: localized('expertise'), email: t.email, profile_url: t.profile_url,
    photo_url: t.photo_url, publish_status: 'PUBLISHED',
    visible: Object.fromEntries(locales.map(loc => [loc, !!t['visible_' + loc]])), sections
  }};
  await env.DB.batch([
    q(env, `INSERT INTO public_teacher_snapshots(teacher_id,category_key,sort_order,source_version,payload_json,published_by)
      SELECT teacher_id,category_key,sort_order,row_version,?,? FROM teachers WHERE teacher_id=?
      ON CONFLICT(teacher_id) DO UPDATE SET category_key=excluded.category_key,sort_order=excluded.sort_order,
      source_version=excluded.source_version,payload_json=excluded.payload_json,published_by=excluded.published_by,published_at=CURRENT_TIMESTAMP`,
      JSON.stringify(profile), user.user_id, id),
    q(env, "INSERT INTO audit_logs(actor_id,teacher_id,action) VALUES(?,?,'PUBLISH')", user.user_id, id)
  ]);
  return json({ ok: true, profile });
}
async function publicIndex(env) {
  const config = JSON.parse((await first(env, 'SELECT payload_json FROM public_config_snapshot WHERE singleton=1')).payload_json);
  const rows = await all(env, `SELECT p.teacher_id FROM public_teacher_snapshots p
    JOIN teachers t ON t.teacher_id=p.teacher_id WHERE t.archived_at IS NULL ORDER BY p.sort_order,p.teacher_id`);
  const profiles = await Promise.all(rows.map(x => publicProfile(env, x.teacher_id)));
  const teachers = profiles.map(x => x.teacher).map(t => {
    const degree = t.sections.find(x => x.key === 'education')?.entries.find(e => e.visible.zh || e.visible.en);
    return { ...t, sections: undefined, highest_degree: degree?.content || { zh:'', en:'' } };
  });
  const categories = config.categories || (await definitions(env)).categories;
  return { schema_version: 4, preview: false, categories, teachers };
}
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (method === 'GET' && (path === '/' || path === '/admin')) return new Response(ADMIN_HTML,
    { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store',
      'x-frame-options':'DENY', 'x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
  if (method === 'GET' && path === '/embed.js') return new Response(EMBED_JS,
    { headers: { 'content-type':'application/javascript; charset=utf-8', 'cache-control':'public, max-age=300',
      'access-control-allow-origin':'*', 'x-content-type-options':'nosniff' } });
  if (method === 'GET' && path === '/health') return json({ ok: true });
  if (method === 'GET' && path === '/data/faculty-index.json') return publicJson(await publicIndex(env));
  if (method === 'GET' && path === '/data/faculty-config.json') {
    const r = await first(env, 'SELECT payload_json FROM public_config_snapshot WHERE singleton=1');
    return r ? publicJson(JSON.parse(r.payload_json)) : fail('尚未發布設定', 404);
  }
  const profileMatch = /^\/data\/teachers\/([A-Za-z0-9_-]{2,40})\.json$/.exec(path);
  if (method === 'GET' && profileMatch) {
    const profile = await publicProfile(env, profileMatch[1]);
    return profile ? publicJson(profile) : fail('找不到公開教師', 404);
  }
  if (path === '/api/setup/status' && method === 'GET') {
    const exists = (await first(env, 'SELECT count(*) AS n FROM users')).n > 0;
    return json({ setup_required: !exists && !!env.SETUP_TOKEN });
  }
  if (path === '/api/setup' && method === 'POST') return setup(request, env);
  if (path === '/api/login' && method === 'POST') return login(request, env);
  const user = await identity(request, env);
  if (path === '/api/me' && method === 'GET') return user ? json({ username:user.username, roles:user.roles, teachers:user.teachers, must_change_password:!!user.must_change_password }) : fail('請先登入', 401);
  if (!user) return fail('請先登入', 401);
  if (method !== 'GET' && !(await csrf(request, user))) return fail('安全驗證失敗，請重新登入', 403);
  if (path === '/api/password' && method === 'POST') {
    const input = await body(request);
    if (!await checkPassword(String(input.current_password||''), (await first(env,'SELECT password_hash FROM users WHERE user_id=?',user.user_id)).password_hash))
      return fail('目前密碼錯誤', 401);
    if (String(input.new_password||'').length < 8) return fail('新密碼至少 8 字元');
    await env.DB.batch([
      q(env,'UPDATE users SET password_hash=?,must_change_password=0 WHERE user_id=?',await passwordHash(input.new_password),user.user_id),
      q(env,'DELETE FROM sessions WHERE user_id=?',user.user_id),
      q(env,"INSERT INTO audit_logs(actor_id,action) VALUES(?,'CHANGE_PASSWORD')",user.user_id)
    ]);
    return json({ok:true},200,{'set-cookie':'faculty_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
  }
  if (user.must_change_password && path !== '/api/logout') return fail('請先變更密碼', 403);
  if (path === '/api/logout' && method === 'POST') {
    await run(env, 'DELETE FROM sessions WHERE token_hash=?', await sha(cookie(request)));
    return json({ ok:true }, 200, { 'set-cookie':'faculty_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (path === '/api/bootstrap' && method === 'GET') return json(await bootstrap(env, user));
  const match = /^\/api\/teachers\/([A-Za-z0-9_-]{2,40})(?:\/(publish|archive|revisions))?$/.exec(path);
  if (match) {
    const id = match[1], action = match[2];
    if (!authorized(user, id)) return fail('沒有此教師的權限', 403);
    if (!action && method === 'GET') return json(await draft(env, id));
    if (!action && method === 'PUT') return saveTeacher(env, user, id, await body(request));
    if (action === 'publish' && method === 'POST') return publish(env, user, id);
    if (action === 'revisions' && method === 'GET') return json(await all(env,
      'SELECT revision_id,row_version,created_at FROM teacher_revisions WHERE teacher_id=? ORDER BY created_at DESC LIMIT 50', id));
    if (action === 'archive' && method === 'POST') {
      if (!authorized(user, id, true)) return fail('僅管理員可封存', 403);
      await env.DB.batch([
        q(env, 'UPDATE teachers SET archived_at=CURRENT_TIMESTAMP WHERE teacher_id=?', id),
        q(env, 'DELETE FROM public_teacher_snapshots WHERE teacher_id=?', id),
        q(env, 'DELETE FROM user_teachers WHERE teacher_id=?', id),
        q(env, "INSERT INTO audit_logs(actor_id,teacher_id,action) VALUES(?,?,'ARCHIVE')", user.user_id, id)
      ]);
      return json({ ok:true });
    }
  }
  const restoreMatch = /^\/api\/teachers\/([A-Za-z0-9_-]{2,40})\/revisions\/([a-f0-9-]+)\/restore$/.exec(path);
  if (restoreMatch && method === 'POST') {
    const id = restoreMatch[1];
    if (!authorized(user, id, true)) return fail('僅管理員可回復', 403);
    const rev = await first(env, 'SELECT payload_json FROM teacher_revisions WHERE teacher_id=? AND revision_id=?', id, restoreMatch[2]);
    if (!rev) return fail('找不到版本', 404);
    const current = await draft(env, id), old = JSON.parse(rev.payload_json);
    old.revision = current.revision;
    return saveTeacher(env, user, id, old);
  }
  if (path === '/api/teachers' && method === 'POST') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可新增', 403);
    const input = await body(request), id = String(input.id || '').trim();
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return fail('教師 ID 無效');
    const category = input.category_key || 'full_time';
    if (!await first(env, 'SELECT 1 AS x FROM faculty_categories WHERE category_key=?', category)) return fail('分類無效');
    await env.DB.batch([
      q(env, 'INSERT INTO teachers(teacher_id,category_key,sort_order) VALUES(?,?,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM teachers))', id, category),
      q(env, "INSERT INTO teacher_translations(teacher_id,locale) VALUES(?,'zh')", id),
      q(env, "INSERT INTO teacher_translations(teacher_id,locale) VALUES(?,'en')", id),
      q(env, "INSERT INTO audit_logs(actor_id,teacher_id,action) VALUES(?,?,'CREATE')", user.user_id, id)
    ]);
    return json({ id }, 201);
  }
  if (path === '/api/reorder' && method === 'POST') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可排序', 403);
    const { ids } = await body(request);
    const current = (await all(env, 'SELECT teacher_id FROM teachers WHERE archived_at IS NULL ORDER BY sort_order,teacher_id')).map(x => x.teacher_id);
    if (!Array.isArray(ids) || ids.length !== current.length || new Set(ids).size !== ids.length || ids.some(x => !current.includes(x)))
      return fail('教師名單已異動', 409);
    await env.DB.batch([...ids.map((id, i) => q(env, 'UPDATE teachers SET sort_order=? WHERE teacher_id=?', i, id)),
      ...ids.map((id, i) => q(env, 'UPDATE public_teacher_snapshots SET sort_order=? WHERE teacher_id=?', i, id)),
      q(env, "INSERT INTO audit_logs(actor_id,action) VALUES(?,'REORDER')", user.user_id)]);
    return json({ ok:true });
  }
  if (path === '/api/config' && method === 'GET') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可管理設定', 403);
    return json(await definitions(env));
  }
  if (path === '/api/config' && method === 'PUT') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可管理設定', 403);
    const cfg = await body(request);
    if (!Array.isArray(cfg.categories) || !Array.isArray(cfg.tabs) || !Array.isArray(cfg.fields)) return fail('設定格式無效');
    const stmts = [q(env, 'INSERT INTO config_revisions(revision_id,payload_json,actor_id) VALUES(?,?,?)',
      crypto.randomUUID(), JSON.stringify(await definitions(env)), user.user_id)];
    for (const [i,c] of cfg.categories.entries()) stmts.push(q(env, `INSERT INTO faculty_categories(category_key,label_zh,label_en,sort_order,is_active) VALUES(?,?,?,?,?)
      ON CONFLICT(category_key) DO UPDATE SET label_zh=excluded.label_zh,label_en=excluded.label_en,sort_order=excluded.sort_order,is_active=excluded.is_active`,
      cleanText(c.key, 40),cleanText(c.zh, 100),cleanText(c.en, 100),i,c.is_active?1:0));
    for (const [i,t] of cfg.tabs.entries()) stmts.push(q(env, `INSERT INTO section_definitions(section_key,label_zh,label_en,sort_order,entry_layout,is_active) VALUES(?,?,?,?,?,?)
      ON CONFLICT(section_key) DO UPDATE SET label_zh=excluded.label_zh,label_en=excluded.label_en,sort_order=excluded.sort_order,entry_layout=excluded.entry_layout,is_active=excluded.is_active`,
      cleanText(t.key,40),cleanText(t.zh,100),cleanText(t.en,100),i,t.entry_layout||'list',t.is_active?1:0));
    for (const [i,f] of cfg.fields.entries()) stmts.push(q(env, `INSERT INTO field_definitions(section_key,field_key,label_zh,label_en,field_type,sort_order,is_required,is_active,show_public)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(section_key,field_key) DO UPDATE SET label_zh=excluded.label_zh,label_en=excluded.label_en,
      field_type=excluded.field_type,sort_order=excluded.sort_order,is_required=excluded.is_required,is_active=excluded.is_active,show_public=excluded.show_public`,
      f.section_key,cleanText(f.key,40),cleanText(f.zh,100),cleanText(f.en,100),f.type||'text',i,f.required?1:0,f.is_active?1:0,f.show_public?1:0));
    stmts.push(q(env, "INSERT INTO audit_logs(actor_id,action) VALUES(?,'SAVE_CONFIG')", user.user_id));
    await env.DB.batch(stmts);
    return json(await definitions(env));
  }
  if (path === '/api/config/publish' && method === 'POST') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可發布設定', 403);
    const cfg = await definitions(env);
    await env.DB.batch([
      q(env, `UPDATE public_config_snapshot SET payload_json=?,published_by=?,published_at=CURRENT_TIMESTAMP WHERE singleton=1`,
        JSON.stringify({ schema_version:4, preview:false, tabs:cfg.tabs, fields:cfg.fields, categories:cfg.categories }), user.user_id),
      q(env, "INSERT INTO audit_logs(actor_id,action) VALUES(?,'PUBLISH_CONFIG')", user.user_id)
    ]);
    return json({ ok:true });
  }
  if (path === '/api/config/revisions' && method === 'GET') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可查看設定歷史', 403);
    return json(await all(env, 'SELECT revision_id,created_at FROM config_revisions ORDER BY created_at DESC LIMIT 50'));
  }
  const configRestore = /^\/api\/config\/revisions\/([a-f0-9-]+)\/restore$/.exec(path);
  if (configRestore && method === 'POST') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可回復設定', 403);
    const saved = await first(env, 'SELECT payload_json FROM config_revisions WHERE revision_id=?', configRestore[1]);
    if (!saved) return fail('找不到設定版本', 404);
    const cfg = JSON.parse(saved.payload_json);
    const result = await handle(new Request(request.url.replace(path,'/api/config'),{
      method:'PUT', headers:request.headers, body:JSON.stringify(cfg)
    }),env);
    return result;
  }
  if (path === '/api/users' && method === 'GET') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可管理帳號', 403);
    return json(await all(env, `SELECT u.user_id,u.username,u.is_active,u.must_change_password,
      GROUP_CONCAT(DISTINCT r.role) AS roles,GROUP_CONCAT(DISTINCT t.teacher_id) AS teachers
      FROM users u LEFT JOIN user_roles r ON r.user_id=u.user_id LEFT JOIN user_teachers t ON t.user_id=u.user_id
      GROUP BY u.user_id ORDER BY u.username`));
  }
  if (path === '/api/pending-grants' && method === 'GET') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可查看授權名單', 403);
    return json(await all(env, `SELECT g.email,g.role,g.teacher_id,g.is_active,
      CASE WHEN u.user_id IS NULL THEN 0 ELSE 1 END AS has_account
      FROM pending_account_grants g LEFT JOIN users u ON u.username=g.email ORDER BY g.role,g.email`));
  }
  if (path === '/api/users' && method === 'POST') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可管理帳號', 403);
    const x = await body(request), username = String(x.username || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username) || String(x.password||'').length < 8) return fail('帳號或密碼格式無效');
    if (!['ADMIN','TEACHER'].includes(x.role)) return fail('角色無效');
    if (x.role === 'TEACHER' && !await first(env, 'SELECT 1 AS x FROM teachers WHERE teacher_id=? AND archived_at IS NULL', x.teacher_id)) return fail('教師無效');
    const grant = await first(env, 'SELECT role,teacher_id,is_active FROM pending_account_grants WHERE email=?', username);
    if (grant && (!grant.is_active || grant.role !== x.role || (grant.teacher_id || '') !== (x.role === 'TEACHER' ? x.teacher_id : '')))
      return fail('帳號授權與已匯入名單不符', 403);
    const uid = crypto.randomUUID();
    await env.DB.batch([
      q(env, 'INSERT INTO users(user_id,username,password_hash) VALUES(?,?,?)', uid, username, await passwordHash(x.password)),
      q(env, 'INSERT INTO user_roles(user_id,role) VALUES(?,?)', uid, x.role),
      ...(x.role === 'TEACHER' ? [q(env, 'INSERT INTO user_teachers(user_id,teacher_id) VALUES(?,?)', uid, x.teacher_id)] : []),
      q(env, "INSERT INTO audit_logs(actor_id,action) VALUES(?,'CREATE_USER')", user.user_id)
    ]);
    return json({ ok:true }, 201);
  }
  const userState = /^\/api\/users\/([a-f0-9-]+)$/.exec(path);
  if (userState && method === 'PATCH') {
    if (!user.roles.includes('ADMIN')) return fail('僅管理員可管理帳號', 403);
    const target = await first(env, 'SELECT user_id,is_active FROM users WHERE user_id=?', userState[1]);
    if (!target) return fail('找不到帳號', 404);
    const { is_active } = await body(request);
    if (typeof is_active !== 'boolean') return fail('帳號狀態無效');
    if (target.user_id === user.user_id && !is_active) return fail('不可停用自己的帳號');
    await env.DB.batch([
      q(env,'UPDATE users SET is_active=? WHERE user_id=?',is_active?1:0,target.user_id),
      ...(!is_active?[q(env,'DELETE FROM sessions WHERE user_id=?',target.user_id)]:[]),
      q(env,"INSERT INTO audit_logs(actor_id,action) VALUES(?,'SET_USER_ACTIVE')",user.user_id)
    ]);
    return json({ok:true});
  }
  const pw = /^\/api\/users\/([a-f0-9-]+)\/password$/.exec(path);
  if (pw && method === 'POST') {
    if (!user.roles.includes('ADMIN') && user.user_id !== pw[1]) return fail('無權修改密碼', 403);
    const { password } = await body(request);
    if (String(password || '').length < 8) return fail('密碼至少 8 字元');
    await env.DB.batch([
      q(env, 'UPDATE users SET password_hash=?,must_change_password=0 WHERE user_id=?', await passwordHash(password), pw[1]),
      q(env, 'DELETE FROM sessions WHERE user_id=?', pw[1]),
      q(env, "INSERT INTO audit_logs(actor_id,action) VALUES(?,'RESET_PASSWORD')", user.user_id)
    ]);
    return json({ ok:true });
  }
  return fail('找不到 API', 404);
}
export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) { console.error(JSON.stringify({ error: e.message, path: new URL(request.url).pathname }));
      return fail('處理失敗，請稍後重試', 500); }
  }
};
