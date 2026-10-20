# 開發與驗證

使用 Node.js 22+：

```sh
npm ci
npm run check
npm run dev
```

`dist/` 是本機建置產物；repo 另附已編譯的 `extension/` 供一般使用者安裝。`npm run dev` 僅監聽 `127.0.0.1:4173`。

- 首頁完整推薦測試：`http://127.0.0.1:4173/tests/home-single.html?test=1`
- 首頁預覽：`http://127.0.0.1:4173/`
- 首頁測試：`http://127.0.0.1:4173/?test=1`
- 遮蔽／剔除測試：`http://127.0.0.1:4173/tests/removal.html?test=1`（去掉 `?test=1` 為互動預覽）
- 整列／輪播靠齊測試：`http://127.0.0.1:4173/tests/layout.html?test=1`（去掉 `?test=1` 為互動預覽）
- 程式碼接受開關測試：`http://127.0.0.1:4173/tests/code-acceptance.html?test=1`（去掉 `?test=1` 為互動預覽）
- 預告片／綠勾／自動忽略測試：`http://127.0.0.1:4173/tests/automation.html?test=1`（合成帳號及 HTTP 回應，不修改真實 Steam 帳號）
- 彈窗初始尺寸回歸：`http://127.0.0.1:4173/tests/popup-sizing.html`
- 更新失效回歸：`http://127.0.0.1:4173/tests/invalidation.html?case=sync`（其他 case：`async`、`id`、`pending`、`storage`；加 `&remove=1` 驗證剔除還原）
- 動態查詢與快取整合測試：`http://127.0.0.1:4173/?lookup=1`
- 全商店／推薦圖組測試：`http://127.0.0.1:4173/sale/nextfest?coverage=1`
- 商品詳情的其他遊戲測試：`http://127.0.0.1:4173/app/620/?coverage=1`
- 搜尋預覽：`http://127.0.0.1:4173/search/`
- 搜尋頁瀏覽器測試：`http://127.0.0.1:4173/search/?test=1`
- 詳情頁瀏覽器測試：`http://127.0.0.1:4173/app/4517370/`
- 單檔預覽：執行 `npm run preview:package`，開啟 `artifacts/preview.html`。

瀏覽器測試以 Chrome API 替身測試內容腳本與彈窗，使用虛構遊戲與實際觀察到的 Steam DOM 結構。動態查詢 fixture 使用正式 Resolver 加上合成 HTTP 回應。它不等於已在使用者 Chrome 安裝實測。測試替身不會進入 `dist/`。

可選的真實連線檢查：`node scripts/check-live.mjs 4517370 620`。只查明確指定的公開 App ID，檢查正式查詢器及重複快取命中；不在一般測試中連線。Node 不具有使用者瀏覽器 cookies，這個檢查只能驗證匿名公開頁面。

原始碼導覽及取捨見 [design.md](design.md)，驗證紀錄見 [validation.md](validation.md)。

圖示原始包保留於 [assets/steam_ai_filter_chrome_icons.zip](../assets/steam_ai_filter_chrome_icons.zip)；正式插件僅打包 `public/icons/` 中的 16、32、48、128px PNG。

## 更新安裝包

修改 `src/` 或 `public/` 後執行：

```sh
npm run check
npm run package
npm run package:check
```

`package` 會重建並更新 **extension/**；此資料夾需要一併提交，勿直接修改裡面的產物。
`package:check` 比較檔案清單與內容，確認安裝包和目前建置一致，不修改檔案。
GitHub Actions 執行 Node 測試、型別檢查、建置及安裝包比對；瀏覽器 fixture 仍需依上方連結在本機執行，未包含在 CI 中。

## 自動發版

首次將 repo 上傳 GitHub 後，推送與插件版本一致的標籤：

```sh
git push origin main
git tag v0.7.1
git push origin v0.7.1
```

[Release workflow](../.github/workflows/release.yml) 會：

1. 比對標籤、`package.json`、lockfile 及兩份 manifest 的版本。
2. 執行型別檢查、Node 測試與建置，確認 `extension/` 與建置內容完全一致。
3. 產生 `steam-ai-filter-v版本.rar`，測試壓縮檔並實際解壓，比對每個檔案的內容及路徑。
4. 建立 GitHub Release，**只上傳這個插件 RAR**。

RAR 根目錄直接包含 `manifest.json`、程式、樣式、圖示與 MIT `LICENSE`，不含原始碼、開發文件、測試或多餘的 `extension/` 外層。
GitHub 另外自動顯示的 **Source code (zip/tar.gz)** 連結由平台提供；一般使用者下載 RAR 即可。
流程使用 GitHub 內建的 `GITHUB_TOKEN`，不需要另建 token。遠端 Actions 結果可在 repo 的 **Actions → Release** 查看。

下次發版時，先同步修改 `package.json`、`package-lock.json`（包含根 package 版本）及 `public/manifest.json`，更新 README 與驗證紀錄，執行 `npm run package` 並提交 `extension/`。再推送新的 `v版本號` 標籤。
標籤不符、安裝包過期或驗證失敗都會停止發版；已存在的 Release 不會被覆寫。若流程在發布前失敗，修復環境後可重新執行該 workflow；程式碼修正則使用新版本標籤。

### 本機產生 RAR

本機需有 RAR CLI（Windows 可使用已安裝 WinRAR 附帶的 `Rar.exe`）：

```sh
npm run package:rar
npm run release:check -- v0.7.1
```

產物為 `artifacts/steam-ai-filter-v0.7.1.rar`，打包時也會檢查 `extension/` 是否過期。
Windows 會自動尋找標準 WinRAR 安裝位置；其他位置可用 `RAR_BIN` 環境變數指定執行檔。Linux 使用 PATH 中的 `rar`，CI 從 Ubuntu 套件庫安裝。

發版依據：[GitHub CLI release create](https://cli.github.com/manual/gh_release_create)、[Ubuntu 24.04 RAR 套件](https://packages.ubuntu.com/noble/rar)。

## 上傳 GitHub

repo 根目錄是含有 `README.md`、`package.json`、`src/`、`extension/` 的那一層。
上傳時保留 `docs/images/` 與 `extension/`，README 的圖片與免建置安裝才能正常使用。
`node_modules/`、`dist/`、`artifacts/` 是本機產物，已列入 `.gitignore`。

專案使用 [MIT License](../LICENSE)。建置及 RAR 安裝包會自動附上根目錄的授權文字。

[回到 README](../README.md)
