/// <reference lib="dom" />
import { chromium } from "playwright";
import { parseArgs } from "node:util";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

async function downloadImage(url: string, filepath: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(filepath, buffer);
}

async function main() {
  // Parse command line arguments
  const { values } = parseArgs({
    options: {
      search: { type: "string" },
      headless: { type: "boolean", default: true },
    },
  });

  if (!values.search) {
    console.error("Please provide a search term using --search");
    process.exit(1);
  }

  // Launch the browser
  const browser = await chromium.launch({ headless: values.headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Google Images
    await page.goto("https://images.google.com");

    // Handle consent dialog if it appears
    try {
      const consentButton = await page.waitForSelector(
        'button:has-text("Accept all")',
        { timeout: 5000 }
      );
      if (consentButton) {
        await consentButton.click();
        // Wait a bit for the dialog to disappear
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Consent dialog didn't appear, which is fine
      console.log("No consent dialog found, continuing...");
    }

    // Wait for and fill the search input
    console.log("Waiting for search input...");
    try {
      await page.waitForSelector('textarea[name="q"]', { timeout: 10000 });
    } catch (e) {
      console.error(
        "Search input not found! Taking screenshot and dumping HTML..."
      );
      await page.screenshot({ path: "debug-screenshot.png" });
      const html = await page.content();
      writeFileSync("debug-page.html", html);
      throw e;
    }
    await page.fill('textarea[name="q"]', `"${values.search}"`);
    console.log("Search term entered:", values.search);

    // Click the search button
    console.log("Clicking search button...");
    await page.click('input[type="submit"]');

    // Wait for the search results to load
    console.log("Waiting for search results...");

    // Wait for the search results container
    await page.waitForSelector("div#rso", { timeout: 10000 });
    
    // Move mouse over each link
    console.log("Moving mouse over each link...");
    const linkElements = await page.$$("#rso h3 > a");
    for (const link of linkElements) {
      await link.hover();
      // Small delay to ensure hover state is registered
      await page.waitForTimeout(100);
    }

    // Move mouse over each link before evaluating
    const links = await page.evaluate(async () => {
      const results =
        document.querySelectorAll<HTMLAnchorElement>("#rso h3 > a");
      return Array.from(results)
        .map((link: { href: string }) => {
          console.log(link);
          if (link?.href) {
            const url = new URL(link.href);
            return url.searchParams.get("imgurl");
          }
          return null;
        })
        .filter(Boolean);
    });

    console.log("Found links:", links);

    // Create directory for images
    const searchDir = values.search.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dirPath = join(process.cwd(), 'results', searchDir);
    
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath);
    }

    // Download each image
    for (const [index, imageUrl] of links.entries()) {
      if (!imageUrl) continue; // Skip null URLs
      
      try {
        // Create a filename from the URL or use index as fallback
        const urlObj = new URL(imageUrl);
        const pathname = urlObj.pathname;
        const extension = pathname.split('.').pop() || 'jpg';
        const filename = `${index + 1}_${createHash('md5').update(imageUrl).digest('hex').slice(0, 8)}.${extension}`;
        const filepath = join(dirPath, filename);

        console.log(`Downloading image ${index + 1}/${links.length}: ${filename}`);
        await downloadImage(imageUrl, filepath);
      } catch (error) {
        console.error(`Failed to download image ${imageUrl}:`, error);
      }
    }

    console.log("Search completed successfully!");

    // Keep the browser open for now
    if (!values.headless) {
      await new Promise(() => {});
    }
  } catch (error) {
    console.error("An error occurred:", error);
    await browser.close();
    process.exit(1);
  }
}

main().catch(console.error);
