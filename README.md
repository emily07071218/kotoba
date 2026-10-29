# 言葉 Kotoba

自用、零後端、完全離線的日文初學學習工具:五十音入門 + 單字間隔重複(SRS)。

## 功能

- **五十音模組**:平假名/片假名全表(含濁音・半濁音・拗音,共 208 個),選擇題 + 羅馬字打字練習,走 FSRS 排程。五十音檢定(20 題、16 題及格)通過後解鎖單字,可跳過。
- **單字模組**:N5→N4 分級詞表,每天自動引入新詞(預設 8 個,可調 1–20),測驗型態「日→中」「中→日」選擇題,FSRS 排程、四級評分,卡片附例句與發音。
- **主畫面**:今日待複習、連續天數、已學詞數。
- **資料**:全部存在瀏覽器 IndexedDB,一鍵匯出/匯入 JSON 備份,多日未備份自動提醒。
- **PWA**:安裝到桌面、離線可用。

## 開發

```bash
npm install
npm run dev      # 本機開發
npm run build    # 型別檢查 + production build(輸出 dist/)
npm run preview  # 預覽 build 結果
npm run data     # 重建 src/data/vocab.json(需要網路,原始檔快取在 .data-cache/)
```

技術棧:Vite + React 19 + TypeScript、Dexie(IndexedDB)、ts-fsrs(FSRS 排程)、
Web Speech API(發音)、vite-plugin-pwa(Service Worker 離線)。

## 內容來源與授權

所有「事實性內容」(詞形、讀音、詞性、中文釋義、例句)皆來自開放資料,詳見 [ATTRIBUTION.md](ATTRIBUTION.md)。

## 部署

`npm run build` 後把 `dist/` 部署到任何靜態主機即可。

**GitHub Pages**:建一個 repo,把 `dist/` 推到 `gh-pages` 分支(或在 Actions 用官方
actions/deploy-pages),Settings → Pages 選該分支。`base: './'` 已設定,放在子路徑也能用。

**Vercel / Netlify**:build command `npm run build`、輸出目錄 `dist`,零設定。

> 注意:進度存在「瀏覽器的 IndexedDB」(綁定網域與瀏覽器)。換瀏覽器或清資料前,先用設定頁匯出備份。

## 每日節奏

打開 app → 「開始複習」→ 新卡片先(假名/單字)→ 到期卡片 → 完成後看到連續天數 +1。
每天 10–15 分鐘;新詞量固定,複習負擔才可預測。
