# Cloudflare 遷移：staging 實作

目前 Worker API、密碼認證、管理介面、公開嵌入程式及資料匯入已建立於 staging。部署與驗收進度請見 [DEPLOYMENT.md](DEPLOYMENT.md)。新版教師總覽位於 https://nsysu-bmst-faculty.pages.dev/ ，管理後台為 /admin。正式 Rpage 切換與備份還原演練仍需另外驗收。

## Canonical model
- faculty_categories / section_definitions / field_definitions：分類、頁籤、欄位字典；穩定 key，停用代替刪除。
- teachers / teacher_translations：穩定教師 ID、分類、排序、公開聯絡資料及中英翻譯。archived_at 軟刪除。姓名、職稱、系所不因新增語系改表。
- teacher_entries / entry_translations / entry_field_values：一筆學術內容一個 ID。複合外鍵阻止把期刊欄位加到學歷。API 驗證欄位所屬區塊與網址格式。不得用任意 JSON 欄位存主資料。
- users / user_roles / user_teachers / sessions / pending_account_grants：帳號與教師資料分離；原 Sheets 權限以待啟用授權匯入，不產生初始密碼。伺服器檢查角色與教師授權。密碼使用版本化安全 KDF（含隨機 salt），session 僅存 token 雜湊。實作登入限速、CSRF、cookie Secure/HttpOnly/SameSite、登出/重設密碼撤銷 session。
- public_teacher_snapshots / public_config_snapshot：刻意反正規化的公開輸出，不是編輯來源。發布必須依 allowlist 清除隱藏欄位及隱藏語系，不可單純序列化整筆草稿。首頁最高學歷依第一筆 education 的內容及語系可見性衍生，不另存可編輯欄位。
- audit_logs：操作、操作者、教師 ID、時間；不得寫入密碼/session/私密內容。
- row_version / edit_token：樂觀鎖，更新需 compare-and-swap；整份教師資料更新、排序、發布、封存及 audit 使用 D1 原子 batch。排序按 sort_order 再依穩定 ID 排序；後端驗證完整 ID 清單。
- 首次新增教師、分類/公開語系/順序或設定改動需 ADMIN 正式發布。既已核准的教師可自行發布內容；保持既有公開分類、順序與政策，拒絕越權改動。封存須同一交易移除公開快照並停用相應教師存取；不刪歷史源資料。
- 公開 API 僅讀取快照，不可讀取草稿。全站設定、公開排序及對應教師快照一併交易更新；個別發布須採已公開的欄位設定。API 可維持原 schema_version=4 JSON 路徑，供 Rpage 無 iframe 使用。

## 維護
1. SQL migration 檔採遞增編號；已套用的 migration 不改寫，不用手工改 production schema。資料庫環境 dev/staging/prod 隔離。使用 D1 migration runner 並記錄版本，不重複執行 seed。
2. 正式匯入前從 Sheets 匯出全部教師（含 DRAFT、封存、雙語隱藏項目、權限設定），用 GitHub v4 正式 JSON 比對公開版本；不把 OTP、舊 token 或密碼匯入。匯入須可重跑並產出差異報告；不得將私密匯出提交 GitHub。
3. 每次 migration 前做備份；使用 D1 Time Travel 與受保護的 SQL 匯出。還原先在隔離環境演練。歷史版本/復原策略需完成後才正式上線。
4. 本機自動化測試涵蓋登入、限速、CSRF、權限、草稿隔離、發布、版本衝突及密碼變更。公開網址、實際登入、Rpage 六種列表與個人頁、UI 拖曳及備份還原仍需實際驗收。
5. 檔案與密碼雜湊備份同樣屬敏感資料；不在公開 repository 儲存實際資料庫匯出。
