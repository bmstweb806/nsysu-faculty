const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
const local=(value,locale)=>String(value?.[locale]||'');
const link=(url,label,className='')=>{const href=safeUrl(url);return href?'<a class="'+className+'" href="'+escape(href)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>':'';};
function publicTeacher(data,locale){
  const t=data?.teacher;
  if(data?.preview!==false||t?.publish_status!=='PUBLISHED'||t.visible?.[locale]!==true)throw Error('此語言尚未公開，無法匯出');
  return t;
}
export function renderRpageProfile(data,config,locale='zh',instanceId=''){
  const t=publicTeacher(data,locale),en=locale==='en';
  const prefix='bmst-'+String(instanceId||t.id+'-'+locale).replace(/[^A-Za-z0-9_-]/g,'-');
  const sections=(config.tabs||[]).filter(tab=>tab.is_active).map(tab=>({tab,entries:(t.sections||[]).find(s=>s.key===tab.key)?.entries.filter(e=>e.visible?.[locale]===true)||[]})).filter(s=>s.entries.length);
  const photo=safeUrl(t.photo_url);
  const hero='<div class="bmst-profile__hero">'+(photo?'<img class="bmst-profile__photo" src="'+escape(photo)+'" alt="'+escape(local(t.name,locale))+'" width="150" height="188" loading="lazy">':'<div class="bmst-profile__avatar" aria-hidden="true">'+escape(local(t.name,locale).slice(0,1))+'</div>')+'<div class="bmst-profile__identity"><h2 class="bmst-profile__name">'+escape(local(t.name,locale))+'</h2><p class="bmst-profile__title">'+escape(local(t.title,locale))+'</p>'+
    (local(t.unit,locale)?'<p class="bmst-profile__unit">'+escape(local(t.unit,locale))+'</p>':'')+
    (local(t.office,locale)?'<p class="bmst-profile__office">'+escape(local(t.office,locale))+'</p>':'')+
    (t.email?'<p class="bmst-profile__contact"><a href="mailto:'+escape(t.email)+'">'+escape(t.email)+'</a></p>':'')+
    link(t.profile_url,en?'Official profile ↗':'官方教師頁面 ↗','bmst-profile__link')+'</div></div>';
  const expertise=local(t.expertise,locale)?'<div class="bmst-profile__expertise"><strong>'+(en?'Research interests':'研究專長')+'</strong><div>'+escape(local(t.expertise,locale))+'</div></div>':'';
  const tabs=sections.length?'<div class="bmst-tabs" role="group" aria-label="'+(en?'Faculty information':'教師資料分類')+'">'+sections.map(({tab,entries},i)=>{
    const id=prefix+'-'+String(tab.key).replace(/[^A-Za-z0-9_-]/g,'-');
    return '<div class="bmst-tab"><input class="bmst-tab__input" type="radio" name="'+prefix+'-tabs" id="'+id+'"'+(i===0?' checked':'')+'><label class="bmst-tab__label" for="'+id+'">'+escape(local(tab,locale)||tab.key)+'<span class="bmst-tab__count">'+entries.length+'</span></label><div class="bmst-tab__panel"><h3 class="bmst-tab__heading">'+escape(local(tab,locale)||tab.key)+'</h3>'+entries.map(e=>{
      const fields=(config.fields||[]).filter(f=>f.section_key===tab.key&&f.is_active&&f.show_public&&local(e.fields?.[f.key],locale));
      return '<div class="bmst-entry">'+(local(e.title,locale)?'<h4 class="bmst-entry__title">'+escape(local(e.title,locale))+'</h4>':'')+
        (local(e.content,locale)?'<div class="bmst-entry__content">'+escape(local(e.content,locale))+'</div>':'')+
        (fields.length?'<dl class="bmst-entry__fields">'+fields.map(f=>'<dt>'+escape(local(f,locale)||f.key)+'</dt><dd>'+escape(local(e.fields[f.key],locale))+'</dd>').join('')+'</dl>':'')+
        link(e.url,en?'Related link ↗':'相關連結 ↗','bmst-entry__link')+'</div>';
    }).join('')+'</div></div>';
  return html.replace(/></g,'>\n<');
  }).join('')+'</div>':'';
  const html='<div class="bmst-faculty bmst-faculty--profile" lang="'+(en?'en':'zh-Hant')+'">\n'+hero+'\n'+expertise+'\n'+tabs+'\n</div>';
  return html.replace(/></g,'>\n<');
}
export function renderRpageList(index,category,locale='zh'){
  if(index?.preview!==false)throw Error('只能匯出已公開資料');
  const en=locale==='en';
  const teachers=(index.teachers||[]).filter(t=>t.publish_status==='PUBLISHED'&&t.visible?.[locale]===true&&(category==='all'||t.category_key===category));
  const html='<div class="bmst-faculty bmst-faculty--directory" lang="'+(en?'en':'zh-Hant')+'"><div class="bmst-directory">'+teachers.map(t=>{
    const photo=safeUrl(t.photo_url),categoryName=local(index.categories?.find(c=>c.key===t.category_key),locale);
    return '<div class="bmst-card"><div class="bmst-card__header">'+(photo?'<img class="bmst-card__photo" src="'+escape(photo)+'" alt="'+escape(local(t.name,locale))+'" width="96" height="120" loading="lazy">':'')+'<div>'+
      (categoryName?'<span class="bmst-card__category">'+escape(categoryName)+'</span>':'')+'<h3 class="bmst-card__name">'+escape(local(t.name,locale))+'</h3><p class="bmst-card__title">'+escape(local(t.title,locale))+'</p></div></div>'+
      (local(t.expertise,locale)?'<p class="bmst-card__expertise">'+escape(local(t.expertise,locale))+'</p>':'')+
      (local(t.highest_degree,locale)?'<p class="bmst-card__degree"><strong>'+(en?'Highest degree: ':'最高學歷：')+'</strong>'+escape(local(t.highest_degree,locale))+'</p>':'')+
      (t.email?'<p class="bmst-card__contact"><a href="mailto:'+escape(t.email)+'">'+escape(t.email)+'</a></p>':'')+
      link(t.profile_url,en?'View profile →':'查看教師個人頁面 →','bmst-card__link')+'</div>';
  }).join('')+'</div></div>';
  return html.replace(/></g,'>\n<');
}
