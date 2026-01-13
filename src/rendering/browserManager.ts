import puppeteer, { Browser } from "puppeteer";

export interface BrowserManager {
  getBrowser: () => Promise<Browser>;
  close: () => Promise<void>;
}

export function createBrowserManager(): BrowserManager {
  let browserInstance: Browser | null = null;

  return {
    getBrowser: async () => {
      if (!browserInstance || !browserInstance.connected) {
        browserInstance = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }
      return browserInstance;
    },
    close: async () => {
      if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
      }
    },
  };
}
