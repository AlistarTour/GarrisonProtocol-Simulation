# English UI layer — Stronghold Protocol: Covenant

An **unofficial, drop-in English interface layer** for
[Stronghold Protocol: Covenant](https://github.com/sganggs/Stronghold-Protocol), built in response
to [issue #38](https://github.com/sganggs/Stronghold-Protocol/issues/38). Fan project, non-commercial,
no affiliation with Hypergryph / Yostar.

## Install (30 seconds)

Unzip this anywhere, open a terminal **in your existing game folder** (the one with
`server/index.js`) and run:

```
node path/to/Stronghold-Protocol-EN-patch/install-en.mjs
```

It copies a folder to `public/i18n/` and adds **one** `<script>` line to `public/index.html`.
Nothing else is touched. Start the server as usual and open:

```
http://localhost:3001/?lang=en
```

`?lang=zh` switches back. To remove it entirely: `node install-en.mjs --undo`.

## What is in English

The interface: title and lobby screens, the room, the run briefing and Defence Strategy draft, the
shop bar, the operator detail panel, the loadout screen, combat HUD labels, the result screen, and
the error / toast messages. Operator and summon **names** use the official English from the game
data, not our translation.

## What is still Chinese, and why

Skill, talent, enemy, Alliance and Contingency **descriptions**. The data pipeline reads
`Kengxxiao/ArknightsGameData`, which only publishes `zh_CN` — there is no official English text to
read for those strings, and inventing our own would contradict the global client. Names are the one
exception because the CN tables already carry the English in `appellation`.

Roughly a third of the interface strings still surface as Chinese in dense screens; anything you see
untranslated is a dictionary gap, not a limitation of the approach.

## Known rough edges

- Long prose (the copyright disclaimer, help text) is often left in Chinese.
- Some sentences are composed at runtime, so a number or name inserted mid-sentence can leave the
  word order awkward.
- A punctuation-only node is normalised (`：` → `:`), but text drawn on an image or in CSS cannot be.
- If the layer fails to load, the game still runs in Chinese — it is additive by design.

## Please tell us

1. Any screen where a label is missing, wrong, or reads unnaturally — with the screen name.
2. Any place where the English **breaks the layout** (overflow, clipped text, wrapping).
3. Whether you hit any error at all: a blank screen, a stuck loading spinner, a console error, or
   the layer simply not applying. If so, which browser and OS.
4. Your preferred word for `盟约`: the official client uses **Alliance**, this project's README uses
   **Covenant**. We need one of the two everywhere.

Open an issue on the fork that hosts this patch, or reply on issue #38. Screenshots help more than
words.
