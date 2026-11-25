const cards=[...document.querySelectorAll('[data-faculty-card]')];
const filters=[...document.querySelectorAll('[data-category-filter]')];
const search=document.querySelector('#faculty-search');
let category='all';
function update(){
  const query=search.value.trim().toLocaleLowerCase();let count=0;
  for(const card of cards){const show=(category==='all'||card.dataset.category===category)&&card.textContent.toLocaleLowerCase().includes(query);card.hidden=!show;if(show)count++;}
  for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.categoryFilter===category));
  document.querySelector('#result-count').textContent=String(count);
  document.querySelector('#empty-results').hidden=count!==0;
}
for(const button of filters)button.addEventListener('click',()=>{category=button.dataset.categoryFilter;update();});
search.addEventListener('input',update);update();
