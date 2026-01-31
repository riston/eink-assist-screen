#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <WiFiMulti.h>

namespace WifiManager {
    // Initialize WiFi with credentials from secrets.h
    // Blocks until connected
    void setup(WiFiMulti& wifiMulti);

    // Check connection and reconnect if needed
    // Returns true if connected
    bool ensureConnected(WiFiMulti& wifiMulti);

    // Check if currently connected
    bool isConnected();
}

#endif
