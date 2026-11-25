import { initTabs } from './tabs.js';
(function(){
  'use strict';
  const script=document.currentScript;
  const base=new URL(script.src).origin;
  const roots=[...document.querySelectorAll('[data-nsysu-faculty],[data-nsysu-faculty-profile]')].filter(root=>!root.dataset.nsysuLoaded);
  roots.forEach(root=>{root.dataset.nsysuLoaded='1'});
  const style=document.createElement('style');
  style.textContent='.nsysu-faculty-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.nsysu-faculty-card{border:1px solid #d8e2e9;padding:16px;background:#fff;color:#263847}.nsysu-faculty-card img{width:96px;height:120px;object-fit:cover;float:left;margin:0 14px 10px 0}.nsysu-faculty-card h3{margin:0 0 6px;color:#17618c}.nsysu-faculty-card p{margin:4px 0}.nsysu-faculty-card a{color:#17618c}.nsysu-faculty-profile{border-top:3px solid #17618c;padding-top:18px}.nsysu-faculty-section{clear:both;border-top:1px solid #d8e2e9;padding:15px 0}.nsysu-faculty-section h3{color:#17618c}.nsysu-faculty-entry{margin:9px 0}.nsysu-faculty-profile [hidden]{display:none!important}.nsysu-faculty-tabs{display:flex;gap:8px;overflow-x:auto;clear:both;padding:22px 0 10px;border-bottom:3px solid #17618c}.nsysu-faculty-tabs button{font:inherit;white-space:nowrap;cursor:pointer;border:1px solid #d5e2ea;border-radius:4px 4px 0 0;background:#eef4f8;color:#426278;padding:12px 20px;font-weight:600}.nsysu-faculty-tabs button[aria-selected=true]{background:#17618c;color:#fff;border-color:#17618c}.nsysu-faculty-tabs button:focus-visible{outline:3px solid #e8aa3a;outline-offset:2px}.nsysu-faculty-section{border-top:0;min-height:180px}.nsysu-faculty-card:after{content:"";display:block;clear:both}';
  document.head.append(style);
  const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);return el};
  const validUrl=x=>{try{const u=new URL(x);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}};
  const get=async path=>{const r=await fetch(base+path,{mode:'cors'});if(!r.ok)throw Error('資料讀取失敗');return r.json()};
  function card(t,lang,detail=false){
    const el=make('article');el.className='nsysu-faculty-card'+(detail?' nsysu-faculty-profile':'');
    if(validUrl(t.photo_url)){const img=make('img');img.src=t.photo_url;img.alt=t.name?.[lang]||'';el.append(img)}
    el.append(make('h3',t.name?.[lang]||''),make('p',t.title?.[lang]||''));
    if(t.unit?.[lang])el.append(make('p',t.unit[lang]));
    if(t.expertise?.[lang])el.append(make('p',t.expertise[lang]));
    if(t.highest_degree?.[lang])el.append(make('p',(lang==='en'?'Highest degree: ':'最高學歷：')+t.highest_degree[lang]));
    if(t.email){const a=make('a',t.email);a.href='mailto:'+t.email;el.append(a)}
    if(validUrl(t.profile_url)){const a=make('a',lang==='en'?'Official profile':'官方教師頁面');a.href=t.profile_url;a.target='_blank';a.rel='noopener noreferrer';const p=make('p');p.append(a);el.append(p)}
    return el
  }
  async function render(root){
    const lang=root.dataset.lang==='en'?'en':'zh';
    try{
      if(root.hasAttribute('data-nsysu-faculty-profile')){
        const id=root.dataset.teacher||new URL(location.href).searchParams.get('teacher');
        if(!/^[A-Za-z0-9_-]{2,40}$/.test(id||''))throw Error('教師 ID 無效');
        const [data,cfg]=await Promise.all([get('/data/teachers/'+encodeURIComponent(id)+'.json'),get('/data/faculty-config.json')]);
        const t=data.teacher;if(!t?.visible?.[lang])throw Error('此語言版本尚未公開');
        const profile=card(t,lang,true),panels=make('div'),tabs=make('div');
        tabs.className='nsysu-faculty-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',lang==='en'?'Faculty information':'教師資料分頁');panels.append(tabs);
        for(const tab of cfg.tabs.filter(x=>x.is_active)){
          const section=(t.sections||[]).find(s=>s.key===tab.key);
          const entries=(section?.entries||[]).filter(x=>x.visible?.[lang]);
          if(!tab||!entries.length)continue;
          const key='nsysu-'+id+'-'+roots.indexOf(root)+'-'+tab.key,button=make('button',tab[lang]+' · '+entries.length);
          button.type='button';button.id=key+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',key);tabs.append(button);
          const box=make('section');box.id=key;box.className='nsysu-faculty-section';box.setAttribute('role','tabpanel');box.setAttribute('aria-labelledby',button.id);box.tabIndex=0;box.hidden=true;box.append(make('h3',tab[lang]));
          for(const e of entries){const row=make('div');row.className='nsysu-faculty-entry';if(e.title?.[lang])row.append(make('strong',e.title[lang]),make('br'));if(e.content?.[lang]){const content=make('div',e.content[lang]);content.style.whiteSpace='pre-wrap';row.append(content)}for(const f of cfg.fields.filter(f=>f.section_key===section.key&&f.is_active&&f.show_public)){const value=e.fields?.[f.key]?.[lang];if(value)row.append(make('div',(f[lang]||f.key)+'：'+value))}if(validUrl(e.url)){const a=make('a',lang==='en'?'Link':'連結');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';row.append(make('span',' '),a)}box.append(row)}
          panels.append(box)
        }
        profile.append(panels);root.replaceChildren(profile);initTabs(panels)
      }else{
        const category=root.dataset.category||'full_time',data=await get('/data/faculty-index.json');
        const list=make('div');list.className='nsysu-faculty-list';
        for(const t of data.teachers.filter(x=>x.category_key===category&&x.visible?.[lang]))list.append(card(t,lang));
        root.replaceChildren(list)
      }
    }catch(e){root.textContent=lang==='en'?'Faculty information is unavailable.':'教師資料暫時無法顯示。'}
  }
  roots.forEach(render)
})();
