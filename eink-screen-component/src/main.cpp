// Display: 7.5inch black and white model V2 (800x480)

#include <config.h>

#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <ArduinoJson.h>

// Include fonts
#include <Fonts/FreeMonoBold9pt7b.h>
#include <Fonts/FreeMonoBold12pt7b.h>
#include <Fonts/FreeMonoBold18pt7b.h>
#include <Fonts/FreeMonoBold24pt7b.h>

// Instantiate the display object (declared extern in config.h)
GxEPD2_BW<GxEPD2_750_GDEY075T7, MAX_HEIGHT(GxEPD2_750_GDEY075T7)> display(GxEPD2_750_GDEY075T7(/*CS=*/15, /*DC=*/27, /*RST=*/26, /*BUSY=*/25));

WiFiMulti wiFiMulti;
RemoteConfig config; // Global config object

// Monochrome display: 1 bit per pixel, 8 pixels per byte
const int BITMAP_SIZE = 800 * 480 / 8; // Total bytes for full screen (48000 bytes)

// Number of chunks to split rendering into (more chunks = smaller memory, more requests)
const int RENDER_CHUNKS = 3;                        // Adjust this: 2, 4, 8, 10, etc.
const int CHUNK_SIZE = BITMAP_SIZE / RENDER_CHUNKS; // Bytes per chunk

uint8_t bmp[CHUNK_SIZE]; // Buffer for one chunk

unsigned long lastRefreshTime = 0; // Track when we last refreshed the display

void setupWifi()
{
  Serial.printf("Connecting to WIFI SSID: %s\n", WIFI_SSID);
  wiFiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);
  while (wiFiMulti.run() != WL_CONNECTED)
  {
    delay(100);
    Serial.println((char)WiFi.status());
  }
  Serial.println("Connected to Wifi!");
}

bool loadRemoteConfig()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi not connected - cannot load config");
    return false;
  }

  String url = config.imageBaseUrl + CONFIG_PATH;
  Serial.printf("Loading config from: %s\n", url.c_str());

  WiFiClient client;
  HTTPClient http;

  if (!http.begin(client, url))
  {
    Serial.println("http.begin() failed for config");
    return false;
  }

  http.setTimeout(10000);
  int httpCode = http.GET();
  Serial.printf("Config HTTP response: %d\n", httpCode);

  if (httpCode == 200)
  {
    String payload = http.getString();
    Serial.printf("Config payload: %s\n", payload.c_str());

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error)
    {
      Serial.printf("JSON parse error: %s\n", error.c_str());
      http.end();
      return false;
    }

    // Update config from JSON
    if (doc.containsKey("image"))
    {
      if (doc["image"].containsKey("base_url"))
        config.imageBaseUrl = doc["image"]["base_url"].as<String>();
      if (doc["image"].containsKey("path"))
        config.imagePath = doc["image"]["path"].as<String>();

      // Parse image parameters
      if (doc["image"].containsKey("parameters"))
      {
        JsonObject params = doc["image"]["parameters"];
        if (params.containsKey("format"))
          config.imageFormat = params["format"].as<String>();
        if (params.containsKey("threshold"))
          config.imageThreshold = params["threshold"];
        if (params.containsKey("url"))
          config.imageUrl = params["url"].as<String>();
        if (params.containsKey("template"))
          config.imageTemplate = params["template"].as<String>();
      }
    }

    if (doc.containsKey("display"))
    {
      if (doc["display"].containsKey("width"))
        config.displayWidth = doc["display"]["width"];
      if (doc["display"].containsKey("height"))
        config.displayHeight = doc["display"]["height"];
      if (doc["display"].containsKey("refresh_interval_sec"))
        config.refreshIntervalSec = doc["display"]["refresh_interval_sec"];
    }

    Serial.println("Config loaded successfully:");
    Serial.printf("  Image URL: %s%s\n", config.imageBaseUrl.c_str(), config.imagePath.c_str());
    Serial.printf("  Image params - format: %s, threshold: %d\n",
                  config.imageFormat.c_str(), config.imageThreshold);
    if (config.imageUrl.length() > 0)
    {
      Serial.printf("  Image URL param: %s\n", config.imageUrl.c_str());
    }
    if (config.imageTemplate.length() > 0)
    {
      Serial.printf("  Template: %s\n", config.imageTemplate.c_str());
    }
    Serial.printf("  Display: %dx%d\n", config.displayWidth, config.displayHeight);
    Serial.printf("  Refresh interval: %d sec\n", config.refreshIntervalSec);

    http.end();
    return true;
  }

  http.end();
  Serial.println("Failed to load config, using defaults");
  return false;
}

void displayErrorScreen(const char *errorMsg, int errorCode = 0)
{
  display.setFullWindow();
  display.firstPage();

  do
  {
    display.fillScreen(GxEPD_WHITE);
    display.setTextColor(GxEPD_BLACK);

    int16_t centerX = display.width() / 2;  // 400
    int16_t centerY = display.height() / 2; // 240

    // Draw decorative border around screen
    for (int i = 0; i < 3; i++)
    {
      display.drawRect(10 + i, 10 + i, display.width() - 20 - (i * 2), display.height() - 20 - (i * 2), GxEPD_BLACK);
    }

    // Calculate layout from top to bottom
    int16_t currentY = 50; // Start from top with margin

    // Draw warning triangle (large and bold)
    int16_t triSize = 60;
    int16_t triTop = currentY;
    int16_t triBottom = currentY + triSize;

    // Triangle outline (thick lines by drawing multiple times)
    for (int offset = 0; offset < 4; offset++)
    {
      display.drawLine(centerX, triTop + offset, centerX - triSize + offset, triBottom, GxEPD_BLACK);
      display.drawLine(centerX, triTop + offset, centerX + triSize - offset, triBottom, GxEPD_BLACK);
      display.drawLine(centerX - triSize + offset, triBottom, centerX + triSize - offset, triBottom, GxEPD_BLACK);
    }

    // Draw exclamation mark inside triangle (bold)
    int16_t exclamTop = triTop + 15;
    int16_t exclamBottom = triBottom - 20;
    // Exclamation line (thick)
    display.fillRect(centerX - 5, exclamTop, 10, exclamBottom - exclamTop - 15, GxEPD_BLACK);
    // Exclamation dot (circle)
    display.fillCircle(centerX, exclamBottom - 5, 5, GxEPD_BLACK);

    currentY = triBottom + 40; // Space after triangle

    // Draw error title with underline using getTextBounds
    display.setFont(&FreeMonoBold24pt7b);
    int16_t x1, y1;
    uint16_t w, h;
    display.getTextBounds("ERROR", 0, 0, &x1, &y1, &w, &h);

    int16_t titleX = centerX - w / 2;
    int16_t titleY = currentY + h; // Baseline position
    display.setCursor(titleX, titleY);
    display.print("ERROR");

    // Underline beneath the text
    int16_t underlineY = titleY + 5;
    int16_t underlineWidth = w + 20;
    display.drawLine(centerX - underlineWidth / 2, underlineY, centerX + underlineWidth / 2, underlineY, GxEPD_BLACK);
    display.drawLine(centerX - underlineWidth / 2, underlineY + 2, centerX + underlineWidth / 2, underlineY + 2, GxEPD_BLACK);

    currentY = underlineY + 25; // Space after title

    // Draw error message in a box
    display.setFont(&FreeMonoBold12pt7b);
    display.getTextBounds(errorMsg, 0, 0, &x1, &y1, &w, &h);

    int16_t boxPadding = 15;
    int16_t boxWidth = display.width() - 80;
    int16_t boxHeight = h + (boxPadding * 2);
    int16_t boxX = (display.width() - boxWidth) / 2;
    int16_t boxY = currentY;

    display.fillRect(boxX, boxY, boxWidth, boxHeight, GxEPD_BLACK);
    display.setTextColor(GxEPD_WHITE);

    // Center text in box
    int16_t msgX = centerX - w / 2;
    int16_t msgY = boxY + boxPadding + h;
    display.setCursor(msgX, msgY);
    display.print(errorMsg);
    display.setTextColor(GxEPD_BLACK);

    currentY = boxY + boxHeight + 25; // Space after message box

    // Draw error code if provided
    if (errorCode != 0)
    {
      display.setFont(&FreeMonoBold12pt7b);
      char codeStr[32];
      snprintf(codeStr, sizeof(codeStr), "Code: %d", errorCode);
      display.getTextBounds(codeStr, 0, 0, &x1, &y1, &w, &h);

      int16_t codeX = centerX - w / 2;
      int16_t codeY = currentY + h;
      display.setCursor(codeX, codeY);
      display.print(codeStr);

      currentY = codeY + 30; // Space after error code
    }

    // Draw help text with icon at bottom
    display.setFont(&FreeMonoBold9pt7b);
    const char *helpText = "Check serial monitor";
    display.getTextBounds(helpText, 0, 0, &x1, &y1, &w, &h);

    int16_t helpY = display.height() - 35; // Fixed position from bottom
    int16_t iconRadius = 12;
    int16_t iconX = centerX - (w / 2) - iconRadius - 15;
    int16_t iconCenterY = helpY - h / 2;

    // Draw info icon (i in circle)
    display.drawCircle(iconX, iconCenterY, iconRadius, GxEPD_BLACK);
    display.drawCircle(iconX, iconCenterY, iconRadius - 1, GxEPD_BLACK);
    display.fillRect(iconX - 3, iconCenterY - 2, 6, 8, GxEPD_BLACK);
    display.fillCircle(iconX, iconCenterY - 8, 3, GxEPD_BLACK);

    int16_t helpTextX = iconX + iconRadius + 10;
    display.setCursor(helpTextX, helpY);
    display.print(helpText);

  } while (display.nextPage());

  Serial.println("Error screen displayed");
}

void displayImage()
{
  display.setFullWindow();
  display.firstPage();

  // Calculate pixels and bytes per chunk
  int totalPixels = config.displayWidth * config.displayHeight;
  int pixelsPerChunk = totalPixels / RENDER_CHUNKS;
  int bytesPerChunk = pixelsPerChunk / 8; // 1 bit per pixel = 8 pixels per byte
  int rowsPerChunk = config.displayHeight / RENDER_CHUNKS;

  Serial.printf("Starting incremental render: %d chunks of %d pixels (%d bytes, %d rows) each\n",
                RENDER_CHUNKS, pixelsPerChunk, bytesPerChunk, rowsPerChunk);

  // BMP header size (typically 62 bytes for 1-bit BMP)
  const int BMP_HEADER_SIZE = 62;

  // Render in multiple chunks (server now returns top-down data)
  for (int chunk = 0; chunk < RENDER_CHUNKS; chunk++)
  {
    // Calculate offset and limit in BYTES (skip BMP header)
    int chunkOffsetBytes = BMP_HEADER_SIZE + (chunk * bytesPerChunk);
    int chunkLimitBytes = bytesPerChunk;

    // Build URL for this chunk
    char url[2048];
    int urlLen;

    // Build URL with template parameter (excluding url) or with url parameter (excluding template)
    if (config.imageTemplate.length() > 0)
    {
      // When template is provided, use template instead of url parameter
      urlLen = snprintf(url, sizeof(url), "%s%s?format=%s&threshold=%d&template=%s&offset=%d&limit=%d",
                        config.imageBaseUrl.c_str(),
                        config.imagePath.c_str(),
                        config.imageFormat.c_str(),
                        config.imageThreshold,
                        config.imageTemplate.c_str(),
                        chunkOffsetBytes,
                        chunkLimitBytes);
    }
    else
    {
      // When template is not provided, use url parameter
      urlLen = snprintf(url, sizeof(url), "%s%s?url=%s&format=%s&threshold=%d&offset=%d&limit=%d",
                        config.imageBaseUrl.c_str(),
                        config.imagePath.c_str(),
                        config.imageUrl.c_str(),
                        config.imageFormat.c_str(),
                        config.imageThreshold,
                        chunkOffsetBytes,
                        chunkLimitBytes);
    }

    if (urlLen < 0 || urlLen >= (int)sizeof(url))
    {
      Serial.printf("Error: URL too long for chunk %d\n", chunk);
      displayErrorScreen("URL too long", 0);
      return;
    }

    Serial.printf("Chunk %d/%d - offset=%d bytes, limit=%d bytes\n", chunk + 1, RENDER_CHUNKS, chunkOffsetBytes, chunkLimitBytes);
    Serial.printf("URL: %s\n", url);

    // Make HTTP request for this chunk
    WiFiClient client;
    HTTPClient http;

    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("WiFi not connected");
      displayErrorScreen("WiFi not connected", 0);
      return;
    }

    if (!http.begin(client, url))
    {
      Serial.println("http.begin() failed");
      displayErrorScreen("Failed to connect", 0);
      return;
    }

    http.setTimeout(50000);
    int httpCode = http.GET();
    Serial.printf("HTTP response: %d\n", httpCode);

    if (httpCode == 200)
    {
      int sz = http.getSize();
      Serial.printf("Response size: %d bytes\n", sz);

      if (sz <= 0)
      {
        Serial.println("Invalid response size");
        http.end();
        displayErrorScreen("Invalid response size", 0);
        return;
      }

      WiFiClient *stream = http.getStreamPtr();

      // Verify expected chunk size
      if (sz != bytesPerChunk)
      {
        Serial.printf("Warning: expected %d bytes, server sent %d bytes\n", bytesPerChunk, sz);
      }

      // Read the chunk data
      int bytesRead = stream->readBytes(bmp, bytesPerChunk);
      Serial.printf("Read %d bytes of image data\n", bytesRead);

      if (bytesRead < bytesPerChunk)
      {
        Serial.printf("Warning: incomplete read. Expected %d, got %d\n", bytesPerChunk, bytesRead);
      }

      // Process each byte: invert colors
      for (int i = 0; i < bytesRead; i++)
      {
        // Invert colors (BMP uses opposite polarity from e-ink display)
        bmp[i] = ~bmp[i];
      }

      // Calculate Y position - server returns top-down data
      // chunk=0 (top) -> yPos=0
      // chunk=7 (bottom) -> yPos=420
      int yPos = chunk * rowsPerChunk;

      // Draw this chunk to the display
      do
      {
        display.drawBitmap(0, yPos, bmp, config.displayWidth, rowsPerChunk, GxEPD_BLACK);
      } while (display.nextPage());

      Serial.printf("Chunk %d/%d complete\n", chunk + 1, RENDER_CHUNKS);
    }
    else
    {
      Serial.printf("HTTP request failed: %d\n", httpCode);
      http.end();
      displayErrorScreen("HTTP request failed", httpCode);
      return;
    }

    http.end();
  }

  Serial.println("Image display complete!");
}

void setup()
{
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("=================================");
  Serial.println("7.5\" e-Paper Rectangle Demo");
  Serial.println("=================================");

  // Initialize SPI with configured pins (set in config.h)
  Serial.println("Initializing SPI...");
  Serial.printf("Using SPI pins - SCK: %d, MISO: %d, MOSI: %d, SS: %d\n",
                SPI_SCK, SPI_MISO, SPI_MOSI, SPI_SS);
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SPI_SS);

  // Initialize the display
  Serial.println("Initializing display...");
  display.init(115200); // enable diagnostic output on Serial

  setupWifi();

  // Load remote configuration
  loadRemoteConfig();

  Serial.println("Display initialized");

  // Set rotation (0=normal, 1=90°, 2=180°, 3=270°)
  display.setRotation(0);

  Serial.print("Display dimensions - Width: ");
  Serial.print(display.width());
  Serial.print(", Height: ");
  Serial.println(display.height());

  // Display the initial image
  Serial.println("Loading initial image...");
  displayImage();
  lastRefreshTime = millis();

  Serial.printf("Image will refresh every %d seconds\n", config.refreshIntervalSec);
}

void loop()
{
  unsigned long currentTime = millis();
  unsigned long elapsedSeconds = (currentTime - lastRefreshTime) / 1000;

  // Check if it's time to refresh based on config
  if (elapsedSeconds >= config.refreshIntervalSec)
  {
    Serial.printf("Refresh interval reached (%d seconds). Reloading config and image...\n", config.refreshIntervalSec);

    // Reconnect WiFi if disconnected
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("WiFi disconnected. Reconnecting...");
      while (wiFiMulti.run() != WL_CONNECTED)
      {
        delay(100);
      }
      Serial.println("WiFi reconnected");
    }

    // Reload configuration (in case it changed)
    loadRemoteConfig();

    // Display the updated image
    displayImage();

    // Update last refresh time
    lastRefreshTime = currentTime;

    Serial.printf("Next refresh in %d seconds\n", config.refreshIntervalSec);
  }

  // Small delay to prevent busy waiting
  delay(1000);
}
