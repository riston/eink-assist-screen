#include "http_client.h"
#include <WiFi.h>

bool HttpConnection::begin(const String& url, int timeout) {
    if (WiFi.status() != WL_CONNECTED) {
        return false;
    }

    if (!httpClient.begin(wifiClient, url)) {
        return false;
    }

    httpClient.setTimeout(timeout);
    return true;
}

int HttpConnection::get() {
    return httpClient.GET();
}

String HttpConnection::getResponseString() {
    return httpClient.getString();
}

int HttpConnection::getResponseSize() {
    return httpClient.getSize();
}

WiFiClient* HttpConnection::getStream() {
    return httpClient.getStreamPtr();
}

void HttpConnection::end() {
    httpClient.end();
}
