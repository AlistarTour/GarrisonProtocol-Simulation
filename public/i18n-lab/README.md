# i18n-lab — additive English UI layer (upstream issue #38)

`Localization for full English UI` asks for an English interface. This lab delivers it as an
**overlay that translates the rendered DOM**, not as a rewrite of the ~58 files that hold the
Chinese UI strings.

## Why an overlay instead of a `t()` refactor

Upstream currently has ~10 open gameplay PRs touching exactly the files with the most UI text
(`ui/gameLogic.js`, `ui/detailPanel.js`, `screens/game.js`, `screens/loadout.js`, …), and the
maintainer has an unpublished `0.1.1` in the same files. A sweep converting every literal to
`t('…')` would conflict with all of it and be unreviewable. The overlay needs **one import line**
and touches no shared file.

If the maintainer wants a real i18n system instead, the dictionary in `en/chrome.js` is the part
worth keeping — it is plain data and ports to `t()` unchanged.

## Enable

```html
<!-- public/index.html, after /js/main.js -->
<script type="module" src="/i18n-lab/overlay.js"></script>
```

Then open `/?lang=en` (persisted in `localStorage` under `sp.lang`; `?lang=zh` turns it off).
During development this folder is served from `public/i18n-lab/` and is deliberately **not**
tracked by git (see `.git/info/exclude`).

## Layout

| file | role |
|---|---|
| `GLOSSARY.md` | CN → EN terminology, tiered by provenance (official / standard / coined) |
| `en/chrome.js` | UI-chrome dictionary (218 entries) + whole-string rules + punctuation table |
| `en/names.js` | **generated** official English operator / summon names (`build-names.mjs`) |
| `overlay.js` | runtime: walker + `MutationObserver`, `?lang=en` switch, `window.SP_I18N` |
| `build-names.mjs` | regenerates `en/names.js` from `data/*.json` |
| `test/overlay.test.js` | `node --test` — dictionary hygiene + coverage against `inventory.json` |
| `inventory.json` | every Chinese phrase found in `public/js` + `shared` (comments stripped) |

## The one rule that keeps it honest

A text node is rewritten **only when every CJK run inside it is fully covered** by the dictionary.
Partial matching turns `攻击力` into `ATK 力`, which is worse than leaving it Chinese. Untranslatable
text is left alone apart from full-width punctuation (`：（）「」` → ASCII), which is why
`.title-cn__colon` is handled too.

Game **content** (skill / talent / enemy / bond descriptions, 机变 card text) is intentionally not
translated — `tools/build-data.mjs` reads `Kengxxiao/ArknightsGameData`, which is **zh_CN only**
(`en/`, `en_US/`, `ko_KR/` all 404), so there is no official English to read from the data pipeline,
and hand-inventing 283 skill descriptions would contradict the global client. Operator and summon
*names* are the exception: the official English is already in the generated data as `appellation`,
so `build-names.mjs` extracts 139 exact names for free.

## Measured

* `node --test i18n-lab/test/overlay.test.js` → 9/9 pass.
* Dictionary coverage over the extracted inventory: **636 / 1131 occurrences (56%)**. The
  denominator is inflated: `inventory.json` splits template literals, so fragments like `点）`,
  `张）`, `，等待其他博士` are counted as phrases and can never be exact keys.
* Title screen in a real browser (`/?lang=en`): **22 visible text nodes, 10 Chinese before → 0
  after**, and 0 full-width punctuation left. `<title>` → `Stronghold Protocol: Covenant`.
* Not yet swept: the in-match HUD, loadout and draft screens hold most of the remaining phrases.
  That is the next pass, and it is dictionary work, not architecture.

## Open question for the maintainer

`盟约` — the official global-client word is **Alliance** (it is literally in the game data:
`盟约·辅助干员` → `"Alliance/Supportive Opertator"`), but this repo's README and `<title>` call the
mode **Stronghold Protocol: Covenant**. The lab uses *Alliance* for the mechanic and keeps
*Covenant* only in the document title. See `GLOSSARY.md`.
