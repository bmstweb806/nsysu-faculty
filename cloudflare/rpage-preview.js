const options = new URLSearchParams(location.search);
const root = document.getElementById('rpage-content');
const teacher = options.get('teacher');
const category = options.get('category');
root.dataset.lang = options.get('lang') === 'en' ? 'en' : 'zh';
if (teacher && /^[A-Za-z0-9_-]{2,40}$/.test(teacher)) {
  root.setAttribute('data-nsysu-faculty-profile', '');
  root.dataset.teacher = teacher;
} else if (!teacher && /^[A-Za-z0-9_-]{1,40}$/.test(category || '')) {
  root.setAttribute('data-nsysu-faculty', '');
  root.dataset.category = category;
} else {
  root.textContent = '請選擇有效的教師或分類。';
}
