# NSYSU Faculty — 雙語教師管理系統

使用 Google Sheets 管理資料、Apps Script 提供網頁後台並發布 JSON、GitHub Pages 呈現中英文教師列表和個人頁。**V4 簡化版：只有教師需要 ID；內容順序直接使用試算表列順序。**

## 線上網頁

- [中文教師名單](https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=zh)
- [English faculty directory](https://bmstweb806.github.io/nsysu-faculty/faculty-list.html?lang=en)
- [單一教師（中文示例）](https://bmstweb806.github.io/nsysu-faculty/faculty.html?teacher=mjlee&lang=zh)
- [單一教師（English example）](https://bmstweb806.github.io/nsysu-faculty/faculty.html?teacher=mjlee&lang=en)
- [V3/V4 Google Sheets 資料庫](https://docs.google.com/spreadsheets/d/1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88/edit)

## 重要設計原則

1. **只有 `Teachers.teacher_id` 是教師的識別碼。** 教師的個別學歷、研究計畫、著作和其他內容都沒有 `entry_id`。
2. **不使用 `display_order`、`sort_order` 或其他排序數字。** Google Sheets 的列順序就是顯示順序，包括教師、身分類別、Tab、欄位與老師的各筆學術內容。
3. 教師每個內容項目存一列，`section_key` 表示屬於哪一個 Tab；`section_key`、`field_key`、`category_key` 是設定的欄位代碼，**不是每筆內容的 ID**。
4. 研究專長位於 `Teachers.expertise_zh`／`expertise_en`，可直接使用換行或分隔符號，不需要逐項 ID。
5. 管理網頁支援「＋新增」各 Tab 的內容項目、拖曳卡片改變順序，以及從右下角縮放卡片。**儲存**後，拖曳順序寫入 Google Sheets 的實際列順序，尺寸寫入 `card_width`／`card_height`。
6. 公開網頁也可在本次瀏覽中拖動與縮放卡片，但不會改到 Google Sheets；只有具權限的 GAS 管理後台能儲存變更。
7. Google Sheets `FacultyCategories`、`TabDefinitions`、`FieldDefinitions` 是唯一設定來源。新增分類、Tab、欄位不用改 GAS 程式。

## Google Sheets 工作表

| 工作表 | 功能 |
| --- | --- |
| `Teachers` | 教師 ID、姓名、職稱、研究專長、中英文顯示及分類（直接依列順序排序） |
| `FacultyCategories` | 專任、合聘、榮退等分類；名稱及順序自由修改 |
| `TabDefinitions` | 個人頁的任意分頁，包括學歷、經歷、課程、研究計畫等 |
| `FieldDefinitions` | 各 Tab 的自訂欄位（雙語名稱、輸入類型、是否公開、是否必填） |
| 各老師自己的 `*_教師資料` | 每列一筆內容，使用 `section_key` 分類，其餘按列順序顯示 |

在教師個別工作表中主要編輯的欄位：

`section_key, entry_type, title_zh, title_en, content_zh, content_en, link_url, visible_zh, visible_en`。

以下為管理程式使用的技術欄位，預設已隱藏：`field_values_json, card_width, card_height`。如要手動查看，可以在 Google Sheets 取消隱藏欄位。教師工作表 `teacher_sheet` 也已隱藏，ID 修改不會重新命名工作表，避免既有資料斷線。

## GAS 完整來源（已上傳 GitHub）

| 檔案 | 用途 |
| --- | --- |
| [gas/Code.gs](gas/Code.gs) | 唯一 `onOpen`、`doGet`、教師資料讀寫、新增教師、保留列順序 |
| [gas/FacultyManager.html](gas/FacultyManager.html) | 簡化管理頁，教師資料、各 Tab 的「＋新增」、卡片拖拉／縮放 |
| [gas/FacultyConfig.gs](gas/FacultyConfig.gs) | 分類、Tab、欄位設定及 JSON 發布 |
| [gas/FacultyConfigManager.html](gas/FacultyConfigManager.html) | 直接管理分類、Tab、欄位的設定頁 |

### 安裝到 Apps Script

1. 在 [V4 Google Sheets](https://docs.google.com/spreadsheets/d/1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88/edit) 點「擴充功能 → Apps Script」。
2. 用本倉庫 `gas/Code.gs` 全文取代原本的 Code.gs。
3. 把 `gas/FacultyConfig.gs` 貼到名稱為 `FacultyConfig` 的指令碼。
4. 把 `gas/FacultyManager.html` 與 `gas/FacultyConfigManager.html` 分別貼進同名的 Apps Script HTML 檔案。
5. 在「專案設定 → 指令碼屬性」設定 `GITHUB_TOKEN`（GitHub fine-grained PAT，必須有此 repo Contents 寫入權限），**絕對不要將 Token 貼到 GitHub**。可選填 `GITHUB_REPO`。
6. 儲存並重新整理 Google Sheets。試算表選單「教師資料管理」會有教師編輯器、分類／Tab／欄位設定、正式與預覽發布功能。
7. 若使用獨立 Apps Script Web App，需在「部署 → 管理部署」更新成**新版本**：`/exec` 為教師編輯器，`/exec?page=config` 為設定管理頁。必須限制 Web App 僅授權管理者使用。

⚠️ **僅更新 GitHub 原始碼不會更新已部署 GAS。** 目前 GitHub 主分支包含新版程式；需手動複製到 Apps Script 專案，儲存並重新部署。請勿混用前一版的含 `entry_id`／`sort_order` 函式。

### 操作範例：新增研究計畫

在管理後台選擇教師 → 點「研究計畫」Tab → 「＋新增研究計畫」 → 展開卡片輸入計畫內容、中英文欄位 → 若需要，拖動卡片左上角的 ⠿ 換位、從卡片右下角縮放 → 點「儲存變更」。資料會依目前排列寫入該教師工作表，**不用填寫任何排序數字**。

## JSON 與發布

- `data/faculty.json`：正式資料，包含 `PUBLISHED` 教師。
- `data/faculty-preview.json`：測試資料，包含草稿與已發布教師；這份 JSON 同樣為公開存取。
- 這兩份 JSON 的 `teachers`、`categories`、`tabs`、`fields` 與各教師的 `entries` 都按照 Google Sheets 列順序輸出。
- 新版 `fcfgPublishProduction`、`fcfgPublishPreview` 是唯一正確的發布入口。修改 Sheet 之後必須再次發布 JSON 才會更新 GitHub Pages。
- 目前公開 JSON 已更新為簡化資料結構，保留 7 位教師。

## Rpage 嵌入單一教師

- [rpage/teacher-profile-zh.html](rpage/teacher-profile-zh.html)
- [rpage/teacher-profile-en.html](rpage/teacher-profile-en.html)

檔案只含 `<style>`、嵌入區塊和 `<script>`，可以複製到 Rpage HTML 原始碼編輯器，並修改 `teacher=mjlee` 為其他教師 ID。iframe 高度會配合頁面自動調整；若 Rpage 過濾 JavaScript，使用原本的固定高度。

## 權限與注意事項

- GAS 後台能編輯資料及發布內容，請勿開放「任何人」使用。
- 預覽檔也是公開的，不應儲存私人或未授權公開的敏感資料。
- 變更教師 ID 後，外部舊教師個人頁連結不會自動轉址。
- 以 Google Sheets 列順序為準，但同一教師的不同 `section_key` 會分別顯示在各自 Tab 中。
