# Steam AI Filter — Steam AI 生成內容過濾器

A Chrome extension that filters Steam store games using their AI content disclosures. Hide or mark matching games, with selectable AI-use categories and local caching. Art is the only category enabled by default.

在 Chrome 瀏覽 Steam 商店時，依商品頁的 AI 使用揭露過濾遊戲。可以遮蔽卡片、直接剔除，也可以只加上標示。

目前版本 **v0.8.0**。從 **[Releases](https://github.com/RyuuMeow/steam-ai-filter/releases/latest)** 下載插件 RAR，解壓後即可載入，安裝不需要 Node.js。

[下載插件 RAR](https://github.com/RyuuMeow/steam-ai-filter/releases/download/v0.8.0/steam-ai-filter-v0.8.0.rar) · [MIT 授權](LICENSE)

- **四檔過濾**：關閉、標示、揭露、廣泛。
- **兩種呈現**：遮蔽保留版面，剔除收起完整遊戲區塊。
- **自選 AI 用途**：展開「過濾項目」，選擇美術、音樂／音效、配音、劇情／文字、翻譯或程式碼；預設只開美術。
- **本機查詢與快取**：按需讀取 Steam 商品頁；可選擇顯示已檢查綠勾，以及自動加入 Steam 忽略清單。

## 安裝

### 1. 下載並解壓縮

開啟 **[最新 Release](https://github.com/RyuuMeow/steam-ai-filter/releases/latest)**，在 **Assets** 下載 **`steam-ai-filter-v0.8.0.rar`**。

將 RAR **解壓縮至同名資料夾**（例如 WinRAR 的「解壓縮至 steam-ai-filter-v0.8.0\\」）。這個資料夾就是稍後要選取的插件，裡面直接有 `manifest.json`。

```text
steam-ai-filter-v0.8.0/  ← 在 Chrome 選這一層
├── manifest.json
├── background.js
├── popup.html
├── icons/
└── ...
```

選取的資料夾內必須直接看到 `manifest.json`，不要選 RAR 檔。

也可用 **Code → Download ZIP** 下載 repo，完整解壓後選取其中的 **[extension/](extension/)**。

### 2. 開啟 Chrome 擴充功能頁面

在網址列輸入 `chrome://extensions`，或從右上角 **⋮ → 擴充功能 → 管理擴充功能** 進入。

<img src="docs/images/01-open-extensions-menu.png" alt="從 Chrome 右上角選單開啟擴充功能" width="280">

### 3. 開啟開發人員模式並載入插件

開啟右上角的 **開發人員模式**，點選左上角 **載入未封裝項目**，選取第 1 步找到的插件資料夾。

<img src="docs/images/02-load-unpacked-extension.png" alt="先開啟開發人員模式，再點載入未封裝項目" width="800">

安裝後請保留這個資料夾；Chrome 會持續從此處讀取插件。

### 4. 重新整理 Steam 並開啟設定

重新整理所有已開啟的 Steam 商店分頁。點 Chrome 工具列的拼圖圖示，將 **Steam AI Filter** 釘選，再點插件圖示開啟設定。

<img src="docs/images/03-open-filter-settings.png" alt="工具列的 Steam AI Filter 圖示與設定彈窗" width="320">

上圖為先前版本的工具列操作位置。v0.8.0 首次安裝預設為 **揭露＋遮蔽**；過濾項目只開啟美術，已檢查綠勾開啟，自動不感興趣關閉。

## 使用方式

| 過濾等級 | 效果 |
|---|---|
| 關閉 | 還原卡片，停止過濾 |
| 標示 | 保留全部遊戲，只標出 AI 訊號 |
| 揭露（預設） | 過濾 AI 揭露中命中已勾選用途的遊戲 |
| 廣泛 | 未取得正式揭露時，另納入帶有「人工智慧」標籤的遊戲 |

**廣泛可能會遮蔽或剔除非 AI 生成內容。**「人工智慧」標籤也可能只代表遊戲題材。

- **遮蔽／剔除**：在揭露或廣泛模式下選擇如何處理命中卡片。
- **過濾項目**：預設收合，只開啟美術。勾選表示要過濾該用途；混合用途只要有一項命中就處理，全部關閉則不遮蔽／剔除。用途不明只標示。
- **顯示已檢查標記**：綠勾代表已取得揭露或成功查詢商品頁，**不代表沒有使用 AI**。
- **自動不感興趣**：預設關閉。開啟會修改目前 Steam 帳號的忽略清單，每 30 秒最多處理一款；關閉後不會撤回已完成的忽略。
- **暫時顯示／永遠顯示**：暫時恢復本頁卡片，或將指定遊戲加入例外名單。「管理」可移除例外、查看查詢狀態及清除快取。

完整規則、快取方式與自動忽略的停止／恢復方式，見 [使用與資料處理](docs/usage.md)。

## 更新

1. 將新版插件檔案覆蓋到原本載入的資料夾，保持 `manifest.json` 在同一層。
2. 到 `chrome://extensions`，點 Steam AI Filter 的重新載入按鈕，確認版本為 **0.8.0**。
3. **重新整理所有 Steam 商店分頁**，讓頁面改用新版程式。

既有等級、呈現、例外及其他開關會保留。從舊版更新時，「接受 AI 程式碼」改為六項用途選擇，預設只開啟美術；之後會記住各項設定。若出現 `Extension context invalidated`，請完成第 3 步。

## 支援範圍與隱私

- 適用於桌面版 Chrome 的 `store.steampowered.com`，包含首頁、搜尋與特價活動等商店路徑；不作用於原生 Steam 客戶端或 Steam 社群。
- 依 Steam 提供的揭露與標籤判斷，不分析圖片畫風。未知、查詢失敗或受登入／年齡驗證限制的遊戲會保持可見，首次查詢可能短暫顯示卡片。
- 設定、例外及快取保存在本機；沒有 AI API、共用資料庫或第三方追蹤。需要網路時只向 Steam 商店查詢，並沿用瀏覽器既有 Steam 登入狀態。
- `storage` 用來保存本機資料，`alarms` 用來排程自動忽略；網站存取僅限 Steam 商店。自動忽略涉及帳號操作，詳細行為見 [使用說明](docs/usage.md#自動不感興趣預設關閉)。

Steam 頁面結構變更可能需要更新插件。這是獨立開發的擴充功能，與 Valve／Steam 無隸屬關係。

## 開發

使用 Node.js 22 或更新版本：

```sh
npm ci
npm run check
npm run package
npm run dev
```

- `src/`：TypeScript 原始碼。
- `public/`：manifest、彈窗、樣式與圖示。
- `extension/`：可直接安裝的編譯產物，由 `npm run package` 更新。
- `tests/`：Node 測試與離線瀏覽器測試頁。
- `docs/`：使用規則、開發指引、設計及驗證紀錄。

推送 `v版本號` 標籤會自動執行檢查並建立 GitHub Release，附件只有插件本體的 RAR。詳見[自動發版](docs/development.md#自動發版)。

[開發與驗證指引](docs/development.md) · [設計與模組分工](docs/design.md) · [v0.8.0 驗證紀錄](docs/validation.md)

## 授權

以 [MIT License](LICENSE) 開源。插件安裝包也附有同一份授權文字。
