#include "display_driver.h"
#include <SPI.h>

// Include fonts
#include <Fonts/FreeMonoBold9pt7b.h>
#include <Fonts/FreeMonoBold12pt7b.h>
#include <Fonts/FreeMonoBold18pt7b.h>
#include <Fonts/FreeMonoBold24pt7b.h>

// Display instance with Waveshare ESP32 Driver Board pins
static GxEPD2_BW<GxEPD2_750_GDEY075T7, MAX_HEIGHT(GxEPD2_750_GDEY075T7)> display(
    GxEPD2_750_GDEY075T7(/*CS=*/15, /*DC=*/27, /*RST=*/26, /*BUSY=*/25));

namespace DisplayDriver {

void init() {
    Serial.println("Initializing SPI...");
    Serial.printf("Using SPI pins - SCK: %d, MISO: %d, MOSI: %d, SS: %d\n",
                  SPI_SCK, SPI_MISO, SPI_MOSI, SPI_SS);
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SPI_SS);

    Serial.println("Initializing display...");
    display.init(115200);
    Serial.println("Display initialized");

    Serial.printf("Display dimensions - Width: %d, Height: %d\n",
                  display.width(), display.height());
}

int16_t width() {
    return display.width();
}

int16_t height() {
    return display.height();
}

void setRotation(uint8_t rotation) {
    display.setRotation(rotation);
}

void setFullWindow() {
    display.setFullWindow();
}

void setPartialWindow(uint16_t x, uint16_t y, uint16_t w, uint16_t h) {
    display.setPartialWindow(x, y, w, h);
}

void firstPage() {
    display.firstPage();
}

bool nextPage() {
    return display.nextPage();
}

void fillScreen(uint16_t color) {
    display.fillScreen(color);
}

void setTextColor(uint16_t color) {
    display.setTextColor(color);
}

void setFont(const GFXfont* font) {
    display.setFont(font);
}

void setCursor(int16_t x, int16_t y) {
    display.setCursor(x, y);
}

void getTextBounds(const char* str, int16_t x, int16_t y,
                   int16_t* x1, int16_t* y1, uint16_t* w, uint16_t* h) {
    display.getTextBounds(str, x, y, x1, y1, w, h);
}

void print(const char* str) {
    display.print(str);
}

void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    display.drawRect(x, y, w, h, color);
}

void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
    display.fillRect(x, y, w, h, color);
}

void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color) {
    display.drawLine(x0, y0, x1, y1, color);
}

void drawCircle(int16_t x, int16_t y, int16_t r, uint16_t color) {
    display.drawCircle(x, y, r, color);
}

void fillCircle(int16_t x, int16_t y, int16_t r, uint16_t color) {
    display.fillCircle(x, y, r, color);
}

void drawPixel(int16_t x, int16_t y, uint16_t color) {
    display.drawPixel(x, y, color);
}

void drawBitmap(int16_t x, int16_t y, const uint8_t* bitmap,
                int16_t w, int16_t h, uint16_t color) {
    display.drawBitmap(x, y, bitmap, w, h, color);
}

void drawScaledBitmap(int16_t x, int16_t y, const uint8_t* bitmap,
                      int16_t w, int16_t h, uint16_t color, uint8_t scale) {
    int16_t byteWidth = (w + 7) / 8;

    for (int16_t row = 0; row < h; row++) {
        for (int16_t col = 0; col < w; col++) {
            uint8_t byte = pgm_read_byte(bitmap + row * byteWidth + col / 8);
            bool pixelSet = byte & (0x80 >> (col % 8));

            if (pixelSet) {
                if (scale == 1) {
                    display.drawPixel(x + col, y + row, color);
                } else {
                    display.fillRect(x + col * scale, y + row * scale, scale, scale, color);
                }
            }
        }
    }
}

}  // namespace DisplayDriver
