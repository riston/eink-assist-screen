#include "ui_renderer.h"
#include "app_state.h"
#include "display_driver.h"
#include "config_manager.h"
#include "http_client.h"
#include "error_icons.h"

// Include fonts for error screen
#include <Fonts/FreeMonoBold9pt7b.h>
#include <Fonts/FreeMonoBold12pt7b.h>
#include <Fonts/FreeMonoBold18pt7b.h>
#include <Fonts/FreeMonoBold24pt7b.h>

namespace UiRenderer {

void showError(const char* errorMsg, int errorCode, const uint8_t* icon) {
    DisplayDriver::setFullWindow();
    DisplayDriver::firstPage();

    do {
        DisplayDriver::fillScreen(GxEPD_WHITE);
        DisplayDriver::setTextColor(GxEPD_BLACK);

        int16_t centerX = DisplayDriver::width() / 2;
        int16_t centerY = DisplayDriver::height() / 2;

        // Draw decorative border around screen
        for (int i = 0; i < 3; i++) {
            DisplayDriver::drawRect(10 + i, 10 + i,
                DisplayDriver::width() - 20 - (i * 2),
                DisplayDriver::height() - 20 - (i * 2), GxEPD_BLACK);
        }

        int16_t currentY = 50;

        // Draw icon if provided, otherwise draw warning triangle
        if (icon != nullptr) {
            int16_t displayWidth = ICON_WIDTH * ICON_SCALE;
            int16_t displayHeight = ICON_HEIGHT * ICON_SCALE;
            int16_t iconX = centerX - displayWidth / 2;
            int16_t iconY = currentY;

            DisplayDriver::drawScaledBitmap(iconX, iconY, icon, ICON_WIDTH, ICON_HEIGHT, GxEPD_BLACK, ICON_SCALE);
            currentY = iconY + displayHeight + 30;
        } else {
            // Draw warning triangle (large and bold) - fallback
            int16_t triSize = 60;
            int16_t triTop = currentY;
            int16_t triBottom = currentY + triSize;

            for (int offset = 0; offset < 4; offset++) {
                DisplayDriver::drawLine(centerX, triTop + offset, centerX - triSize + offset, triBottom, GxEPD_BLACK);
                DisplayDriver::drawLine(centerX, triTop + offset, centerX + triSize - offset, triBottom, GxEPD_BLACK);
                DisplayDriver::drawLine(centerX - triSize + offset, triBottom, centerX + triSize - offset, triBottom, GxEPD_BLACK);
            }

            // Draw exclamation mark inside triangle (bold)
            int16_t exclamTop = triTop + 15;
            int16_t exclamBottom = triBottom - 20;
            DisplayDriver::fillRect(centerX - 5, exclamTop, 10, exclamBottom - exclamTop - 15, GxEPD_BLACK);
            DisplayDriver::fillCircle(centerX, exclamBottom - 5, 5, GxEPD_BLACK);

            currentY = triBottom + 40;
        }

        // Draw error title with underline
        DisplayDriver::setFont(&FreeMonoBold24pt7b);
        int16_t x1, y1;
        uint16_t w, h;
        DisplayDriver::getTextBounds("ERROR", 0, 0, &x1, &y1, &w, &h);

        int16_t titleX = centerX - w / 2;
        int16_t titleY = currentY + h;
        DisplayDriver::setCursor(titleX, titleY);
        DisplayDriver::print("ERROR");

        // Underline
        int16_t underlineY = titleY + 5;
        int16_t underlineWidth = w + 20;
        DisplayDriver::drawLine(centerX - underlineWidth / 2, underlineY, centerX + underlineWidth / 2, underlineY, GxEPD_BLACK);
        DisplayDriver::drawLine(centerX - underlineWidth / 2, underlineY + 2, centerX + underlineWidth / 2, underlineY + 2, GxEPD_BLACK);

        currentY = underlineY + 25;

        // Draw error message in a box
        DisplayDriver::setFont(&FreeMonoBold12pt7b);
        DisplayDriver::getTextBounds(errorMsg, 0, 0, &x1, &y1, &w, &h);

        int16_t boxPadding = 15;
        int16_t boxWidth = DisplayDriver::width() - 80;
        int16_t boxHeight = h + (boxPadding * 2);
        int16_t boxX = (DisplayDriver::width() - boxWidth) / 2;
        int16_t boxY = currentY;

        DisplayDriver::fillRect(boxX, boxY, boxWidth, boxHeight, GxEPD_BLACK);
        DisplayDriver::setTextColor(GxEPD_WHITE);

        int16_t msgX = centerX - w / 2;
        int16_t msgY = boxY + boxPadding + h;
        DisplayDriver::setCursor(msgX, msgY);
        DisplayDriver::print(errorMsg);
        DisplayDriver::setTextColor(GxEPD_BLACK);

        currentY = boxY + boxHeight + 25;

        // Draw error code if provided
        if (errorCode != 0) {
            DisplayDriver::setFont(&FreeMonoBold12pt7b);
            char codeStr[32];
            snprintf(codeStr, sizeof(codeStr), "Code: %d", errorCode);
            DisplayDriver::getTextBounds(codeStr, 0, 0, &x1, &y1, &w, &h);

            int16_t codeX = centerX - w / 2;
            int16_t codeY = currentY + h;
            DisplayDriver::setCursor(codeX, codeY);
            DisplayDriver::print(codeStr);

            currentY = codeY + 30;
        }

        // Draw help text at bottom
        DisplayDriver::setFont(&FreeMonoBold9pt7b);
        const char* helpText = "Check serial monitor";
        DisplayDriver::getTextBounds(helpText, 0, 0, &x1, &y1, &w, &h);

        int16_t helpY = DisplayDriver::height() - 35;
        int16_t iconRadius = 12;
        int16_t infoIconX = centerX - (w / 2) - iconRadius - 15;
        int16_t iconCenterY = helpY - h / 2;

        // Draw info icon (i in circle)
        DisplayDriver::drawCircle(infoIconX, iconCenterY, iconRadius, GxEPD_BLACK);
        DisplayDriver::drawCircle(infoIconX, iconCenterY, iconRadius - 1, GxEPD_BLACK);
        DisplayDriver::fillRect(infoIconX - 3, iconCenterY - 2, 6, 8, GxEPD_BLACK);
        DisplayDriver::fillCircle(infoIconX, iconCenterY - 8, 3, GxEPD_BLACK);

        int16_t helpTextX = infoIconX + iconRadius + 10;
        DisplayDriver::setCursor(helpTextX, helpY);
        DisplayDriver::print(helpText);

    } while (DisplayDriver::nextPage());

    Serial.println("Error screen displayed");
}

bool showRemoteImage(AppState& state) {
    DisplayDriver::setFullWindow();
    DisplayDriver::firstPage();

    int totalPixels = state.config.displayWidth * state.config.displayHeight;
    int pixelsPerChunk = totalPixels / RENDER_CHUNKS;
    int bytesPerChunk = pixelsPerChunk / 8;
    int rowsPerChunk = state.config.displayHeight / RENDER_CHUNKS;

    Serial.printf("Starting incremental render: %d chunks of %d pixels (%d bytes, %d rows) each\n",
                  RENDER_CHUNKS, pixelsPerChunk, bytesPerChunk, rowsPerChunk);

    for (int chunk = 0; chunk < RENDER_CHUNKS; chunk++) {
        int chunkOffsetBytes = BMP_HEADER_SIZE + (chunk * bytesPerChunk);
        int chunkLimitBytes = bytesPerChunk;

        String url = ConfigManager::buildImageUrl(state.config, chunkOffsetBytes, chunkLimitBytes);

        Serial.printf("Chunk %d/%d - offset=%d bytes, limit=%d bytes\n",
                      chunk + 1, RENDER_CHUNKS, chunkOffsetBytes, chunkLimitBytes);
        Serial.printf("URL: %s\n", url.c_str());

        HttpConnection http;
        if (!http.begin(url, 50000)) {
            Serial.println("WiFi not connected");
            showError("WiFi not connected", 0, ICON_WIFI_ERROR);
            return false;
        }

        int httpCode = http.get();
        Serial.printf("HTTP response: %d\n", httpCode);

        if (httpCode != 200) {
            Serial.printf("HTTP request failed: %d\n", httpCode);
            http.end();
            showError("HTTP request failed", httpCode, ICON_HTTP_ERROR);
            return false;
        }

        int sz = http.getResponseSize();
        Serial.printf("Response size: %d bytes\n", sz);

        if (sz <= 0) {
            Serial.println("Invalid response size");
            http.end();
            showError("Invalid response size", 0);
            return false;
        }

        WiFiClient* stream = http.getStream();

        if (sz != bytesPerChunk) {
            Serial.printf("Warning: expected %d bytes, server sent %d bytes\n", bytesPerChunk, sz);
        }

        int bytesRead = stream->readBytes(state.bmpBuffer, bytesPerChunk);
        Serial.printf("Read %d bytes of image data\n", bytesRead);

        if (bytesRead < bytesPerChunk) {
            Serial.printf("Warning: incomplete read. Expected %d, got %d\n", bytesPerChunk, bytesRead);
        }

        // Invert colors (BMP uses opposite polarity from e-ink display)
        for (int i = 0; i < bytesRead; i++) {
            state.bmpBuffer[i] = ~state.bmpBuffer[i];
        }

        int yPos = chunk * rowsPerChunk;

        do {
            DisplayDriver::drawBitmap(0, yPos, state.bmpBuffer, state.config.displayWidth, rowsPerChunk, GxEPD_BLACK);
        } while (DisplayDriver::nextPage());

        Serial.printf("Chunk %d/%d complete\n", chunk + 1, RENDER_CHUNKS);
        http.end();
    }

    Serial.println("Image display complete!");
    return true;
}

}  // namespace UiRenderer
