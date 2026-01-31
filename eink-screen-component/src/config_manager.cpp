#include "config_manager.h"
#include "http_client.h"
#include <ArduinoJson.h>

namespace ConfigManager {

bool loadRemoteConfig(RemoteConfig& config) {
    String url = config.imageBaseUrl + CONFIG_PATH;
    Serial.printf("Loading config from: %s\n", url.c_str());

    HttpConnection http;
    if (!http.begin(url)) {
        Serial.println("http.begin() failed for config (WiFi not connected?)");
        return false;
    }

    int httpCode = http.get();
    Serial.printf("Config HTTP response: %d\n", httpCode);

    if (httpCode != 200) {
        http.end();
        Serial.println("Failed to load config, using defaults");
        return false;
    }

    String payload = http.getResponseString();
    Serial.printf("Config payload: %s\n", payload.c_str());

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        Serial.printf("JSON parse error: %s\n", error.c_str());
        http.end();
        return false;
    }

    // Update config from JSON
    if (doc.containsKey("image")) {
        if (doc["image"].containsKey("base_url"))
            config.imageBaseUrl = doc["image"]["base_url"].as<String>();
        if (doc["image"].containsKey("path"))
            config.imagePath = doc["image"]["path"].as<String>();

        if (doc["image"].containsKey("parameters")) {
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

    if (doc.containsKey("display")) {
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
    if (config.imageUrl.length() > 0) {
        Serial.printf("  Image URL param: %s\n", config.imageUrl.c_str());
    }
    if (config.imageTemplate.length() > 0) {
        Serial.printf("  Template: %s\n", config.imageTemplate.c_str());
    }
    Serial.printf("  Display: %dx%d\n", config.displayWidth, config.displayHeight);
    Serial.printf("  Refresh interval: %d sec\n", config.refreshIntervalSec);

    http.end();
    return true;
}

String buildImageUrl(const RemoteConfig& config, int chunkOffsetBytes, int chunkLimitBytes) {
    char url[2048];

    if (config.imageTemplate.length() > 0) {
        snprintf(url, sizeof(url), "%s%s?format=%s&threshold=%d&template=%s&offset=%d&limit=%d",
                 config.imageBaseUrl.c_str(),
                 config.imagePath.c_str(),
                 config.imageFormat.c_str(),
                 config.imageThreshold,
                 config.imageTemplate.c_str(),
                 chunkOffsetBytes,
                 chunkLimitBytes);
    } else {
        snprintf(url, sizeof(url), "%s%s?url=%s&format=%s&threshold=%d&offset=%d&limit=%d",
                 config.imageBaseUrl.c_str(),
                 config.imagePath.c_str(),
                 config.imageUrl.c_str(),
                 config.imageFormat.c_str(),
                 config.imageThreshold,
                 chunkOffsetBytes,
                 chunkLimitBytes);
    }

    return String(url);
}

}  // namespace ConfigManager
