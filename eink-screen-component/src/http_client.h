#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include <HTTPClient.h>
#include <WiFiClient.h>

// Manages HTTP connection lifecycle
struct HttpConnection {
    WiFiClient wifiClient;
    HTTPClient httpClient;

    // Initialize connection to URL with optional timeout (default 10s)
    bool begin(const String& url, int timeout = 10000);

    // Perform GET request, returns HTTP status code
    int get();

    // Get response body as string
    String getResponseString();

    // Get response content length
    int getResponseSize();

    // Get stream pointer for chunked reading
    WiFiClient* getStream();

    // Clean up connection
    void end();
};

#endif
