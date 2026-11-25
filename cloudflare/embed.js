(function(){
  'use strict';
  const script=document.currentScript;
  const base=new URL(script.src).origin;
  const roots=[...document.querySelectorAll('[data-nsysu-faculty],[data-nsysu-faculty-profile]')];
  const style=document.createElement('style');
  style.textContent='.nsysu-faculty-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}.nsysu-faculty-card{border:1px solid #d8e2e9;padding:16px;background:#fff;color:#263847}.nsysu-faculty-card img{width:96px;height:120px;object-fit:cover;float:left;margin:0 14px 10px 0}.nsysu-faculty-card h3{margin:0 0 6px;color:#17618c}.nsysu-faculty-card p{margin:4px 0}.nsysu-faculty-card a{color:#17618c}.nsysu-faculty-profile{border-top:3px solid #17618c;padding-top:18px}.nsysu-faculty-section{clear:both;border-top:1px solid #d8e2e9;padding:15px 0}.nsysu-faculty-section h3{color:#17618c}.nsysu-faculty-entry{margin:9px 0}.nsysu-faculty-card:after{content:"";display:block;clear:both}';
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
    if(validUrl(t.profile_url)){const a=make('a',lang==='en'?'Official profile':'官方教師頁面');a.href=t.profile_url;a.target='_blank';a.rel='noopener noreferrer';el.append(make('p')).append(a)}
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
        const profile=card(t,lang,true);
        for(const section of t.sections||[]){
          const tab=cfg.tabs.find(x=>x.key===section.key&&x.is_active);
          const entries=section.entries.filter(x=>x.visible?.[lang]);
          if(!tab||!entries.length)continue;
          const box=make('section');box.className='nsysu-faculty-section';box.append(make('h3',tab[lang]));
          for(const e of entries){const row=make('div');row.className='nsysu-faculty-entry';if(e.title?.[lang])row.append(make('strong',e.title[lang]),make('br'));if(e.content?.[lang])row.append(make('span',e.content[lang]));if(validUrl(e.url)){const a=make('a',lang==='en'?'Link':'連結');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';row.append(make('span',' '),a)}box.append(row)}
          profile.append(box)
        }
        root.replaceChildren(profile)
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
