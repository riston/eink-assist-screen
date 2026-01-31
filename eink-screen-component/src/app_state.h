#ifndef APP_STATE_H
#define APP_STATE_H

#include <config.h>
#include <WiFiMulti.h>

// Rendering constants
constexpr int RENDER_CHUNKS = 3;
constexpr int BITMAP_SIZE = 800 * 480 / 8;  // Total bytes for full screen (48000 bytes)
constexpr int CHUNK_SIZE = BITMAP_SIZE / RENDER_CHUNKS;
constexpr int BMP_HEADER_SIZE = 62;

// Centralized application state
struct AppState {
    RemoteConfig config;
    WiFiMulti wifiMulti;
    uint8_t bmpBuffer[CHUNK_SIZE];
    unsigned long lastRefreshTime;

    AppState() : lastRefreshTime(0) {}
};

#endif
