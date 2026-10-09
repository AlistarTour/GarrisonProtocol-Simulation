# EN glossary for 卫戍协议：盟约 / Stronghold Protocol

Terminology is tiered by provenance. **Never promote a GUESS to LOOKSLIKE without a source** — the
whole value of an EN UI is that a player who reads the official EN client recognises the words.

## Tier 1 — OFFICIAL (global client / arknights.wiki.gg "Stronghold Protocol")

| 中文 | English | 备注 |
|---|---|---|
| 卫戍协议 | Stronghold Protocol | mode name |
| 卫戍协议：盟约 | Stronghold Protocol: Covenant | repo README's own title |
| 盟约 | Alliance | 核心盟约 = Core Alliance, 附加盟约 = Add-on Alliance |
| 策略 | Defence Strategy | 策略轮选 = Defence Strategy draft |
| 调度中心 | Dispatch Center | 升级调度中心 = Level up the Dispatch Center |
| 资金 | Funds | |
| 回合 | Round | |
| 休整期 | Rest Phase | |
| 作战 / 作战期 | Combat Phase | |
| 联防 | Unite Phase | the wiki also uses "Team Simulation" for the button; see COINED note below |
| 隐秘核心 | Hidden Core | 第 15 回合 = Hidden Core round |
| 最终攻势 | Final Assault | |
| 目标生命值 | Protection Objective / Life Point (LP) | LP is the stat, 目标生命值 is the label |
| 整备区 | Stronghold Logistics | 临时整备区 = Temporary Stronghold Logistics |
| 干员 | Operator | 精锐 = Elite |
| 博士 | Doctor | how the EN client addresses the player |
| 特性 | Trait | sub-profession trait |
| 天赋 | Talent | |
| 模组 | Operator Module | |
| 再部署 | Redeployment | 再部署倒计时 = Redeployment timer |
| 攻击范围 | Attack Range | |
| 生命上限 | Max HP | |
| 法术抗性 | Arts Resistance (RES) | |
| 攻击间隔 | Attack Interval | |
| 阻挡数 | Block | block count |
| 召唤物 | Summon | |
| 装备 | Module? **no** → Equipment | 装备 = Equipment; 法术 = Arts |
| 独立模拟 / 同盟模拟 | Solo Simulation / Team Simulation | |

## Tier 2 — STANDARD (general Arknights EN client)

攻击力 ATK · 防御 DEF · 部署 Deploy · 撤退 Retreat · 出售 Sell · 技能 Skill · 被动 Passive
· 冻结 Freeze · 刷新 Refresh · 准备就绪 Ready · 取消 Cancel · 确认 Confirm · 返回 Back

## Tier 3 — COINED here (no official EN exists; keep consistent, flag in PR)

| 中文 | English | 为什么这么定 |
|---|---|---|
| 机变 | **Contingency** | 官方 wiki 行文用 "gimmicks"，但那不是界面词。取 Contingency 与全球服已有的 Contingency Contract 同族，读起来像官方术语。 |
| 特质 | **Garrison Trait** | 本项目里 `特质` 是干员的驻军效果（DESIGN.md: "all 43 特质 (garrison) effect keys"），与 `特性`=Trait 必须区分，否则两个中文词都译成 Trait。 |
| 转译基底 / 寻呼模块 / 画卷 等专有道具名 | 保留原文 + 括号注 | 这些是模式专有名词，官方 EN 名需逐条核对，不猜。 |
| 调和 / 同构 / 在场 | Attune / Isomorphic / On Board | 盟约机制动词，官方无对应界面词。 |

## One decision the maintainer has to make

`盟约` has two competing English renderings in this project already:

- the official global-client word is **Alliance** — it comes straight out of the game data
  (`data/chess.json` appellation `盟约·辅助干员` → `"Alliance/Supportive Opertator"`), and
  arknights.wiki.gg uses "Alliances / Core Alliances / Add-on Alliances";
- this repo's own README and `<title>` call the mode **Stronghold Protocol: Covenant**.

The lab follows the official term (**Alliance**) everywhere except the browser tab title, which
keeps the project's established name. Pick one before this goes upstream — mixing them reads as a
bug, and the on-screen lockup currently renders "Stronghold Protocol: Alliance".


## What this lab deliberately does NOT translate

Game **content** text — skill / talent descriptions, enemy handbook text, bond effect text, garrison
event text, 机变 card text. Reasons:

1. `tools/build-data.mjs` pulls from `Kengxxiao/ArknightsGameData`, which is **zh_CN only** — the
   `en/`, `en_US/`, `ko_KR/` paths all 404. There is no official EN string to read from the current
   data pipeline.
2. Hand-translating 283 skill descriptions would invent text that contradicts the global client,
   which is worse than Chinese.
3. Scraping a third-party EN wiki for those strings would change this project's data-provenance
   story (see NOTICE.md) — that is a maintainer decision, not ours.

Operator / token **names** are the exception: `data/chess.json` and `data/tokens.json` already carry
the official English in the `appellation` field (e.g. 隐现 → `Insider`), so those are free and exact.
`build-names.mjs` extracts them.
