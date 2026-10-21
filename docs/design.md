# 設計與模組分工

插件以 Steam 商品頁的正式 AI 揭露及本機用途分類為依據。題材 tag 只可作原始來源說明，不參與命中判定。訊號不足時保持可見；不以遊戲名稱、一般描述、評論或圖片風格推定 AI 使用情形。使用行為與資料保存期限見 [使用說明](usage.md)，此文件說明實作邊界。

## 模組

| 模組 | 責任 |
|---|---|
| [i18n.ts](../src/i18n.ts) | 英文、繁中、簡中介面字典、語言選擇與持久訊息轉譯 |
| [core.ts](../src/core.ts) | 模式／設定相容轉換、卡片邊界、證據抽取與用途命中規則 |
| [disclosure-keywords.ts](../src/disclosure-keywords.ts) | 六項用途各自的本機英文、繁中、簡中關鍵字包與名稱 |
| [disclosure.ts](../src/disclosure.ts) | 分句、否定與翻譯對象排除，回傳正式揭露的用途集合 |
| [lookup.ts](../src/lookup.ts) | 商品頁文字解析、快取、請求去重、併發及退避 |
| [ignore.ts](../src/ignore.ts) | 帳號忽略佇列、結果確認、限速與失敗處理 |
| [background.ts](../src/background.ts) | MV3 service worker、訊息來源驗證及持久儲存 |
| [content.ts](../src/content.ts) | 頁面掃描、DOM 更新、卡片操作、原因與例外 |
| [mask.ts](../src/mask.ts) | 遮罩、隱藏、媒體停止與無障礙屬性還原 |
| [layout.ts](../src/layout.ts) | 專屬外層收起、已辨識水平輪播的連續捲動與還原 |
| [popup.ts](../src/popup.ts) | 四檔拉桿、分層設定導覽、設定保存與目前分頁狀態 |

`public/` 保存 manifest、CSS、彈窗 HTML 與圖示。無 UI 框架、遠端字型或執行時套件。`dist/` 是本機建置資料夾；`extension/` 是提交到 repo 的可安裝版本，打包時只允許公開資產和已編譯模組，不包含測試替身。

## 卡片與完整容器

所有商店路徑使用相同掃描邏輯；頁面類型只供顯示，不作注入白名單。辨識帶媒體的 app 連結、單一 App ID／item key、行內背景及常見文字卡片。排除頁面根節點、導航、組合包和外站，不跨越混合遊戲列表。

同款封面及截圖可合併。已觀察的 `LibraryAssetExpandedDisplay`、`carousel__slide`、`trailercarousel` 是完整遊戲物件的語意邊界，仍要求只有單一 app；預告片可能使用不同 movie ID，因此不能只靠媒體網址決定容器。

首頁的 `.home_content.single` 另有「因為您最近遊玩過」的文字連結。只在具有單一 `.home_content_items` 與標準標題結構時，排除 `.home_content_reason` 的純文字參照；其餘商品連結仍須對應同一 app。理由內若含圖片、影片或另一張遊戲卡片，便保留一般混合遊戲防護。標籤與揭露只取自目標商品圖組，避免參照遊戲污染判斷。

遮蔽覆蓋整個卡片並保留尺寸。隱藏使用可還原的 CSS class，不移除 Steam 管理的 DOM 節點；首頁 `.home_content_single_ctn` 只有在唯一子元素就是目標卡片時才一同收起。保留 DOM 可支援 React 重用、暫時顯示、例外與關閉還原。商品詳情的當前遊戲保留可見，同頁其他推薦照常過濾。

標準水平輪播隱藏後改為連續捲動，卡片尺寸仍按原百分比計算；左右箭頭依剩餘範圍操作，避免舊索引導向空白末頁。全部命中時整條收起。還原時釋放事件與樣式、恢復按鈕及 tabindex；未知結構不強行改寫。

## 生命週期

DOM 變更以 100ms 合併；只重新抽取新增或 dirty 卡片，移除已離頁節點。同 app 共享當前證據，重新合併時不保留已刪除的訊號。快取變更跨分頁同步，內容渲染會重新檢查有效期限。

Chrome 插件重新載入後，舊內容腳本可能失效。所有 API 呼叫處理同步拋錯與非同步拒絕；失效時停止 observer、timer、事件與回應回填，還原卡片及輪播，只留下刷新提示。未開啟 popup 造成的無接收端不視為失效。

## 查詢與判斷

背景只接受數字 App ID，自行組成固定 Steam 商品頁 URL。沿用瀏覽器既有 Steam 狀態，不讀 cookie 值、不追蹤 redirect、不自動填寫年齡。下載的 HTML 只做文字解析，不執行腳本或插入頁面。

只識別正式 descriptor 區塊及 AI 標題；成人內容可能使用相同 HTML ID，不能只依 ID 判斷。判定「未找到披露」前，需確認 App ID、商品標題、介紹區塊及完整 HTML 結尾。登入、年齡驗證、地區限制及不完整回應保持未知。

查詢 Resolver 由背景 worker 跨分頁共用，合併同 ID 請求、限制併發並持久保存限流狀態。儲存序列化，清除快取使用世代編號，避免舊請求完成後重新寫回已清除的結果。

用途分類只讀正式揭露原文；分類快取以原文為鍵，保存最多 500 組用途集合，不把使用者選項混入結果。`matchesUses` 先檢查例外與正式揭露，再按已選用途判斷；有揭露但分類集合為空時才使用 `unknown` 選項。`shouldHide` 在相同命中規則上限制為 mask／hide 模式，供頁面及自動忽略共用。全未選取與純題材 tag 一律不命中。

持久設定改用 `mode: off | mark | mask | hide`。沒有新欄位時，相容讀取舊 `level`／`presentation`：舊 broad 不直接當成 hide，必須保留原遮蔽／隱藏選擇。首次保存一般設定時一起寫入 mode 與 `settingsVersion: 2`；純讀取不寫入，已採新格式時不再重寫其他模式值。`presentation()` 僅為既有遮罩／版面模組的內部轉換，不是第二組使用者設定。

`requestGap` 與 `concurrency` 經固定選項正規化後套用背景共用 Resolver。`cacheDays` 為 0（依狀態預設）、1、7、30；成功結果依 checkedAt 重算效期，失敗維持獨立 expiresAt。內容腳本、背景快取與自動忽略採相同新鮮度判斷。30 天結果可跨 worker 重啟沿用；縮短間隔不改寫檢查時間。設定與請求競態使用版本序號，較舊的非同步讀取不得重新啟用已關閉的查詢。

## 自動忽略

預設關閉，只能由自身 popup 開啟；候選必須來自自身 extension 的 Steam 內容腳本。背景 worker 持有單一佇列，`alarms` 在休眠後喚醒；先儲存下次可操作時間，避免重啟造成突發請求。

送出前重讀設定與快取，確認綁定帳號及 Steam 現有忽略清單；送出後回讀清單，確認結果才記錄完成。重試前先核對未知的上次結果。登入失效、帳號切換或格式不相容會暫停；查詢及忽略共同遵守限流等待時間。

操作格式依 Steam 公開 [dynamicstore.js](https://store.fastly.steamstatic.com/public/javascript/dynamicstore.js) 的 `ModifyIgnoredApp` 核對：向固定 `recommended/ignorerecommendation/` 傳送 `sessionid`、`appid`、`remove=0`，從 `dynamicstore/userdata/` 讀取 `rgIgnoredApps`。從 Steam 首頁短暫解析的 session ID 不儲存、不記錄、不經訊息傳遞；本機只保留綁定帳號 ID、App ID 與進度。

## 彈窗與卡片標記

320px 白色面板，保留原拉桿幾何，四檔採灰／藍／琥珀／紫色與短暫過渡。主頁只有模式與七項用途，中間使用低對比分隔線；右上齒輪進入設定分類，再進入分類內頁。返回按鈕只有 icon，具 title、無障礙名稱與焦點樣式；返回時恢復父頁捲動與觸發按鈕焦點。導覽狀態留在本次 popup，不干擾設定跨分頁同步。

分類為檢查與快取、網路、顯示、自動化與例外、語言。使用原生 range、switch、select 與 button，支援鍵盤及減少動畫。range 以連續數值跟隨拖曳，視覺滑塊與填色共用位置，放開吸附整數檔位並保存；鍵盤一次切一檔。select 使用 base-select 及 picker 樣式，舊瀏覽器保留原生選單。設定寫入序列化，七項用途於寫入時合併最新選擇；儲存失敗還原已提交的值。html/body 固定寬度並抑制水平溢出，避免 action popup 初始測量壓縮內容。

標記模式只為命中遊戲產生一組 `.saf-badge`，內含各自獨立的 AI／用途純色 `.saf-chip`；顯示所有辨識用途，不混入處理模式或例外文字。遮蔽與隱藏模式不建立這組標籤。`.saf-checked` 是獨立查詢狀態，未命中為綠色、命中為琥珀黃；遮蔽卡片省略。圖片上的標籤背後有局部低對比白色漸層，提升可讀性；不宣稱「無 AI」。關閉會移除所有標記、還原版面並停止新卡片掃描，晚到結果以世代編號隔離。

霧面遮罩保留原內容供 backdrop-filter 模糊，原子元素維持 inert／aria-hidden 並暫停媒體；遮罩操作本身可由鍵盤使用。單張手動顯示、hover 暫時顯示與持久 allow 分開管理；模式／用途切換和 DOM 換 app 都會清理暫時狀態。眼睛按鈕恢復遮蔽，hover 移出自動還原。

單次不感興趣透過 SAF_IGNORE_ONE，仍驗證自身 extension 及 Steam 來源，且前端拒絕程式合成點擊。與自動忽略共用序列、等待期限及結果確認，但不打開自動化、不建立自動重試。

設定圖示與眼睛圖示使用現成 CC0 SVG，來源和授權包含於 public/icons/NOTICE.txt。

[回到 README](../README.md)
