#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// WiFi Configuration (from secrets.h)
// Copy src/secrets.example.h to src/secrets.h and fill in your credentials
#include "secrets.h"

// Default Server Configuration (can be overridden by remote config)
#define DEFAULT_BASE_URL "http://192.168.0.129:8000"
#define CONFIG_PATH "/config"

// SPI Pin Configuration (Waveshare ESP32 Driver Board defaults)
// Modify these values if using different pins
#define SPI_SCK 13
#define SPI_MISO 12
#define SPI_MOSI 14
#define SPI_SS 15

// Remote Config Structure
struct RemoteConfig
{
  String imageBaseUrl;
  String imagePath;
  String imageFormat;
  uint16_t imageThreshold;
  String imageUrl;
  String imageTemplate;
  uint16_t displayWidth;
  uint16_t displayHeight;
  uint16_t refreshIntervalSec;

  // Constructor with defaults
  RemoteConfig() : imageBaseUrl(DEFAULT_BASE_URL),
                   imagePath("/image"),
                   imageFormat("bmp"),
                   imageThreshold(128),
                   imageUrl(""),
                   imageTemplate(""),
                   displayWidth(800),
                   displayHeight(480),
                   refreshIntervalSec(60)
  {
  }
};

// Display Configuration
// 7.5" B/W V2 Display (800x480) with Waveshare ESP32 Driver Board
#include <GxEPD2_BW.h>
#include <gdey/GxEPD2_750_GDEY075T7.h>

// Display buffer size for ESP32
#define MAX_DISPLAY_BUFFER_SIZE 65536ul
#define MAX_HEIGHT(EPD) (EPD::HEIGHT <= MAX_DISPLAY_BUFFER_SIZE / (EPD::WIDTH / 8) ? EPD::HEIGHT : MAX_DISPLAY_BUFFER_SIZE / (EPD::WIDTH / 8))

#endif
