#include "wifi_manager.h"
#include "secrets.h"
#include <WiFi.h>

namespace WifiManager {

void setup(WiFiMulti& wifiMulti) {
    Serial.printf("Connecting to WiFi SSID: %s\n", WIFI_SSID);
    wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);

    while (wifiMulti.run() != WL_CONNECTED) {
        delay(100);
        Serial.println((char)WiFi.status());
    }

    Serial.println("Connected to WiFi!");
}

bool ensureConnected(WiFiMulti& wifiMulti) {
    if (WiFi.status() == WL_CONNECTED) {
        return true;
    }

    Serial.println("WiFi disconnected. Reconnecting...");
    while (wifiMulti.run() != WL_CONNECTED) {
        delay(100);
    }
    Serial.println("WiFi reconnected");
    return true;
}

bool isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

}  // namespace WifiManager
