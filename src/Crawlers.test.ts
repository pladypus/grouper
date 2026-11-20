import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import robotsTxt from "../public/robots.txt?raw";
import sitemapXml from "../public/sitemap.xml?raw";

// spec: stack-and-hosting.md (Crawlers): school web filters categorise the site by crawling it without
// running JS (#63), so index.html must describe Grouper as a classroom tool on its own.
// The full Lighthouse SEO audit is `npm run test:lighthouse` (lighthouserc.json).

const SITE = "https://grouper.pladypus.dev/";
const doc = new DOMParser().parseFromString(indexHtml, "text/html");
const meta = (selector: string) => doc.querySelector(selector)?.getAttribute("content") ?? "";

describe("index.html, as a crawler sees it without JS", () => {
  it("has a title and description that say it's a classroom tool for teachers", () => {
    expect(doc.title).toMatch(/student groups for teachers/i);
    expect(meta('meta[name="description"]')).toMatch(/classroom tool for teachers/i);
  });

  it("points the canonical link and og:url at the live site", () => {
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(SITE);
    expect(meta('meta[property="og:url"]')).toBe(SITE);
  });

  it("has Open Graph and Twitter tags", () => {
    for (const selector of [
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[name="twitter:card"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]',
    ]) {
      expect(meta(selector), selector).not.toBe("");
    }
    expect(meta('meta[property="og:image"]')).toMatch(/^https:\/\/grouper\.pladypus\.dev\//);
  });

  it("has JSON-LD that parses and calls it an educational app for teachers", () => {
    const script = doc.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? "null");
    expect(data).toMatchObject({
      "@type": "WebApplication",
      url: SITE,
      applicationCategory: "EducationalApplication",
      audience: { educationalRole: "teacher" },
    });
  });

  it("has static text inside #root describing Grouper", () => {
    const text = doc.getElementById("root")?.textContent?.replace(/\s+/g, " ") ?? "";
    expect(doc.querySelector("#root h1")?.textContent).toMatch(/student groups for teachers/i);
    expect(text).toMatch(/classroom tool for teachers/i);
    expect(text.length).toBeGreaterThan(300);
  });
});

describe("robots.txt and sitemap.xml", () => {
  it("robots.txt allows everything and names the sitemap", () => {
    expect(robotsTxt).toMatch(/^User-agent: \*$/m);
    expect(robotsTxt).toMatch(/^Allow: \/$/m);
    expect(robotsTxt).not.toMatch(/^Disallow: \S/m);
    expect(robotsTxt).toMatch(/^Sitemap: https:\/\/grouper\.pladypus\.dev\/sitemap\.xml$/m);
  });

  it("sitemap.xml lists the live site", () => {
    const sitemap = new DOMParser().parseFromString(sitemapXml, "application/xml");
    expect(sitemap.querySelector("parsererror")).toBeNull();
    expect([...sitemap.querySelectorAll("url > loc")].map((loc) => loc.textContent)).toEqual([SITE]);
  });
});
