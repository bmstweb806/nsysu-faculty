const params = new URLSearchParams(location.search);
const teacher = params.get('teacher') || '';
const lang = params.get('lang') === 'en' ? 'en' : 'zh';
if (/^[A-Za-z0-9_-]{2,40}$/.test(teacher)) {
  location.replace('/teachers/' + encodeURIComponent(teacher) + '/' + lang);
} else {
  location.replace('/directory/' + lang);
}
