#ifndef DISPLAY_DRIVER_H
#define DISPLAY_DRIVER_H

#include <Arduino.h>
#include "config.h"

namespace DisplayDriver {
    // Initialize SPI and display hardware
    void init();

    // Get display dimensions
    int16_t width();
    int16_t height();

    // Set display rotation (0-3)
    void setRotation(uint8_t rotation);

    // Prepare for full window update
    void setFullWindow();

    // Prepare for partial window update (only redraws specified region)
    void setPartialWindow(uint16_t x, uint16_t y, uint16_t w, uint16_t h);

    // Begin paged drawing
    void firstPage();

    // Continue to next page, returns false when done
    bool nextPage();

    // Fill screen with color
    void fillScreen(uint16_t color);

    // Set text color
    void setTextColor(uint16_t color);

    // Set font
    void setFont(const GFXfont* font);

    // Set cursor position
    void setCursor(int16_t x, int16_t y);

    // Get text bounds
    void getTextBounds(const char* str, int16_t x, int16_t y,
                       int16_t* x1, int16_t* y1, uint16_t* w, uint16_t* h);

    // Print text
    void print(const char* str);

    // Drawing primitives
    void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
    void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);
    void drawCircle(int16_t x, int16_t y, int16_t r, uint16_t color);
    void fillCircle(int16_t x, int16_t y, int16_t r, uint16_t color);
    void drawPixel(int16_t x, int16_t y, uint16_t color);

    // Draw bitmap at position
    void drawBitmap(int16_t x, int16_t y, const uint8_t* bitmap,
                    int16_t w, int16_t h, uint16_t color);

    // Draw scaled bitmap from PROGMEM
    void drawScaledBitmap(int16_t x, int16_t y, const uint8_t* bitmap,
                          int16_t w, int16_t h, uint16_t color, uint8_t scale);
}

#endif
