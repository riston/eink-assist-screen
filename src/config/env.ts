import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const dotenvPath = path.resolve(process.cwd(), ".env");

if (existsSync(dotenvPath)) {
  const result = dotenv.config({ path: dotenvPath });
  if (result.error) {
    console.warn("Failed to load .env from", dotenvPath, result.error);
  } else {
    console.info("Loaded .env from", dotenvPath);
  }
} else {
  // Try default dotenv behavior (no-op if no .env)
  dotenv.config();
}
