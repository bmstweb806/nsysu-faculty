const params = new URLSearchParams(location.search);
const teacher = params.get('teacher') || '';
const lang = params.get('lang') === 'en' ? 'en' : 'zh';
if (/^[A-Za-z0-9_-]{2,40}$/.test(teacher)) {
  location.replace('/teachers/' + encodeURIComponent(teacher) + '/' + lang);
} else {
  document.getElementById('message').textContent = '請選擇有效的教師頁面。';
}
