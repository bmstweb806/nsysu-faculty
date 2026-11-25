(function(){
  const url='https://nsysu-bmst-faculty.pages.dev/embed.js';
  if([...document.scripts].some(script=>script.src===url))return;
  const script=document.createElement('script');script.src=url;script.defer=true;
  document.head.append(script);
})();
