// E-ink Display Controller
// 7.5inch black and white model V2 (800x480)

#include <Arduino.h>
#include "app_state.h"
#include "wifi_manager.h"
#include "config_manager.h"
#include "display_driver.h"
#include "ui_renderer.h"

// Global application state
AppState appState;

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println();
    Serial.println("=================================");
    Serial.println("7.5\" e-Paper Rectangle Demo");
    Serial.println("=================================");

    // Initialize display hardware
    DisplayDriver::init();
    DisplayDriver::setRotation(0);

    // Connect to WiFi
    WifiManager::setup(appState.wifiMulti);

    // Load remote configuration
    ConfigManager::loadRemoteConfig(appState.config);

    // Display the initial image
    Serial.println("Loading initial image...");
    UiRenderer::showRemoteImage(appState);
    appState.lastRefreshTime = millis();

    Serial.printf("Image will refresh every %d seconds\n", appState.config.refreshIntervalSec);
}

void loop() {
    unsigned long currentTime = millis();
    unsigned long elapsedSeconds = (currentTime - appState.lastRefreshTime) / 1000;

    // Check if it's time to refresh based on config
    if (elapsedSeconds >= appState.config.refreshIntervalSec) {
        Serial.printf("Refresh interval reached (%d seconds). Reloading config and image...\n",
                      appState.config.refreshIntervalSec);

        // Reconnect WiFi if disconnected
        WifiManager::ensureConnected(appState.wifiMulti);

        // Reload configuration (in case it changed)
        ConfigManager::loadRemoteConfig(appState.config);

        // Display the updated image
        UiRenderer::showRemoteImage(appState);

        // Update last refresh time
        appState.lastRefreshTime = currentTime;

        Serial.printf("Next refresh in %d seconds\n", appState.config.refreshIntervalSec);
    }

    // Small delay to prevent busy waiting
    delay(1000);
}
