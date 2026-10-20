# 設計與實作

保留使用者指定的粗軌道、白色長方形滑塊、四個吸附點及隨等級變化的色彩、柔光與短暫流光。文字與色彩共同表達等級。

v0.4.1 依 ui-subtraction 精簡彈窗：320px 白色單一表面，移除外層卡片、STEAM 字樣及標題中重複的檔位；主操作是拉桿，規則緊接其後。頁面數量與暫時顯示只在適用時出現；查詢細節、快取清除及例外名單合併至原生 details「管理」。清除結果使用操作旁的即時狀態，按鈕保留動作名稱。其他網站不顯示開啟商店的常駐指示；Steam 連線失敗才提供重新整理提示。無 Tailwind、UI 框架、遠端字型或執行時套件。

Tokens 在 `public/tokens.css`：以參考圖藍色為基底，透過 refactoring-ui palette generator 生成藍、紫、冷灰色階。彈窗使用 14px 正文／控制標籤與 16px 標題，字重 400/600；不保留說明的固定高度。白色介面固定，不跟隨深色模式；Steam 內嵌提示採深色以融入商店。原生 range、details、按鈕保留鍵盤操作與焦點樣式，沿用減少動畫設定。

## 邊界

- `src/core.ts`：純判斷、頁面證據抽取、設定正規化。
- `src/lookup.ts`：無 DOM 的披露解析、持久快取、請求合併、併發與退避；依賴可替換以供離線測試。
- `src/background.ts`：Manifest V3 service worker，驗證訊息來源，連接查詢器、fetch 與本機儲存。
- `src/content.ts`：在整個 Steam 商店網域執行，監聽 DOM 變動、更新標示、處理原因及例外。
- `src/mask.ts`：保留卡片位置與尺寸的純色遮罩；儲存並恢復原來的無障礙屬性，阻止被覆蓋內容的互動。
- `src/popup.ts`：四檔 slider、設定儲存、與目前分頁交換狀態。
- `public/`：manifest、樣式、彈窗 markup。
- `tests/`：政策測試與瀏覽器 fixture，API 替身只供測試／預覽。

Chrome 的 content scripts 依序載入 lookup.js、core.js、mask.js、content.js。資料保存在 chrome.storage.local，要求 storage 與 Steam 商店的主機權限；腳本注入與背景訊息驗證均涵蓋整個 store.steampowered.com，不再白名單頁面路徑。pageKind 只標示頁面類型，不控制是否掃描。lookup.js 在內容腳本中只使用快取驗證函式，實際 Resolver 在背景 worker 中運作，跨分頁共用佇列。彈窗可以清除查詢快取。

動態內容以 100ms 合併變更，搜尋卡片只重新抽取新增或標記為 dirty 的項目；被移除的卡片會從索引清除。插件 UI 放在 shadow root，避免它的更新反覆觸發頁面 observer。遮蔽採絕對定位的純色覆蓋層，原卡片子元素保留布局但變成透明及 inert。絕對定位輪播保留其 position，只有 static 卡片補上 relative。恢復時移除遮罩並還原 aria／inert，不覆寫 Steam 原本的 display。

所有頁面在整份 document 尋找帶有圖片／影片／行內背景的 app 連結或單一 App ID／item key 容器，也涵蓋既有文字式列表。排除導航、組合包及外站，不依賴 home/search 根容器。向上合併推薦圖組時要求新增資產的 URL App ID 相同或父容器有明確同款 ID，並在混合遊戲列表與頁面根節點停止。祖先分析每次掃描共用快取，避免逐卡重做大容器分析；刪除巢狀重複候選。同一 app 共享當前正向訊號，重新合併時不保留已移除的 tag。400px 可視區排程與快取適用所有卡片，包括詳情頁的其他遊戲；詳情頁本身不遮蔽。

背景只接受數字 App ID，自行組成固定 HTTPS 商品頁 URL，不接受任意網址。fetch 使用 credentials include 沿用現有 Steam 狀態、不追蹤 redirect，10 秒逾時；不讀取 cookie 值、不自動填寫年齡。HTML 僅做文字解析、不插入頁面。陰性結果需同時確認 og:url 的 App ID、商品標題、介紹區塊與完整結尾；年齡驗證或未知結構不會產生陰性快取。只認正式 descriptor 區塊及 AI 標題，不從一般介紹文字推測。新快取帶 sessionAware 標記；升級忽略舊匿名查詢的 unavailable 紀錄，但保留 Steam 限流等待時間。

快取分 disclosed／not-found／unavailable，TTL 分別為 7 天／1 天／5 分鐘；最多 500 筆，每筆披露最多 2000 字元。版本化快取只接受合法且未過期的紀錄。寫入序列化，避免兩個請求互相覆蓋。請求間隔至少 700ms，最大併發 2、等待佇列 32，同 ID 合併；429／503 全域退避與快取一起儲存。未開始的佇列於關閉過濾時取消，進行中的 fetch 同時 abort；清除快取使用世代編號避免舊請求回填。

內容腳本每次渲染合併有效快取，不讓過期結果持續遮蔽。快取變更由 storage.onChanged 傳到其他分頁，首屏之外也能立即套用既有結果。未知遊戲在查詢期間保留可見，結果回來後依原本四檔規則處理；未找到披露與讀取失敗分開計數，不顯示「無 AI」。

v0.1 的 manifest 與 adapter 都排除了首頁，這是使用者在首頁最高檔無效果的根因。v0.2 同時修正注入範圍、卡片辨識、彈窗頁面類型與狀態顯示。

v0.4 修正 v0.3 排除 sale 等路徑的設計，以及匿名查詢被年齡驗證頁擋住的問題。使用者截圖中的 3850550 匿名請求實際回傳 302 到 /agecheck/app/3850550/；5151540 公開頁能取得正式 AI 披露。新式卡片、推薦圖組和 React 容器重用由專用 fixture 驗證。

有意採保守讀取：不猜測封面是否為 AI、不掃描評論或一般描述中的「AI」、不將未揭露推定為無 AI。揭露區塊必須具有符合的正式標題，因為成人內容與 AI 揭露可能共用 HTML ID。

## 實際觀察（2026-10-20）

- Steam 搜尋：每款卡片有 `data-ds-appid` 與部分 `data-ds-tagids`。側欄的 `data-value="7926"` 對應 Artificial Intelligence，但側欄不作為個別遊戲證據。
- 詳情頁：`.glance_tags[data-appid] .app_tag` 屬於該遊戲。
- 揭露容器：`#game_area_content_descriptors.game_area_description`；英文 `AI Generated Content Disclosure`、繁中 `AI 生成內容聲明`、簡中 `AI 生成内容披露`。

來源：[Steam 搜尋](https://store.steampowered.com/search/?tags=7926&l=english)、[揭露頁實例](https://store.steampowered.com/app/4517370/EULA_2026/?l=english)。

- 首頁觀察：`.store_main_capsule` 推薦輪播、`.sale_capsule` 特惠、`.tab_row_item` 熱門列表帶有 app URL／tag IDs；新版圖片連結可能沒有 tag。包含 tag `7926` 的首頁遊戲曾在輪播與熱門列表各出現一次。
