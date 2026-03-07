/**
 * build-docs.mjs
 *
 * Scrapes the MicroPython documentation from https://docs.micropython.org/en/latest/library/
 * and writes public/assets/docs.json — a flat map of fully-qualified symbol names to their
 * signature, one-line description, and deep-link URL.
 *
 * Usage:  node scripts/build-docs.mjs
 * Deps:   none beyond Node 18+ (fetch built-in) and jsdom (already a devDep)
 */

import { JSDOM } from 'jsdom';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'public', 'assets', 'docs.json');

const BASE = 'https://docs.micropython.org/en/latest/library/';

/** Modules whose index page is also their only page. */
const SIMPLE_MODULES = ['math', 'sys', 'time', 'json', 'random'];

/** Modules whose index page links to sub-pages we should also scrape. */
const PAGED_MODULES = ['machine', 'network'];

/**
 * URL for the CPython built-in functions reference.
 * Used to supplement MicroPython's minimal builtins page with complete
 * signatures and descriptions.
 */
const CPYTHON_BUILTINS_URL = 'https://docs.python.org/3/library/functions.html';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch a URL and return a jsdom Document. */
async function fetchDoc(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  return new JSDOM(html).window.document;
}

/**
 * Normalise the text content of a <dt> signature element:
 * - remove Sphinx permalink characters: legacy ¶ (U+00B6) and the Font Awesome
 *   private-use glyph (U+F0C1) used by newer Sphinx builds
 * - strip any other private-use-area / control characters
 * - collapse internal whitespace
 */
function cleanSignature(dt) {
  return dt.textContent
    .replace(/[\u00B6\uF0C1]/g, '')        // ¶ and  (Sphinx permalink glyphs)
    .replace(/[\uE000-\uF8FF]/g, '')       // Unicode Private Use Area
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Return the text of the first <p> inside a <dd> element as a single line.
 * Falls back to the full dd text if no <p> is found.
 */
function firstDescription(dd) {
  const p = dd.querySelector('p');
  const raw = (p ?? dd).textContent;
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Extract all documented symbols from a single HTML page.
 * Returns an object ready to be merged into the docs map.
 */
function extractFromPage(doc, pageFile) {
  const pageUrl = `${BASE}${pageFile}`;
  const entries = {};

  // Sphinx marks every documented Python symbol with one of these dl classes.
  const selector = [
    'dl.py.function',
    'dl.py.method',
    'dl.py.class',
    'dl.py.attribute',
    'dl.py.data',
    'dl.py.exception',
  ].join(', ');

  for (const dl of doc.querySelectorAll(selector)) {
    const dt = dl.querySelector(':scope > dt[id]');
    const dd = dl.querySelector(':scope > dd');
    if (!dt || !dd) continue;

    const id = dt.getAttribute('id');
    if (!id) continue;

    entries[id] = {
      signature: cleanSignature(dt),
      description: firstDescription(dd),
      url: `${pageUrl}#${id}`,
    };
  }

  return entries;
}

/**
 * Discover linked sub-pages for a module index page.
 * Looks for <a href="…"> links within the toctree / body that point to
 * sibling pages matching the given pattern.
 */
function discoverSubPages(doc, pattern) {
  const pages = new Set();
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    // Match relative links like "machine.Pin.html" (no leading slash or domain)
    if (href && !href.startsWith('http') && !href.startsWith('#') && pattern.test(href)) {
      // Strip any fragment
      pages.add(href.split('#')[0]);
    }
  }
  return [...pages];
}

async function main() {
  const docs = {};
  let pageCount = 0;

  // --- Built-in functions: merge MicroPython stubs with CPython descriptions ---
  console.log('Fetching builtins.html (MicroPython)…');
  const mpyBuiltinsDoc = await fetchDoc(`${BASE}builtins.html`);
  const mpyBuiltins = extractFromPage(mpyBuiltinsDoc, 'builtins.html');
  pageCount++;
  await sleep(300);

  console.log('Fetching functions.html (CPython supplement)…');
  const cpyDoc = await fetchDoc(CPYTHON_BUILTINS_URL);
  const cpyEntries = extractFromPage(cpyDoc, 'functions.html');
  // cpyEntries keys are unqualified names (abs, print, …) — same as mpyBuiltins keys.
  // For each builtin, prefer CPython's richer signature/description but keep the
  // MicroPython URL so the "Open docs" link stays relevant.
  for (const [key, mpyEntry] of Object.entries(mpyBuiltins)) {
    const cpy = cpyEntries[key];
    if (cpy && (!mpyEntry.description || mpyEntry.signature === `${key}()`)) {
      docs[key] = {
        signature: cpy.signature,
        description: cpy.description,
        url: mpyEntry.url, // keep MicroPython link
      };
    } else {
      docs[key] = mpyEntry;
    }
  }
  pageCount++;
  await sleep(300);

  // --- Simple single-page modules ---
  for (const mod of SIMPLE_MODULES) {
    const file = `${mod}.html`;
    console.log(`Fetching ${file}…`);
    const doc = await fetchDoc(`${BASE}${file}`);
    Object.assign(docs, extractFromPage(doc, file));
    pageCount++;
    await sleep(300);
  }

  // --- Paged modules (index + auto-discovered sub-pages) ---
  for (const mod of PAGED_MODULES) {
    const indexFile = `${mod}.html`;
    console.log(`Fetching ${indexFile}…`);
    const indexDoc = await fetchDoc(`${BASE}${indexFile}`);
    Object.assign(docs, extractFromPage(indexDoc, indexFile));
    pageCount++;

    // Discover sub-pages, e.g. machine.Pin.html, network.WLAN.html
    const pattern = new RegExp(`^${mod}\\.[A-Z][\\w.]*\\.html$`);
    const subPages = discoverSubPages(indexDoc, pattern);
    console.log(`  Found ${subPages.length} sub-page(s) for ${mod}: ${subPages.join(', ')}`);

    for (const subFile of subPages) {
      await sleep(300);
      console.log(`  Fetching ${subFile}…`);
      try {
        const subDoc = await fetchDoc(`${BASE}${subFile}`);
        Object.assign(docs, extractFromPage(subDoc, subFile));
        pageCount++;
      } catch (err) {
        console.warn(`  Warning: could not fetch ${subFile}: ${err.message}`);
      }
    }
  }

  // Write output
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const json = JSON.stringify(docs, null, 2);
  writeFileSync(OUT_PATH, json, 'utf8');

  console.log(`\n✓ Wrote ${Object.keys(docs).length} entries from ${pageCount} pages`);
  console.log(`  → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
