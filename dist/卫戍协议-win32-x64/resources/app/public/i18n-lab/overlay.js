// i18n-lab/overlay.js — additive English layer: translates the rendered DOM instead of editing
// the ~58 files that hold the Chinese UI strings. Deliberately importable as a single line so it
// cannot conflict with gameplay PRs touching those files.
//
// Enable: /?lang=en  (persisted in localStorage under sp.lang)

import { EXACT, RULES, PUNCT } from './en/chrome.js';
import { EXACT2, RULES2 } from './en/screens.js';
import { NAMES } from './en/names.js';

const DICT = { ...NAMES, ...EXACT, ...EXACT2 };
const ALL_RULES = [...RULES, ...RULES2];
const BY_FIRST = new Map();
for (const key of Object.keys(DICT).sort((a, b) => b.length - a.length)) {
  const list = BY_FIRST.get(key[0]) || [];
  list.push(key);
  BY_FIRST.set(key[0], list);
}

const CJK = /[㐀-鿿]/;
// Full-width punctuation lives in its own nodes (`.title-cn__colon` holds just "："), so the walker
// has to consider those too — otherwise the separator stays Chinese-punctuated.
const NEEDS = new RegExp('[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]');
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'CANVAS']);
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'content'];

const stats = { nodes: 0, translated: 0, missed: new Map() };

function normalizePunctuation(text) {
  let out = text;
  for (const [re, to] of PUNCT) out = out.replace(re, to);
  return out.replace(/ {2,}/g, ' ').trim();
}

const isCJK = (ch) => CJK.test(ch);

/** A punctuation-only node keeps one trailing space, so "X" + "：" + "Y" reads "X: Y". */
const spaced = (t) => (t.length === 1 ? `${t} ` : t);

/** English for one CJK run, or null when the run cannot be covered end to end. */
function segmentRun(run) {
  let out = '';
  for (let i = 0; i < run.length;) {
    const key = (BY_FIRST.get(run[i]) || []).find((k) => run.startsWith(k, i));
    if (!key) return null;
    out += out ? ` ${DICT[key]}` : DICT[key];
    i += key.length;
  }
  return out;
}

/**
 * Translate a string. A node is only rewritten when **every** CJK run in it is fully covered by
 * the dictionary — partial matching would turn 攻击力 into "ATK 力", which is worse than Chinese.
 * Untranslatable text is left untouched apart from punctuation.
 */
export function translate(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (DICT[trimmed]) return DICT[trimmed];
  for (const [re, to] of ALL_RULES) if (re.test(trimmed)) return trimmed.replace(re, to);
  // Full-width punctuation can sit in its own text node (a title lockup renders
  // 卫戍协议 / ： / 盟约 as three), so normalise it even when nothing was translated.
  if (!CJK.test(text)) return NEEDS.test(text) ? spaced(normalizePunctuation(text)) : text;

  let out = '';
  let run = '';
  const flush = () => {
    if (!run) return true;
    const en = segmentRun(run);
    if (en === null) return false;
    out += ` ${en} `;
    run = '';
    return true;
  };
  for (const ch of text) {
    if (isCJK(ch)) { run += ch; continue; }
    if (!flush()) return text;
    out += ch;
  }
  if (!flush()) return text;
  return normalizePunctuation(out);
}

function note(node, before, after) {
  stats.nodes++;
  if (before === after) return;
  stats.translated++;
}

function walk(root) {
  if (!root || SKIP_TAGS.has(root.nodeName)) return;
  const doc = root.ownerDocument || document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (SKIP_TAGS.has(node.parentElement?.tagName)) return 2;
      if (node.parentElement?.closest?.('[data-no-i18n]')) return 2;
      if (node.nodeType === 3) return NEEDS.test(node.data) ? 1 : 2;
      return 1;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 3) {
      const before = node.data;
      const after = translate(before);
      note(node, before, after);
      if (after !== before) node.data = after;
    } else if (node.nodeType === 1) {
      for (const attr of ATTRS) {
        const value = node.getAttribute?.(attr);
        if (!value) continue;
        const after = translate(value);
        if (after !== value) node.setAttribute(attr, after);
      }
    }
  }
}

let observer = null;

export function start(root = document.body) {
  if (!root || observer) return;
  document.documentElement.lang = 'en';
  const title = translate(document.title);
  if (title !== document.title) document.title = title;
  walk(root);
  observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'characterData') {
        const parent = rec.target.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName)) continue;
        const before = rec.target.data;
        const after = translate(before);
        if (after !== before) {
          stats.missed.delete(before);
          rec.target.data = after;
        }
      } else {
        for (const n of rec.addedNodes) walk(n.nodeType === 1 ? n : n.parentElement || root);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
}

export function stop() {
  observer?.disconnect();
  observer = null;
}

export function enabled() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('lang');
  if (forced) {
    try { localStorage.setItem('sp.lang', forced); } catch { /* private mode */ }
    return forced === 'en';
  }
  try { return localStorage.getItem('sp.lang') === 'en'; } catch { return false; }
}

export function report() {
  return { ...stats, missed: [...stats.missed].sort((a, b) => b[1] - a[1]).slice(0, 40) };
}

if (globalThis.document && enabled()) {
  if (document.body) start(document.body);
  else addEventListener('DOMContentLoaded', () => start(document.body));
}

if (globalThis.window) window.SP_I18N = { translate, start, stop, report, enabled };
