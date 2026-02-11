#ifndef UI_RENDERER_H
#define UI_RENDERER_H

#include <Arduino.h>
#include "config.h"

// Forward declare
struct AppState;

namespace UiRenderer {
    // Display error screen with optional icon
    // icon can be ICON_WIFI_ERROR, ICON_SERVER_ERROR, ICON_HTTP_ERROR, or nullptr
    void showError(const char* message, int errorCode = 0, const uint8_t* icon = nullptr);

    // Display small error indicator in top right corner (non-destructive)
    // Use when previous image was successfully rendered to avoid clearing the screen
    void showErrorIndicator(const uint8_t* icon = nullptr);

    // Display image from remote server using chunked loading
    // Returns true on success
    bool showRemoteImage(AppState& state);
}

#endif
