# NSYSU Faculty V3 / 國立中山大學雙語教師網頁

本儲存庫是教師公開網站前端（GitHub Pages）。教師資料由 [NSYSU_Faculty_Database_V3](https://docs.google.com/spreadsheets/d/1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88/edit) 管理，再透過 **Google Apps Script (GAS)** 發布成 JSON 到 `data/`。

## 網頁 / Pages

| 用途 | 網址 |
| --- | --- |
| 中文教師列表 | https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=zh |
| English faculty directory | https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=en |
| 中文教師個人頁面 | https://bmstweb806.github.io/nsysu-faculty/faculty.html?teacher=mjlee&lang=zh |
| English faculty profile | https://bmstweb806.github.io/nsysu-faculty/faculty.html?teacher=mjlee&lang=en |
| 草稿列表預覽 | https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=zh&preview=1 |
| 草稿教師預覽 | https://bmstweb806.github.io/nsysu-faculty/preview.html?teacher=mjlee&lang=zh |

URL 的 `teacher` 參數對應 `Teachers.teacher_id`；`lang` 為 `zh` 或 `en`。

### 檔案結構

- `index.html`：中英文列表入口
- `faculty-list.html`：雙語教師列表（卡片式）
- `faculty.html`：雙語教師詳情（八個固定順序內容 Tab）
- `preview.html`：未正式發布的草稿預覽頁面（noindex）
- `assets/faculty.css`：共同 Rpage 嵌入排版
- `assets/faculty.js`：雙語 JSON 讀取、篩選與動態高度
- `data/faculty.json`：正式 JSON
- `data/faculty-preview.json`：測試預覽 JSON（也是**公開**可存取）

## 資料結構

`Teachers` 工作表有 `teacher_id`、`teacher_sheet`、`name_zh`、`name_en`、`title_zh`、`title_en`、`unit_zh`、`unit_en`、`office_zh`、`office_en`、`expertise_zh`、`expertise_en`、`email`、`profile_url`、`photo_url`、`display_order`、`publish_status`、`visible_zh`、`visible_en`。

每個老師有自己的一張 `<teacher_id>_教師資料` 工作表；實際名稱以 `teacher_sheet` 欄為準，修改 ID 不應移動或重新命名教師資料工作表。

每張教師資料工作表的欄位：
`entry_id, section_key, entry_type, title_zh, title_en, content_zh, content_en, link_url, sort_order, visible_zh, visible_en`。

`TabDefinitions` 依序有：`education`、`experience`、`courses`、`projects`、`journal`、`conference`、`honors`、`service`。沒有任何已公開內容的 Tab 不顯示。

## 發布步驟

1. 在 V3 Google 試算表綁定的 Apps Script 中安裝 **V3 Code.gs** 和 **FacultyManager.html**。
2. 在 Apps Script 的「專案設定 → 指令碼屬性」設定 `GITHUB_TOKEN`；Token 必須有本儲存庫 Contents 寫入權限。不要將 Token 寫進程式碼或本儲存庫。
3. 進入試算表選單「教師資料管理 V3 → 發布預覽 JSON」，GAS 將建立/更新 `data/faculty-preview.json`（包含 DRAFT 教師，這是公開測試資料）。
4. 核對草稿列表及個人頁後，將審核通過的教師設為 `PUBLISHED`，再點選「發布正式 JSON」產生 `data/faculty.json`。
5. 使用中英文 Rpage 編輯器分別嵌入列表 iframe。

**目前正式及預覽 JSON 均為空白 V3 初始化檔。** 先前從中英文系網建立的 7 位教師在 Google Sheets 均標記為 `DRAFT`，因此尚未在網站正式顯示。更新後台資料不會自動推送到 GitHub；需執行 GAS 發布功能。

### Rpage 嵌入

中文：

```html
<iframe id="nsysu-faculty" src="https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=zh" title="教師列表" style="width:100%;height:700px;border:0;display:block" loading="lazy"></iframe>
<script>
window.addEventListener('message', function(e) {
  const frame = document.getElementById('nsysu-faculty');
  if (e.origin !== 'https://bmstweb806.github.io' || e.source !== frame.contentWindow) return;
  if (e.data && e.data.type === 'NSYSU_FACULTY_HEIGHT') {
    const h = Number(e.data.height);
    if (Number.isFinite(h) && h >= 100 && h < 30000) frame.style.height = h + 'px';
  }
});
</script>
```

英文只需將 `src` 改為 `https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=en`，`title` 改為 `Faculty directory`。每個 iframe 的 `id` 應避免重複；若同頁嵌入多個，請分別使用對應 ID 和 listener。

### 注意

- 只顯示 `visible_zh` / `visible_en` 為 TRUE 且該語言姓名有內容的教師。
- 正式檔只接受 `publish_status=PUBLISHED`。
- 如果英文項目沒有內容，英文個人頁不會直接使用中文替代；沒有可見項目的分頁會隱藏。
- 教師 ID 修改後，舊版 `?teacher=...` URL 不會自動重新導向。
- GitHub Pages 及預覽 JSON **皆屬公開資源**，不要放未授權公開的敏感或私人資料。
