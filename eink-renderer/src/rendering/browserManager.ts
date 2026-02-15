import puppeteer, { Browser } from "puppeteer";

export interface BrowserManager {
  getBrowser: () => Promise<Browser>;
  close: () => Promise<void>;
}

export function createBrowserManager(): BrowserManager {
  let browserInstance: Browser | null = null;
  let isRemote = false;

  return {
    getBrowser: async () => {
      // Read at runtime so env vars set by loadConfig() are picked up
      const wsEndpoint = process.env.BROWSER_WS_ENDPOINT || "";

      if (!browserInstance || !browserInstance.connected) {
        if (wsEndpoint) {
          browserInstance = await puppeteer.connect({
            browserWSEndpoint: wsEndpoint,
          });
          isRemote = true;
        } else {
          browserInstance = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });
          isRemote = false;
        }
      }
      return browserInstance;
    },
    close: async () => {
      if (browserInstance) {
        if (isRemote) {
          browserInstance.disconnect();
        } else {
          await browserInstance.close();
        }
        browserInstance = null;
      }
    },
  };
}
