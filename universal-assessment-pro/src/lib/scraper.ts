/**
 * Web scraper for universalbank.uz and cbu.uz knowledge sources.
 * Uses cheerio for HTML parsing; fetch for HTTP requests.
 */

import * as cheerio from "cheerio";

export interface ScrapedPage {
  url:     string;
  title:   string;
  content: string; // clean text, max ~6000 chars
}

const SCRAPE_TIMEOUT_MS = 15_000;
const MAX_CONTENT_CHARS = 6_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; UniversalAssessmentBot/1.0; +https://universalbank.uz)";

// ─── Main scrape function ─────────────────────────────────────────────────────

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  let html: string;
  try {
    const resp = await fetch(url, {
      signal:  controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    html = await resp.text();
  } finally {
    clearTimeout(timeout);
  }

  return parseHtml(url, html);
}

// ─── Parse HTML → clean text ──────────────────────────────────────────────────

function parseHtml(url: string, html: string): ScrapedPage {
  const $ = cheerio.load(html);

  // Remove noise elements
  $("script, style, noscript, nav, header, footer, aside, iframe, form, button, [aria-hidden='true']").remove();

  // Extract title
  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled";

  // Candidate content containers (priority order)
  const candidates = [
    "article",
    "main",
    ".content",
    "#content",
    ".entry-content",
    ".post-content",
    ".page-content",
    ".article-body",
    "section",
    "body",
  ];

  let rawText = "";
  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.length) {
      rawText = el.text();
      break;
    }
  }

  // Normalise whitespace
  const content = rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CONTENT_CHARS);

  return { url, title, content };
}

// ─── Seed URLs ────────────────────────────────────────────────────────────────

export const DEFAULT_SOURCES: Array<{ url: string; type: string; description: string }> = [
  {
    url:         "https://cbu.uz/uz/arkhiv-kursov-valyut/",
    type:        "CBU_GUIDELINES",
    description: "CBU official exchange rates page",
  },
  {
    url:         "https://cbu.uz/uz/monetary-policy/",
    type:        "CBU_GUIDELINES",
    description: "CBU monetary policy overview",
  },
  {
    url:         "https://universalbank.uz/uz/about/",
    type:        "BANK_WEBSITE",
    description: "Universalbank — About Us",
  },
  {
    url:         "https://universalbank.uz/uz/for-individuals/",
    type:        "BANK_WEBSITE",
    description: "Universalbank — Products for individuals",
  },
  {
    url:         "https://universalbank.uz/uz/for-business/",
    type:        "BANK_WEBSITE",
    description: "Universalbank — Products for businesses",
  },
];
