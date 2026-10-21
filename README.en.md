# Steam AI Filter

[繁體中文](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md)

A Chrome extension that filters Steam store games using developers' AI content disclosures. Choose which AI uses to filter, then mark, mask, or hide matching games. Art is the only category enabled by default.

The source version is **v0.10.2 (unreleased)**. Load the built [extension/](extension/) directory to use these features. The published **v0.8.0** package remains available from [Releases](https://github.com/RyuuMeow/steam-ai-filter/releases/latest) or the [RAR download](https://github.com/RyuuMeow/steam-ai-filter/releases/download/v0.8.0/steam-ai-filter-v0.8.0.rar). Installing a built extension does not require Node.js.

## Install

1. Download and extract the v0.8.0 release RAR, or download this repository with **Code → Download ZIP** and extract it. For the repository, use its `extension/` directory.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the extension directory containing `manifest.json` directly. Keep this directory in place after installation.
4. Refresh all Steam store tabs. Pin **Steam AI Filter** from Chrome's extensions menu and click its icon to open settings.

The [Traditional Chinese installation guide](README.md#安裝) includes screenshots. The screenshots show an earlier interface; toolbar access is the same.

## Use

| Mode | Result |
|---|---|
| Off | Restore cards, remove marks, and stop checking |
| Mark | Show AI and use-category labels on matching games |
| Mask (default) | Cover matching cards with a strong frosted blur, keeping their space; click once to show that game |
| Hide | Collapse the complete matching game block |

- **Categories:** Art, music / sound effects, voice acting, story / text, translation, code, and unspecified use. A game matches when any selected category matches. Unspecified use means an official disclosure exists but cannot be classified; an unchecked or failed lookup does not count. Deselecting every category stops matching and new automatic ignore actions.
- **Check icons:** Green means checked with no selected use matched; amber means a selected use matched. Masked and hidden cards have no check icon. No match does **not** prove that no AI was used.
- **Languages:** English, 繁體中文, and 简体中文. The initial language follows the browser; change it in **Settings → Language**. The developer's original Steam disclosure is preserved.
- **Mask actions:** Masks say **AI-generated content**. Hover or focus with the keyboard to fade in **Unmask**, **Allow this game**, and **Not interested**.
- **Unmask:** Click the button or a blank part of the mask to reveal only that game on the current page, without a dialog or navigation. An eye icon appears in the corner; click it to mask the game again. Changing modes resets this temporary choice.
- **Reveal on hover:** Enable under **Settings → Display**; off by default. Hovering reveals a card only until the pointer leaves. A manual click keeps it revealed until you click the eye or change modes.
- **Allow this game:** Save a persistent always-show exception. Remove it under **Automation & exceptions**. Marks and the hidden-games list also let you read disclosures and set exceptions.
- **Not interested:** An explicit click adds this game to the current Steam account's ignore list once. It does not enable automatic ignoring.
- **Cache and network:** By default, disclosures are cached for 7 days and pages without disclosures for 1 day. Choose a fixed 1, 7, or 30 days instead. The default request interval is 0.7 seconds, with at most 2 concurrent requests shared across tabs.
- **Automatic ignoring:** Off by default. In Mask or Hide mode, adds matching games to the current Steam account's ignore list, at most one game every 30 seconds. Turning it off does not undo completed actions. The settings show the actual queue, confirmed results, and any pause or rate limit.

## Update

Replace the files in the directory Chrome already uses, reload the extension at `chrome://extensions`, then refresh all Steam store tabs. The source build should show version **0.10.2**. Refreshing also resolves `Extension context invalidated` notices after an extension update.

## Scope and privacy

- Works on desktop Chrome at `store.steampowered.com`, including home, search, and sale pages. It does not run in the native Steam client or Steam Community.
- Uses official AI disclosures and local keyword classification, without analyzing artwork. Unknown, failed, or verification-blocked lookups remain visible. A card may appear briefly while its first lookup completes.
- Settings, exceptions, and cache stay local. There is no AI API, shared database, or third-party tracking. Network requests go only to the Steam store and use the browser's existing Steam login.
- The `storage` permission saves local data; `alarms` schedules automatic ignoring. Website access is limited to the Steam store.

Additional [usage and data-handling details](docs/usage.md) are maintained in Traditional Chinese. Steam page changes may require an extension update.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm run check
npm run package
npm run dev
```

Source is in `src/`, static assets in `public/`, and the installable build in `extension/`. See the [development guide](docs/development.md) and [validation record](docs/validation.md). Pushing a version tag runs checks and creates a GitHub Release containing the extension RAR.

## License and disclaimer

Released under the [MIT License](LICENSE). This independent, unofficial tool is not affiliated with Valve or Steam. Local classification may produce false matches or miss AI use; labels are not judgments about quality, infringement, or developer conduct. Read the original disclosure when deciding.

Automatic ignoring changes the current Steam account's ignore list. Review your filter settings before enabling it and verify account changes yourself. You must comply with the [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/#4) and assess the risks of background queries and automated account actions, including rate limits or account restrictions. The software is provided as is, with the warranty and liability limits in [LICENSE](LICENSE).
