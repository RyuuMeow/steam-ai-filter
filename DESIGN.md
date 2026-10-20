# 設計與實作

參考使用者提供的 slider 圖：白色卡片、柔和陰影、粗軌道、白色長方形滑塊、四個吸附點。只有拉桿承擔等級的視覺變化，移除 Auto／Manual。文字與色彩共同表達等級。

主操作是調整等級；次要資訊是目前規則；頁面數量及例外管理放在卡片外。無 Tailwind、UI 框架、遠端字型或執行時套件。

Tokens 在 `public/tokens.css`：以參考圖藍色為基底，透過 refactoring-ui palette generator 生成藍、紫、冷灰色階。間距採 4/8/12/16/24/32，字級 12/14/16/20，字重 400/600。白色介面固定，不跟隨深色模式；Steam 內嵌提示採深色以融入商店。

## 邊界

- `src/core.ts`：純判斷、頁面證據抽取、設定正規化。
- `src/content.ts`：只在搜尋／app 路徑執行，監聽 DOM 變動、更新標示、處理原因及例外。
- `src/popup.ts`：四檔 slider、設定儲存、與目前分頁交換狀態。
- `public/`：manifest、樣式、彈窗 markup。
- `tests/`：政策測試與瀏覽器 fixture，API 替身只供測試／預覽。

Chrome 的 content scripts 依序載入 core.js、content.js；沒有背景 worker。資料保存在 chrome.storage.local，僅要求 storage 權限。manifest 限定 Steam 搜尋與詳情頁。

動態內容以 100ms 合併變更，搜尋卡片只重新抽取新增或標記為 dirty 的項目；被移除的卡片會從索引清除。插件 UI 放在 shadow root，避免它的更新反覆觸發頁面 observer。隱藏採專用 CSS class，恢復時移除該 class，不覆寫 Steam 原本的 display。

有意採保守讀取：不猜測封面是否為 AI、不掃描評論或一般描述中的「AI」、不將未揭露推定為無 AI。揭露區塊必須具有符合的正式標題，因為成人內容與 AI 揭露可能共用 HTML ID。

## 實際觀察（2026-10-20）

- Steam 搜尋：每款卡片有 `data-ds-appid` 與部分 `data-ds-tagids`。側欄的 `data-value="7926"` 對應 Artificial Intelligence，但側欄不作為個別遊戲證據。
- 詳情頁：`.glance_tags[data-appid] .app_tag` 屬於該遊戲。
- 揭露容器：`#game_area_content_descriptors.game_area_description`；英文 `AI Generated Content Disclosure`、繁中 `AI 生成內容聲明`、簡中 `AI 生成内容披露`。

來源：[Steam 搜尋](https://store.steampowered.com/search/?tags=7926&l=english)、[揭露頁實例](https://store.steampowered.com/app/4517370/EULA_2026/?l=english)。
