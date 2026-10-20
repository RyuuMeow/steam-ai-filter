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

發版時同步修改 `package.json`、`package-lock.json` 及 `public/manifest.json` 的版本，更新 README 與驗證紀錄，再重建安裝包。
可將 `extension/` 的內容放進一個 `steam-ai-filter/` 資料夾後壓縮，作為 GitHub Release 的獨立安裝包。

## 上傳 GitHub

repo 根目錄是含有 `README.md`、`package.json`、`src/`、`extension/` 的那一層。
上傳時保留 `docs/images/` 與 `extension/`，README 的圖片與免建置安裝才能正常使用。
`node_modules/`、`dist/`、`artifacts/` 是本機產物，已列入 `.gitignore`。

專案尚未指定授權條款；這份 repo 沒有自行加入 LICENSE。

[回到 README](../README.md)
