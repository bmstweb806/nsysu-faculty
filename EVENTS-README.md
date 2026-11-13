# 護理學系活動日程｜Google Sheets → GAS → GitHub Pages → RPage

本模組新增到既有 `nsysu-faculty` 儲存庫，不會影響原有教師頁面。

## 檔案
- `events.html`：活動表格（搜尋、對象/類別/年份篩選、響應式）。
- `data/events.json`：目前已發布的活動快照，前端讀取此檔。
- `gas/Code.gs`：貼到該 Google Sheet 的「擴充功能 → Apps Script」。
- `rpage-events-embed.html`：貼到 RPage HTML 區塊的嵌入範例。

## 資料來源
Google Sheet：
https://docs.google.com/spreadsheets/d/1fzyEAfJw1BsyWRvVrF1VnCmQQPseMoqLOjY_3RvBplY/edit

已預先整理護理學系公開頁面列出的 15 筆 2026 年活動，初次上線請由管理者再核對。

## 首次啟用發布
1. 使用 `bmstweb806@gmail.com` 開啟上面的 Google Sheet。
2. 點 **擴充功能 → Apps Script**，將 `gas/Code.gs` 全部複製到預設 `Code.gs`，儲存。
3. GAS 專案設定將時區設為 **Asia/Taipei**。
4. GitHub 使用者 `bmstweb806` 建立 fine-grained personal access token：僅授權 `nsysu-faculty` repository，`Contents: Read and write`。
5. GAS **專案設定 → 指令碼屬性** 新增 `GITHUB_TOKEN` 並貼入 token。**絕不將 token 放進 Sheet 欄位、GitHub、HTML、RPage。**
6. 重新整理 Google Sheet，會出現 **活動日程發布** 選單。
7. 先選 **檢查資料**，再選 **發布正式 JSON**；第一次需同意 Apps Script 的 Google 權限。
8. GitHub Pages 網址： https://bmstweb806.github.io/nsysu-faculty/events.html
9. 在 RPage HTML 區塊貼入 `rpage-events-embed.html` 的內容，或先貼單純的 iframe 測試環境限制。

## 維護規則
- 一列一筆；活動 ID 不可重複，編輯時不要改 ID。
- 日期為 `YYYY-MM-DD`，活動時間可填 `1600-1800` 或 `16:00–18:00`。
- 「是否發布」填 **是** 才會輸出，填 **否** 會保留於試算表但不發布。
- 網頁按日期及「顯示順序」排序，Google Sheet 的列順序不影響網站。
- GAS 只會覆蓋 `data/events.json`，不會修改其他網頁。
- 網站已存在一份初始 JSON；之後每次要反映新資料，都要按 **發布正式 JSON**。
- 如果 RPage 不允許執行 script，高度自動調整可能失效；可只用 iframe 固定高度。
