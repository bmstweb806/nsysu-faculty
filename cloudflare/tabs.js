export function initTabs(container) {
  const tabs=[...container.querySelectorAll('[role="tab"]')];
  const panels=[...container.querySelectorAll('[role="tabpanel"]')];
  if(!tabs.length)return;
  const select=(tab,focus=false)=>{
    for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;}
    for(const p of panels)p.hidden=p.id!==tab.getAttribute('aria-controls');
    if(focus)tab.focus();
  };
  for(const [i,tab] of tabs.entries()){
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',event=>{
      let index;
      if(event.key==='ArrowRight')index=(i+1)%tabs.length;
      if(event.key==='ArrowLeft')index=(i+tabs.length-1)%tabs.length;
      if(event.key==='Home')index=0;
      if(event.key==='End')index=tabs.length-1;
      if(index!==undefined){event.preventDefault();select(tabs[index],true);}
    });
  }
  const target=tabs.find(t=>'#'+t.getAttribute('aria-controls')===location.hash);
  select(target||tabs[0]);
}
