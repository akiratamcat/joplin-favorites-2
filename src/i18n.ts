import joplin from 'api';

// gettext PO catalogs, bundled into index.js at build time (webpack asset/source).
import poJa = require('../locales/ja.po');
import poZhCN = require('../locales/zh_CN.po');
import poZhTW = require('../locales/zh_TW.po');
import poKo = require('../locales/ko.po');
import poDe = require('../locales/de.po');
import poFr = require('../locales/fr.po');
import poEs = require('../locales/es.po');
import poIt = require('../locales/it.po');
import poPtBR = require('../locales/pt_BR.po');
import poRu = require('../locales/ru.po');

type Catalog = { [msgid: string]: string };

/**
 * Available PO sources, keyed by locale code (gettext style, e.g. 'ja', 'zh_TW').
 */
const PO_SOURCES: { [locale: string]: string } = {
  'ja': poJa,
  'zh_CN': poZhCN,
  'zh_TW': poZhTW,
  'ko': poKo,
  'de': poDe,
  'fr': poFr,
  'es': poEs,
  'it': poIt,
  'pt_BR': poPtBR,
  'ru': poRu
};

let currentLocale: string = 'en';
let currentCatalog: Catalog = {};

/**
 * Unescape a C-style PO string literal content.
 */
function unescapePo(s: string): string {
  return s.replace(/\\(.)/g, (_m, c: string) => {
    switch (c) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      default: return c; // \" \\ and others
    }
  });
}

/**
 * Minimal gettext PO parser. Supports msgctxt, msgid, msgstr and multi-line
 * string continuation. Plural forms are not used by this plugin.
 * Entries with empty msgstr and fuzzy entries are skipped (English fallback).
 * Keys with context are stored as "context\u0004msgid" (gettext convention).
 */
export function parsePo(source: string): Catalog {
  const catalog: Catalog = {};
  let entry: { [field: string]: string } = {};
  let field: string = null;
  let fuzzy: boolean = false;

  const flush = () => {
    if (entry.msgid !== undefined && entry.msgid !== '' && entry.msgstr && !fuzzy) {
      const key = entry.msgctxt !== undefined ? `${entry.msgctxt}\u0004${entry.msgid}` : entry.msgid;
      catalog[key] = entry.msgstr;
    }
    entry = {};
    field = null;
    fuzzy = false;
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('#')) {
      if (line.startsWith('#,') && line.includes('fuzzy')) fuzzy = true;
      continue;
    }
    const m = line.match(/^(msgctxt|msgid|msgstr)\s+"(.*)"$/);
    if (m) {
      // a new msgctxt/msgid after a msgstr starts a new entry
      if ((m[1] === 'msgid' && entry.msgstr !== undefined) || m[1] === 'msgctxt') {
        if (entry.msgid !== undefined) flush();
      }
      field = m[1];
      entry[field] = unescapePo(m[2]);
      continue;
    }
    const cont = line.match(/^"(.*)"$/);
    if (cont && field) {
      entry[field] += unescapePo(cont[1]);
    }
  }
  flush();
  return catalog;
}

/**
 * Resolve a Joplin locale (e.g. 'ja_JP', 'zh_TW', 'pt_BR', 'de_DE') to an
 * available catalog: exact match first, then language only, else English.
 */
export function resolveLocale(locale: string): string {
  if (!locale) return 'en';
  const normalized = locale.replace('-', '_');
  if (PO_SOURCES[normalized]) return normalized;
  const lang = normalized.split('_')[0].toLowerCase();
  if (PO_SOURCES[lang]) return lang;
  // e.g. 'zh' alone or 'zh_HK' -> fall back to a Chinese variant
  if (lang === 'zh') return (normalized === 'zh_HK' || normalized === 'zh_MO') ? 'zh_TW' : 'zh_CN';
  if (lang === 'pt') return 'pt_BR';
  return 'en';
}

/**
 * Read Joplin's UI language and load the matching catalog.
 * Must be called before any settings / commands are registered.
 */
export async function initLocale(): Promise<string> {
  let locale: string = 'en';
  try {
    locale = await joplin.settings.globalValue('locale');
  } catch (err) {
    console.warn('Favorites: could not read Joplin locale, using English.', err);
  }
  setLocale(locale);
  return currentLocale;
}

/**
 * Switch to the given locale (also used by tests).
 */
export function setLocale(locale: string) {
  currentLocale = resolveLocale(locale);
  currentCatalog = (currentLocale === 'en') ? {} : parsePo(PO_SOURCES[currentLocale]);
}

export function getLocale(): string {
  return currentLocale;
}

function format(text: string, args: any[]): string {
  let i = 0;
  return text.replace(/%s/g, () => (i < args.length ? String(args[i++]) : '%s'));
}

/**
 * Translate a message. '%s' placeholders are replaced by args in order.
 */
export function _(msgid: string, ...args: any[]): string {
  return format(currentCatalog[msgid] || msgid, args);
}

/**
 * Translate a message with context (gettext pgettext).
 */
export function _c(context: string, msgid: string, ...args: any[]): string {
  return format(currentCatalog[`${context}\u0004${msgid}`] || msgid, args);
}

/**
 * Marks a string for extraction without translating it (gettext N_).
 * Translate later with _(value).
 */
export function N_(msgid: string): string {
  return msgid;
}
