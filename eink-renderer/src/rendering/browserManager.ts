import puppeteer, { Browser } from "puppeteer";
import { BROWSER_WS_ENDPOINT } from "../core/constants.js";

export interface BrowserManager {
  getBrowser: () => Promise<Browser>;
  close: () => Promise<void>;
}

export function createBrowserManager(): BrowserManager {
  let browserInstance: Browser | null = null;
  let isRemote = false;

  return {
    getBrowser: async () => {
      if (!browserInstance || !browserInstance.connected) {
        if (BROWSER_WS_ENDPOINT) {
          browserInstance = await puppeteer.connect({
            browserWSEndpoint: BROWSER_WS_ENDPOINT,
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
