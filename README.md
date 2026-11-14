## V6：教師 JSON 分檔＋Google Sheets 管理員快速登入（2026-11-14）

### 公開資料拆分（已提交 GitHub）

- `data/faculty-index.json`：供教師列表使用的輕量資料；含分類、教師基本資料和 Google Sheets 順序，**不含學術個人頁的 sections**。
- `data/faculty-config.json`：個人頁共用 Tab、欄位定義。
- `data/teachers/{teacher_id}.json`：每位老師獨立的完整個人頁資料。教師個人頁只下載自己的 JSON 和共用設定。
- `data/preview/...`：對應的預覽版索引／設定／教師 JSON，會在 GitHub 上**公開可讀**，絕不可放需要保密的草稿資料。
- 首次已由現有正式／預覽合併 JSON 產生七位老師的分檔；前端 `assets/faculty.js` 已改成優先讀取 V6 分檔。當分檔尚未發布且索引為 HTTP 404 時，才使用既有 V3 合併 JSON 退回顯示。
- 目前正式索引原始檔約 **6.9 KB**，相較原本 **25.9 KB** 合併 JSON，列表頁減少約 74% 原始下載量；實際網路傳輸仍依壓縮與快取而異。
- GAS `fcfgPublish_` 已改為使用 GitHub Git Trees + Commit API：**將整批 JSON 以同一個 Git commit 發布**，並刪除不再存在的個人檔。實際相同的個人檔內容不會因別位老師更新而改變。
- **相容提醒**：舊的 `data/faculty.json` 和 `data/faculty-preview.json` 目前保留作為遷移退回來源，但新 V6 發布流程不再更新它們。整合新頁面請改讀分檔，勿長期依賴舊路徑。

### 管理員 Google 帳號快速登入（已提交 GAS 原始碼）

- **從 Google Sheet 選單進入管理頁**：GAS 使用 `Session.getActiveUser().getEmail()` 取得 Google 實際提供的帳號，並在伺服器重新對照 `UserPermissions` 中的 **ADMIN** 白名單。成功時為該使用者建立六小時 Session，頁面直接開啟管理介面，不再另外寄 OTP。
- **若 Google 不提供可信 Email**（例如部分帳號或執行情境），即使正在登入 Google，也**不直接放行**，改顯示原有 Email OTP。
- **公開 Web App 的 `/exec` 與 `/exec?page=config` 仍採 Email OTP**：因以擁有者身分執行的 GAS Web App 無法保證知道訪客的 Google 身分。不可使用 `Session.getEffectiveUser()` 來授權訪客。若要讓所有公開 `/exec` 訪客使用真正的 Google 登入，還需要額外設定 Google Identity Services／OAuth Client ID、可用的網域來源與伺服器端 ID Token 驗證；本版**尚未提供這項跨網站 Google SSO**。
- 教師維持 Email 六位數 OTP；公開 API 均由伺服器 Session Token 與角色檢查保護，**不會因前端宣稱是 ADMIN 而取得權限**。
- 管理員用試算表選單快速登入的前提是對方本身有使用該 Google Sheet 選單的存取權；請只把試算表及 GAS 編輯權分享給可信的系辦管理員。

### 套用到正式 GAS

1. 將最新的五個檔案 `gas/Code.gs`、`gas/FacultyConfig.gs`、`gas/FacultyAuth.gs`、`gas/FacultyManager.html`、`gas/FacultyConfigManager.html` 同步到既有 Apps Script。
2. 已設定的 `AUTH_SECRET` 和 `GITHUB_TOKEN` **不需重設**。
3. 更新 Web App 部署版本。先用 Sheets 選單登入管理員，確認能否自動辨識，若未辨識則使用原本 OTP；再用公開 `/exec` 驗證 OTP。
4. 正式與預覽各執行一次發布，確認 GitHub 的 index、config、七位教師個別 JSON 及中英文頁面都正常。注意第一次發布使用了新的 GitHub API 寫入流程，需確認 Token 仍有 Repository Contents 寫入權限。
5. 上線前確認每位老師個別資料沒有私人內容、教師登入不可讀取其他老師、非 ADMIN 不可發布。GitHub Pages 與 GAS Web App 的真實端到端操作尚待驗收。

---

## V5.2：OTP 固定期限與重新寄送倒數（2026-11-14）

- **驗證碼效期固定 5 分鐘**：由伺服器在產生驗證碼時記錄 `expiresAt`，每次驗證先確認是否已過期。輸錯驗證碼時重新寫入 ScriptCache，僅保留剩餘秒數，不延長原始期限；驗證成功即刪除。
- **重新寄送間隔 90 秒**：伺服器透過 `CacheService.getScriptCache()` 的 `cool:` 紀錄限制同一信箱的下一次寄信；教師與系辦登入頁均有倒數提示及按鈕停用。重新寄送會使先前的驗證碼失效，最新驗證碼有獨立的 5 分鐘有效期。
- **寄信限制**：同一信箱每小時最多五次，系統每日最多 60 封，另受 Google MailApp 寄信配額限制。對尚未授權、冷卻中或已達上限的信箱，API 仍回傳相同的通用訊息，避免公開可登入帳號清單。
- `ScriptCache` 是暫存，不提供強一致或持久化保證；若 Google 提前移除冷卻紀錄，90 秒限制可能提早失效。需要嚴格保證時可改成持久化的速率限制儲存。
- **同步提醒**：此次只提交 GitHub，正式 Apps Script 仍須更新 `FacultyAuth.gs`、`FacultyManager.html`、`FacultyConfigManager.html` 並重新部署新版本。已設定的 `AUTH_SECRET` 與 `GITHUB_TOKEN` 無需重設。

## V5.1：Google Sheets 發布選單安全修正（2026-11-14）

- Google Sheets 的「教師資料管理 → 開啟網站發布管理（Email 驗證）」會開啟 `FacultyConfigManager`，必須以 ADMIN 信箱完成 OTP 登入，再按左側「發布網站」操作正式或預覽發布。
- 原本的 `ftvPublishProduction` 和 `ftvPublishPreview` 已改為相容轉接函式：**只開啟須登入的發布管理視窗，不會繞過驗證直接發布**。更新版 `fcfgPublishProduction(token)`、`fcfgPublishPreview(token)` 在伺服器上檢查 ADMIN Session。
- **本次已更新 GitHub 原始碼，尚未自動同步到正式 Apps Script**。正式環境仍須同步五個 GAS 檔案，初始化 `AUTH_SECRET`、更新 Web App 部署並測試。
- 正式驗收：用 ADMIN 收取真實郵件驗證碼並發布預覽 JSON；用 TEACHER 驗證碼登入確認只看到自己、不可調用 ADMIN 發布功能；確認登出／錯誤驗證碼／過期驗證碼的行為。測試請避免發布未授權公開的草稿或私密教師內容。

## V5：Email 驗證碼登入與教師權限（2026-11-14）

- [可操作登入預覽](https://bmstweb806.github.io/nsysu-faculty/admin-preview.html)（示範帳號：`demo.admin@example.com`／`demo.teacher@example.com`；示範驗證碼 `123456`，**僅限 GitHub Pages 預覽，正式版不接受此驗證碼**）
- GAS 新增 [gas/FacultyAuth.gs](gas/FacultyAuth.gs)：真實 OTP 郵件、短效工作階段、角色檢查、寄信限制與帳號管理。
- Google Sheets 新增 `UserPermissions`：`email, role, teacher_id, is_active`。已根據現有教師資料建立七位教師的對應紀錄，並以 `bmstweb806@gmail.com` 為初始系辦管理員。**啟用前請核對老師實際能收信的地址**，特別是 `g-mail.nsysu.edu.tw`。
- 教師登入後只會看到自己的資料。GAS 在 `ftvGetBootstrap`、`ftvGetTeacher`、`ftvSaveTeacher` 等函式再次檢查登入憑證，教師不能改教師 ID、分類、發布狀態及語言公開設定。
- 系辦 ADMIN 可管理所有教師、分類、欄位和正式／預覽 JSON 發布。新增教師、修改教師 ID、修改分類與發布都必須有 ADMIN 工作階段。
- 教師修改資料後仍須系辦發布 JSON，公開網站才會更新。

### 必須完成的正式安裝

1. 在既有試算表「擴充功能 → Apps Script」將 GitHub `gas/` 下**五個檔案**全部同步到同名 GAS 專案檔案：`Code.gs`、`FacultyConfig.gs`、`FacultyAuth.gs`、`FacultyManager.html`、`FacultyConfigManager.html`。**不要混用舊版**；舊版函式未加入權限檢查。
2. 在 Apps Script 編輯器以專案擁有者帳號執行一次 `ftaInitializeSecret_`，授權所需權限。此函式會建立至少 32 字元的 `AUTH_SECRET` Script Property，**不會將秘密寫入 GitHub**。
3. 在「專案設定 → 指令碼屬性」確認 `AUTH_SECRET` 已存在，並確認 `GITHUB_TOKEN` 僅存於 Script Properties。不要把密碼、OTP、工作階段 Token 或 GitHub Token 放在 Sheets、HTML 或 GitHub。
4. 核對 `UserPermissions` 每一列 Email 與教師 ID，必要時修改；保留至少一位有效的 ADMIN。**請勿把試算表的編輯權分享給老師**，老師只能透過 Web App 編輯。
5. 部署 Apps Script Web App：**以擁有者身分執行**；存取權需允許老師的非 Google Workspace 帳號使用。不同帳號／部署政策可用的存取選項可能不同；若無法允許無 Google 帳號者使用，需改用可公開連線的獨立驗證後端，不能直接把管理函式放到 GitHub Pages。
6. 管理後台網址 `/exec`，系辦分類設定網址 `/exec?page=config`。以系辦信箱實測寄送 OTP、管理所有教師、發布；再用一位老師信箱實測只能編輯自己的資料。
7. 正式驗證碼為隨機六位數，5 分鐘到期，最多錯 3 次；90 秒寄送冷卻、每信箱每小時最多 5 次、全系統每日最多 60 封（仍受 Apps Script 寄信配額限制）。登入工作階段最多 6 小時，登出後會撤銷快取憑證。**這些安全機制尚需在實際 GAS 部署中進行端到端測試。**

### 安全邊界

- 公開 GitHub Pages 的 `admin-preview.html` 是**純模擬**，不連 Google Sheets、不寄信、不會取得正式權限；請勿拿來當正式登入入口。
- 正式 OTP、權限與工作階段由 GAS 伺服器處理。所有具權限的 Web App API 都需攜帶工作階段 Token；伺服器會在每次呼叫時重新檢查 `UserPermissions`。
- GAS 編輯器與原始 Google Sheets 必須只分享給系辦可信任的管理員；具有 Apps Script 專案編輯權的人可以修改程式碼，這不受 Web App 權限限制。
- `CacheService` 是暫存機制，若快取提前被清除，使用者需要重新登入；不是永久的工作階段資料庫。
- 老師登入信箱不一定要與公開個人頁的 `email` 相同，權限一律以 `UserPermissions` 為準。


---

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
5. 教師管理後台的內容採**一列一項的收合清單**，開啟任何教師或 Tab 時所有項目預設收合，只顯示細長的標題列和箭頭。點箭頭才可編輯；左側可以按「＋新增分類」建立任意學術分類（內部代碼自動產生），現有學歷、經歷、研究計畫、學術著作等分類會保留；右上角「＋新增」的項目**自動插在該 Tab 第一筆**。後台也保留拖曳排列和展開後的高度調整，按「儲存變更」即寫回 Google Sheets 的列順序。
6. **公開教師個人頁的學術內容採單欄清單（List）呈現，不顯示卡片、拖曳或縮放控制。** 只有具權限的 GAS 教師管理後台可操作卡片拖曳／縮放，並儲存順序至 Google Sheets。
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
| [gas/FacultyManager.html](gas/FacultyManager.html) | 簡化管理頁，左側「＋新增分類」、內容預設收合的單列項目、新項目排最前、拖拉／展開後調整高度 |
| [gas/FacultyConfig.gs](gas/FacultyConfig.gs) | 分類、Tab、欄位設定及 JSON 發布（限管理員） |
| [gas/FacultyAuth.gs](gas/FacultyAuth.gs) | Email 驗證碼、登入工作階段與權限控管 |
| [gas/FacultyConfigManager.html](gas/FacultyConfigManager.html) | 直接管理分類、Tab、欄位的設定頁 |

### 安裝到 Apps Script

1. 在 [V4 Google Sheets](https://docs.google.com/spreadsheets/d/1GcASm8dqMEIwhUMI9oncipCSllrml0NSY-DqjlGcD88/edit) 點「擴充功能 → Apps Script」。
2. 用本倉庫 `gas/Code.gs` 全文取代原本的 Code.gs。
3. 把 `gas/FacultyConfig.gs` 與 `gas/FacultyAuth.gs` 分別貼到同名的 Apps Script 指令碼，並依 V5 安裝步驟初始化 AUTH_SECRET。
4. 把 `gas/FacultyManager.html` 與 `gas/FacultyConfigManager.html` 分別貼進同名的 Apps Script HTML 檔案。
5. 在「專案設定 → 指令碼屬性」設定 `GITHUB_TOKEN`（GitHub fine-grained PAT，必須有此 repo Contents 寫入權限），**絕對不要將 Token 貼到 GitHub**。可選填 `GITHUB_REPO`。
6. 儲存並重新整理 Google Sheets。試算表選單「教師資料管理」會有教師編輯器、分類／Tab／欄位設定、正式與預覽發布功能。
7. 若使用獨立 Apps Script Web App，需在「部署 → 管理部署」更新成**新版本**：`/exec` 為教師編輯器，`/exec?page=config` 為系辦設定頁。請依 V5 說明設定 Web App 存取權，並透過 Email OTP 驗證與 GAS 伺服器端權限控管；不要將 Google Sheets 分享給教師。

⚠️ **僅更新 GitHub 原始碼不會更新已部署 GAS。** 目前 GitHub 主分支包含新版程式；需手動複製到 Apps Script 專案，儲存並重新部署。請勿混用前一版的含 `entry_id`／`sort_order` 函式。

### 操作範例：新增研究計畫

在管理後台選擇教師 → 點左側「研究計畫」→ 已有項目預設是收合的一列窄條，按箭頭展開編輯。按「＋新增研究計畫」會**立即在最上面插入一筆並自動展開**；可輸入中英文內容，拖動 ⠿ 調整順序，按「儲存變更」同步到試算表。不用填 ID 或排序數字。若需要「專利」等新分類，按左側「＋新增分類」輸入中英文名稱即可（技術代碼由 GAS 自動產生）。

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


## 教師後台 HTML 互動預覽

- [直接開啟模擬後台（GitHub Pages）](https://bmstweb806.github.io/nsysu-faculty/admin-preview.html)
- [預覽版 HTML 原始碼](admin-preview.html)
- [正式 GAS 後台來源碼](gas/FacultyManager.html)

`admin-preview.html` 由實際 `FacultyManager.html` 複製而來，包含靜態的公開資料快照和僅在瀏覽器記憶體中運作的模擬 GAS 呼叫。可以體驗選教師、編輯、各學術 Tab 的新增項目、卡片拖曳和縮放。

**請勿將 `admin-preview.html` 當成正式管理後台部署。** 它不會連線 Google Sheets、不含 GitHub Token、不會寫入資料。模擬儲存僅作用於當次頁面，重新整理後還原。正式後台仍需安裝 `gas/Code.gs`、`gas/FacultyConfig.gs` 與對應的 HTML 並限制登入權限。


## 最新後台 UI 調整（2026-11-14）

- 單欄、每筆獨立一列，預設**全部收合**：僅保留 42px 左右的標題細條、箭頭和拖曳把手。沒有任何設定欄位露出。
- 點右側箭頭才展開內容；展開後可拖曳右下角調整編輯高度。
- 左側原有分類從 `TabDefinitions` 讀取；可按「＋新增分類」即時建立新 Tab，不需要手動建立 ID。
- 各分類內按「＋新增」，一律新增到該分類的**第一筆**，方便以最新資料為優先。
- [互動預覽](https://bmstweb806.github.io/nsysu-faculty/admin-preview.html) 僅用本頁模擬資料，重新整理即可復原。
- 這次只更新 GitHub 的 GAS 來源及後台預覽，**尚未安裝／重新部署到真實 Apps Script**；請同步複製最新 `gas/FacultyManager.html` 和 `gas/FacultyConfig.gs` 後部署。
