# 設計與模組分工

插件以 Steam 商品頁的正式 AI 揭露及個別卡片的 tag 為依據。訊號不足時保持可見；不以遊戲名稱、一般描述、評論或圖片風格推定 AI 使用情形。使用行為與資料保存期限見 [使用說明](usage.md)，此文件說明實作邊界。

## 模組

| 模組 | 責任 |
|---|---|
| [core.ts](../src/core.ts) | 設定正規化、卡片邊界、證據抽取與過濾規則 |
| [disclosure-keywords.ts](../src/disclosure-keywords.ts) | 本機英文、繁中、簡中字表 |
| [disclosure.ts](../src/disclosure.ts) | 保守判斷 AI 是否明確僅用於程式開發 |
| [lookup.ts](../src/lookup.ts) | 商品頁文字解析、快取、請求去重、併發及退避 |
| [ignore.ts](../src/ignore.ts) | 帳號忽略佇列、結果確認、限速與失敗處理 |
| [background.ts](../src/background.ts) | MV3 service worker、訊息來源驗證及持久儲存 |
| [content.ts](../src/content.ts) | 頁面掃描、DOM 更新、狀態列、原因與例外 |
| [mask.ts](../src/mask.ts) | 遮罩、剔除、媒體停止與無障礙屬性還原 |
| [layout.ts](../src/layout.ts) | 專屬外層收起、已辨識水平輪播的連續捲動與還原 |
| [popup.ts](../src/popup.ts) | 拉桿、開關、設定保存與目前分頁狀態 |

`public/` 保存 manifest、CSS、彈窗 HTML 與圖示。無 UI 框架、遠端字型或執行時套件。`dist/` 是本機建置資料夾；`extension/` 是提交到 repo 的可安裝版本，打包時只允許公開資產和已編譯模組，不包含測試替身。

## 卡片與完整容器

所有商店路徑使用相同掃描邏輯；頁面類型只供顯示，不作注入白名單。辨識帶媒體的 app 連結、單一 App ID／item key、行內背景及常見文字卡片。排除頁面根節點、導航、組合包和外站，不跨越混合遊戲列表。

同款封面及截圖可合併。已觀察的 `LibraryAssetExpandedDisplay`、`carousel__slide`、`trailercarousel` 是完整遊戲物件的語意邊界，仍要求只有單一 app；預告片可能使用不同 movie ID，因此不能只靠媒體網址決定容器。

首頁的 `.home_content.single` 另有「因為您最近遊玩過」的文字連結。只在具有單一 `.home_content_items` 與標準標題結構時，排除 `.home_content_reason` 的純文字參照；其餘商品連結仍須對應同一 app。理由內若含圖片、影片或另一張遊戲卡片，便保留一般混合遊戲防護。標籤與揭露只取自目標商品圖組，避免參照遊戲污染判斷。

遮蔽覆蓋整個卡片並保留尺寸。剔除使用可還原的 CSS class，不移除 Steam 管理的 DOM 節點；首頁 `.home_content_single_ctn` 只有在唯一子元素就是目標卡片時才一同收起。保留 DOM 可支援 React 重用、暫時顯示、例外與關閉還原。商品詳情的當前遊戲保留可見，同頁其他推薦照常過濾。

標準水平輪播剔除後改為連續捲動，卡片尺寸仍按原百分比計算；左右箭頭依剩餘範圍操作，避免舊索引導向空白末頁。全部命中時整條收起。還原時釋放事件與樣式、恢復按鈕及 tabindex；未知結構不強行改寫。

## 生命週期

DOM 變更以 100ms 合併；只重新抽取新增或 dirty 卡片，移除已離頁節點。同 app 共享當前證據，重新合併時不保留已刪除的訊號。快取變更跨分頁同步，內容渲染會重新檢查有效期限。

Chrome 插件重新載入後，舊內容腳本可能失效。所有 API 呼叫處理同步拋錯與非同步拒絕；失效時停止 observer、timer、事件與回應回填，還原卡片及輪播，只留下刷新提示。未開啟 popup 造成的無接收端不視為失效。

## 查詢與判斷

背景只接受數字 App ID，自行組成固定 Steam 商品頁 URL。沿用瀏覽器既有 Steam 狀態，不讀 cookie 值、不追蹤 redirect、不自動填寫年齡。下載的 HTML 只做文字解析，不執行腳本或插入頁面。

只識別正式 descriptor 區塊及 AI 標題；成人內容可能使用相同 HTML ID，不能只依 ID 判斷。判定「未找到披露」前，需確認 App ID、商品標題、介紹區塊及完整 HTML 結尾。登入、年齡驗證、地區限制及不完整回應保持未知。

查詢 Resolver 由背景 worker 跨分頁共用，合併同 ID 請求、限制併發並持久保存限流狀態。儲存序列化，清除快取使用世代編號，避免舊請求完成後重新寫回已清除的結果。

程式碼例外只讀正式揭露原文。至少需有一個明確排他的程式用途句；其他句子亦須為程式用途，或能完整解析為非 AI／人工素材聲明。混合用途、無法解析、含糊表述及達到截斷上限的文字都不放行。結果是依原文推斷，並非 Steam 官方用途分類。

## 自動忽略

預設關閉，只能由自身 popup 開啟；候選必須來自自身 extension 的 Steam 內容腳本。背景 worker 持有單一佇列，`alarms` 在休眠後喚醒；先儲存下次可操作時間，避免重啟造成突發請求。

送出前重讀設定與快取，確認綁定帳號及 Steam 現有忽略清單；送出後回讀清單，確認結果才記錄完成。重試前先核對未知的上次結果。登入失效、帳號切換或格式不相容會暫停；查詢及忽略共同遵守限流等待時間。

操作格式依 Steam 公開 [dynamicstore.js](https://store.fastly.steamstatic.com/public/javascript/dynamicstore.js) 的 `ModifyIgnoredApp` 核對：向固定 `recommended/ignorerecommendation/` 傳送 `sessionid`、`appid`、`remove=0`，從 `dynamicstore/userdata/` 讀取 `rgIgnoredApps`。從 Steam 首頁短暫解析的 session ID 不儲存、不記錄、不經訊息傳遞；本機只保留綁定帳號 ID、App ID 與進度。

## 彈窗

320px 白色表面，保留四檔拉桿的色彩及光暈，原生控制支援鍵盤與減少動畫設定。`html/body` 固定 width/min-width，避免 action popup 初始視窗大小反過來壓縮內容。

選項名稱為 14px、600 字重；規則與開關說明為 12px、灰色 `#6b7280`，讓控制優先於輔助文字。廣泛警告保留深琥珀色與黃色三角形。錯誤與操作狀態不因說明文字降階而隱藏。

「管理」收合查詢明細與例外。綠勾只標記已取得正式資料的可見卡片；查詢中、失敗、過期或只有 tag 都不顯示，也不宣稱「無 AI」。

[回到 README](../README.md)
