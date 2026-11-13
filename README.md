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


## V3 可設定教師分類、Tab 與內容欄位（2026-11）

Google Sheets 資料庫：[NSYSU_Faculty_Database_V3](https://docs.google.com/spreadsheets/d/1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88/edit)

### Google Sheets 設定表

| 工作表 | 管理用途 |
|---|---|
| `FacultyCategories` | 教師分類：代碼、中英文名稱、排序、啟用狀態 |
| `Teachers` | 每位教師的 `category_key` 指向分類代碼；七位現有教師已分類 |
| `TabDefinitions` | 個人頁 Tab：代碼、中英文名稱、排序、固定與啟用狀態 |
| `FieldDefinitions` | 每個 Tab 的欄位：代碼、中英文名稱、欄位類型、排序、必填、啟用與公開 |
| `<teacher_sheet>` | 教師個別資料；`field_values_json` 儲存自訂欄位值 |

預設分類：`full_time`（專任教師／Full-time Faculty）、`adjunct`（合聘教師／Adjunct Faculty）、`retired`（榮退教師／Retired Faculty）。類別新增、命名與順序均可在試算表修改。

內容欄位可以使用 `text`、`textarea`、`url`、`number`、`date`。新增欄位只要在 `FieldDefinitions` 建立對應 `section_key`、`field_key` 與中英文名稱，**不必修改渲染用 JavaScript 或發布用 GAS**。新增 Tab 同樣可在 `TabDefinitions` 新增一列。

例如 `projects` 新增 `funding_agency`（補助／委託單位／Funding Agency），就會在管理編輯介面出現中文及英文欄位；其內容以 `field_values_json` 儲存，例如：

```json
{"funding_agency":{"zh":"國家科學及技術委員會","en":"National Science and Technology Council"}}
```

### 安裝動態管理介面到既有 V3 Apps Script

本 GitHub 儲存庫的以下檔案 **不會自動安裝到 Google Apps Script**：

- [gas/FacultyConfig.gs](gas/FacultyConfig.gs)：可設定的管理/資料操作功能，及覆蓋式 V3 JSON 發布。
- [gas/FacultyConfigManager.html](gas/FacultyConfigManager.html)：分類、Tab、欄位、教師內容編輯與發布的網頁管理介面。

安裝到與 V3 Sheet 綁定的 Apps Script 專案：

1. 建立 Script 檔 `FacultyConfig`，貼上 `gas/FacultyConfig.gs` 全文。
2. 建立 HTML 檔 `FacultyConfigManager`，貼上 `gas/FacultyConfigManager.html` 全文。
3. 在 **既有** 的 `onOpen()` 選單串接：
   ```javascript
   .addItem('分類／Tab／欄位設定（V3）', 'fcfgOpenConfig')
   .addItem('更新新版預覽 JSON', 'fcfgPublishPreview')
   .addItem('更新新版正式 JSON', 'fcfgPublishProduction')
   ```
   注意須加入原本 `createMenu(...)` 鏈中，且必須在 `.addToUi()` 之前，不要建立第二個 `onOpen()`。
4. 儲存並重新整理試算表，從選單開啟動態管理介面。
5. 若你原有獨立 Web App `doGet(e)`，可在它的開頭添加：
   ```javascript
   if (e && e.parameter && e.parameter.page === 'config') {
     return fcfgGetAdminHtml();
   }
   ```
   重新部署後，在原本 Web App 網址後加上 `?page=config` 可開啟設定管理介面。**請務必限制 Web App 存取權限**。

### JSON

`data/faculty.json`（正式）、`data/faculty-preview.json`（預覽）新增以下設定：

- `categories`：網站的分組名稱、順序與狀態。
- `tabs`：各老師個人頁面的標籤名稱、順序、啟用狀態。
- `fields`：各 Tab 中要如何顯示結構化欄位的名稱、順序、公開狀態。
- `teachers[].category_key`：教師所屬分類。
- `teachers[].sections[].entries[].fields`：每個內容項目的雙語欄位值。

**設定更新後仍須透過新版發布函式發布 JSON** 才會反映在 GitHub Pages。GitHub Pages 不會直接存取私人 Google Sheets。設定表及前端已更新；新的 GAS 功能需要先安裝並授權。

## 完整 GAS 來源程式（推薦安裝順序）

目前以 `gas/` 資料夾作為此專案的 **Apps Script 可複製來源碼**。四個檔案都已放在 GitHub，無機密金鑰：

| GitHub 檔案 | Apps Script 中建立的類型／名稱 | 功能 |
|---|---|---|
| [gas/Code.gs](gas/Code.gs) | 指令碼 `Code` | 唯一 `onOpen`、唯一 `doGet`、新增教師、自訂／修改教師 ID、雙語基本資料管理、連接 `FacultyConfig` 進行發布 |
| [gas/FacultyManager.html](gas/FacultyManager.html) | HTML `FacultyManager` | 教師基本資料、中英文內容、個人頁 Tab、教師身分類別 |
| [gas/FacultyConfig.gs](gas/FacultyConfig.gs) | 指令碼 `FacultyConfig` | 教師分類、動態 Tab／欄位定義、結構化內容編輯與新版 JSON 發布 |
| [gas/FacultyConfigManager.html](gas/FacultyConfigManager.html) | HTML `FacultyConfigManager` | 動態分類、Tab、欄位管理與內容編輯操作介面 |

安裝到 [V3 Google Sheets](https://docs.google.com/spreadsheets/d/1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88/edit) 所綁定的 Apps Script 專案時：

1. 將 `gas/Code.gs` 複製到專案中的 `Code.gs`（取代現有舊版 Code.gs）；確認只有一個 `onOpen()` 和 `doGet(e)`。
2. 新增指令碼 `FacultyConfig.gs`，貼上同名 GitHub 來源。
3. 新增 HTML `FacultyManager.html` 與 `FacultyConfigManager.html`，貼上各自內容。這是 **GAS HTML**，不是 GitHub Pages 根目錄的 `faculty.html`。
4. 在 Apps Script「專案設定 → 指令碼屬性」設定 `GITHUB_TOKEN`，僅放在 Apps Script Properties；**不要提交 Token 到 GitHub**。
5. 儲存並重新整理試算表，從「教師資料管理 V3」開啟「中英文分頁編輯器」或「教師分類／Tab／欄位設定」。
6. 若使用獨立 Web App，請部署**新版本**；後台預設 `/exec` 為教師編輯器，`/exec?page=config` 為動態設定介面。請將存取限制設定為管理者，不要公開可修改資料的 Web App。

### 請注意

- `Code.gs` 依賴 `FacultyConfig.gs`，兩者要**一起安裝**。此版本保留單一 `onOpen()` 與 `doGet(e)`。
- `Code.gs` 中 `ftvPublishPreview()`、`ftvPublishProduction()` 已改為呼叫設定驅動的 `fcfgPublishPreview()`、`fcfgPublishProduction()`。不要再貼上舊的固定八個 Tab 發布函式，否則可能覆蓋 JSON 設定。
- `FacultyManager.html` 是基礎雙語編輯介面，`FacultyConfigManager.html` 提供完整的自訂欄位編輯，並保存 `field_values_json`。
- `FacultyCategories`、`TabDefinitions`、`FieldDefinitions` 是**設定資料來源**；網站仍需透過 GAS 發布更新 JSON，才會顯示最新設定。
- GitHub `gas/` 檔案只是程式碼版本控管，**不會自動同步成已部署的 Apps Script**。

## 無 Hardcode 的分類、Tab 與欄位設定（最新規則）

`gas/Code.gs` 已移除原先 `FTV.definitions` 寫死的 8 個 Tab 清單，也不再把 `full_time` 寫死為預設身分。**設定資料的唯一來源是 Google Sheets**：

- `FacultyCategories`：新增、重新命名、排序、停用教師類別，並決定新增教師可用的預設類別（取啟用分類中排序最前者）。
- `TabDefinitions`：新增、重新命名、排序、停用任何 Tab（如學歷、研究計畫、新增的專利等）。
- `FieldDefinitions`：決定各 Tab 需要的中英文欄位、類型、排列順序與顯示狀態。
- `Teachers.category_key`：每位教師所屬的身分類別。

`ftvSetup()` **只會建立空白資料結構，不會內建或覆寫分類、Tab、欄位的預設值**。第一次建立空白資料庫後，請在上述設定表輸入至少一筆啟用分類和 Tab 才能建立教師；既有 V3 試算表則不需要重新初始化。

新增設定或更動欄位後，需在管理後台發布新版 JSON，GitHub Pages 才會跟著更新。欄位代碼（`section_key`, `field_key`, `category_key`）建立後應保持穩定；只修改名稱、排序與顯示狀態，以免既有教師資料失去對應。
