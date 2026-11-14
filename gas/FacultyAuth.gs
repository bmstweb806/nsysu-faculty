/**
 * NSYSU Faculty — Email OTP authentication (GAS server-side).
 *
 * Deploy the web app as the owner, with access permitted to intended users.
 * Spreadsheet and GitHub token remain accessible ONLY to the script owner.
 * The user's role is never accepted from the browser.
 *
 * Script Properties:
 * AUTH_SECRET: a random 32+ character string (set privately, NEVER commit it).
 */
const FTA = Object.freeze({
  permissions:'UserPermissions', otpSeconds:300, sessionSeconds:21600,
  maxAttempts:3, cooldownSeconds:90, maxRequestsPerHour:5, maxDailyEmails:60
});
/**
 * Run ONCE from the Apps Script editor while signed in as the project owner.
 * It creates a private script property; no secret is returned to the browser.
 */
function ftaInitializeSecret_(){
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('AUTH_SECRET'))return 'AUTH_SECRET 已存在';
 props.setProperty('AUTH_SECRET',ftaHex_(48));
 return 'AUTH_SECRET 已建立';
}
function ftaSecret_(){
 const secret=PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
 if(!secret||secret.length<32)throw new Error('管理員尚未設定 AUTH_SECRET（至少 32 字元）');
 return secret;
}
function ftaHash_(value){
 const bytes=Utilities.computeHmacSha256Signature(String(value),ftaSecret_());
 return Utilities.base64EncodeWebSafe(bytes);
}
function ftaRandom_(n){
 const bytes=[];for(let i=0;i<n;i+=16){
  const u=Utilities.getUuid().replace(/-/g,'');
  for(let j=0;j<32&&bytes.length<n;j+=2)bytes.push(parseInt(u.slice(j,j+2),16));
 }
 return bytes;
}
function ftaHex_(n){return ftaRandom_(n).map(b=>('0'+b.toString(16)).slice(-2)).join('');}
function ftaEmail_(raw){
 const email=String(raw||'').trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email 格式不正確');
 return email;
}
function ftaAccounts_(){
 const table=ftvTable_(FTA.permissions);
 ftvCheckColumns_(table,['email','role','teacher_id','is_active']);
 return table.items.filter(r=>ftvBool_(r.is_active)).map(r=>({
  email:String(r.email||'').trim().toLowerCase(),
  role:String(r.role||'').trim().toUpperCase(),
  teacher_id:String(r.teacher_id||'').trim()
 })).filter(r=>r.email&&(r.role==='ADMIN'||(r.role==='TEACHER'&&r.teacher_id)));
}
function ftaAccount_(email){
 return ftaAccounts_().find(r=>r.email===email)||null;
}
function ftaCache_(){return CacheService.getScriptCache();}
function ftaRequestCode(emailInput){
 const email=ftaEmail_(emailInput),cache=ftaCache_();
 // Do not reveal whether an address exists in the permission table.
 const response={ok:true,message:'如果帳號已啟用，驗證碼將寄送至該信箱。',retryAfterSeconds:FTA.cooldownSeconds};
 return ftvLock_(()=>{
  const key=ftaHash_('mail:'+email);
  const blocked=cache.get('cool:'+key);
  if(blocked)return response;
  const countKey='count:'+key;
  const count=Number(cache.get(countKey)||0);
  if(count>=FTA.maxRequestsPerHour)return response;
  const account=ftaAccount_(email);
  if(!account)return response;
  const props=PropertiesService.getScriptProperties();
  const day=Utilities.formatDate(new Date(),'Etc/UTC','yyyyMMdd');
  const dailyKey='FTA_MAIL_COUNT_'+day;
  const used=Number(props.getProperty(dailyKey)||0);
  if(used>=FTA.maxDailyEmails||MailApp.getRemainingDailyQuota()<1)return response;
  const random=ftaRandom_(4);
  const code=String(((((random[0]<<24)>>>0)+(random[1]<<16)+(random[2]<<8)+random[3])>>>0)%1000000).padStart(6,'0');
  const challenge=ftaHex_(16);
  const record={digest:ftaHash_(email+':'+challenge+':'+code),challenge,attempts:0,expiresAt:Date.now()+FTA.otpSeconds*1000};
  // No raw code stored in cache. Cache is temporary and is not an audit trail.
  cache.put('otp:'+key,JSON.stringify(record),FTA.otpSeconds);
  try{
   MailApp.sendEmail({
    to:email,subject:'中山大學醫學科技研究所｜教師資料管理驗證碼',
    body:'您的登入驗證碼：'+code+'\n有效時間：5 分鐘。\n若非本人操作，請忽略本郵件。'
   });
   cache.put('cool:'+key,'1',FTA.cooldownSeconds);
   cache.put(countKey,String(count+1),3600);
   props.setProperty(dailyKey,String(used+1));
  }catch(error){
   cache.remove('otp:'+key);
   throw new Error('驗證信寄送失敗，請稍後重試或聯絡系辦');
  }
  return response;
 });
}
function ftaVerifyCode(emailInput,codeInput){
 const email=ftaEmail_(emailInput),code=String(codeInput||'').trim();
 if(!/^\d{6}$/.test(code))throw new Error('請輸入 6 位驗證碼');
 return ftvLock_(()=>{
  const cache=ftaCache_(),key=ftaHash_('mail:'+email),otpKey='otp:'+key;
  const raw=cache.get(otpKey);
  if(!raw)throw new Error('驗證碼無效或已過期');
  const record=JSON.parse(raw);
  // A failed attempt must never extend the original five-minute expiration.
  const remainingSeconds=Math.ceil((Number(record.expiresAt||0)-Date.now())/1000);
  if(remainingSeconds<=0){cache.remove(otpKey);throw new Error('驗證碼無效或已過期');}
  if(record.attempts>=FTA.maxAttempts){cache.remove(otpKey);throw new Error('驗證次數已達上限，請重新申請');}
  record.attempts++;
  const correct=record.digest===ftaHash_(email+':'+record.challenge+':'+code);
  if(!correct){
   if(record.attempts>=FTA.maxAttempts)cache.remove(otpKey);
   else cache.put(otpKey,JSON.stringify(record),remainingSeconds);
   throw new Error('驗證碼無效或已過期');
  }
  const account=ftaAccount_(email);
  if(!account){cache.remove(otpKey);throw new Error('帳號已停用');}
  cache.remove(otpKey);
  const token=ftaHex_(32);
  const sessionKey='session:'+ftaHash_('session:'+token);
  cache.put(sessionKey,JSON.stringify({email,created:Date.now()}),FTA.sessionSeconds);
  return {token,account:{email,role:account.role,teacher_id:account.teacher_id}};
 });
}
function ftaSession_(token){
 if(!/^[a-f0-9]{64}$/.test(String(token||'')))throw new Error('請先登入');
 const key='session:'+ftaHash_('session:'+token);
 const raw=ftaCache_().get(key);
 if(!raw)throw new Error('登入已過期，請重新驗證');
 const session=JSON.parse(raw);
 const account=ftaAccount_(session.email);
 if(!account)throw new Error('帳號已停用');
 return account;
}
function ftaRequire_(token,teacherId){
 const account=ftaSession_(token);
 if(account.role==='ADMIN')return account;
 if(teacherId&&account.role==='TEACHER'&&account.teacher_id===String(teacherId))return account;
 throw new Error('沒有權限執行此操作');
}
function ftaAdmin_(token){
 const account=ftaSession_(token);
 if(account.role!=='ADMIN')throw new Error('只有系辦管理員可以執行此操作');
 return account;
}
function ftaGetSession(token){
 const a=ftaSession_(token);
 return {email:a.email,role:a.role,teacher_id:a.teacher_id};
}
function ftaLogout(token){
 if(/^[a-f0-9]{64}$/.test(String(token||''))){
  ftaCache_().remove('session:'+ftaHash_('session:'+token));
 }
 return {ok:true};
}
function ftaGetPermissions(token){
 ftaAdmin_(token);
 return ftaTablePublic_();
}
function ftaTablePublic_(){
 return ftaAccounts_().map(r=>({email:r.email,role:r.role,teacher_id:r.teacher_id,is_active:true}));
}
function ftaSavePermissions(token,records){
 ftaAdmin_(token);
 if(!Array.isArray(records)||records.length>200)throw new Error('帳號資料格式不正確');
 return ftvLock_(()=>{
  const table=ftvTable_(FTA.permissions);
  ftvCheckColumns_(table,['email','role','teacher_id','is_active']);
  const teacherIds=new Set(ftvTable_(FTV.teachers).items.map(t=>String(t.teacher_id)));
  const seen=new Set(),output=[];
  for(const raw of records){
   const email=ftaEmail_(raw.email),role=String(raw.role||'').toUpperCase();
   const teacherId=String(raw.teacher_id||'').trim();
   if(seen.has(email))throw new Error('重複的 Email：'+email);
   seen.add(email);
   if(!['ADMIN','TEACHER'].includes(role))throw new Error('未知角色');
   if(role==='TEACHER'&&!teacherIds.has(teacherId))throw new Error('教師 ID 不存在：'+teacherId);
   output.push({email,role,teacher_id:role==='ADMIN'?'':teacherId,is_active:raw.is_active===true});
  }
  if(!output.some(x=>x.role==='ADMIN'&&x.is_active))throw new Error('至少保留一位啟用的系辦管理員');
  ftvWriteRows_(table,output);
  return ftaTablePublic_();
 });
}
