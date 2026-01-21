# Remote Configuration

The ESP32 device loads its configuration from a JSON file served over HTTP at startup.

## Config File Location

The device fetches the config from: `{base_url}/config.json`

By default: `http://192.168.0.156:8000/config.json`

## JSON Schema

```json
{
  "image": {
    "path": "/image", // API endpoint path for the image
    "base_url": "http://..." // Base URL of the server
  },
  "display": {
    "width": 800, // Display width in pixels
    "height": 480, // Display height in pixels
    "refresh_interval_sec": 300 // How often to refresh (in seconds)
  }
}
```

## Configuration Fields

### image.path

- **Type**: String
- **Default**: `/image`
- **Description**: The API endpoint path that serves the image data. The device will append query parameters `?offset={offset}&limit={limit}` to this path.
- **Example**: `/image` → Full URL becomes `http://192.168.0.156:8000/image?offset=0&limit=384000`

### image.base_url

- **Type**: String
- **Default**: `http://192.168.0.156:8000`
- **Description**: The base URL of your server that hosts both the config and image endpoints.
- **Example**: `http://192.168.1.100:3000`

### display.width

- **Type**: Integer
- **Default**: `800`
- **Description**: Display width in pixels (should match your physical display).

### display.height

- **Type**: Integer
- **Default**: `480`
- **Description**: Display height in pixels (should match your physical display).

### display.refresh_interval_sec

- **Type**: Integer
- **Default**: `60`
- **Description**: How often the display should refresh the image, in seconds.
- **Example**: `300` = refresh every 5 minutes

## Hardware Configuration (SPI Pins)

SPI pin configuration is **not** part of the remote config. Instead, it's configured at compile-time in `src/config.h`:

```cpp
#define SPI_SCK  13   // Clock pin
#define SPI_MISO 12
#define SPI_MOSI 14
#define SPI_SS   15
```

**Default values** match the Waveshare ESP32 Driver Board pinout. If using different pins, modify these values in `src/config.h` before compiling.

## Behavior

### On Startup

1. Device connects to WiFi
2. Attempts to load the config from `{base_url}/config.json`
3. If config load fails, uses default values defined in `src/config.h`
4. Displays the initial image from `{base_url}{path}?offset=0&limit={width*height}`
5. Starts the refresh timer

### During Runtime

1. Every `refresh_interval_sec` seconds:
   - Reloads the config from the server (picks up any changes)
   - Fetches and displays the updated image
   - Resets the timer
2. If WiFi disconnects, it automatically reconnects before refreshing
3. The config is dynamic - changes to the JSON file will be applied on the next refresh cycle

## Example Configs

### Default (5 minute refresh)

```json
{
  "image": {
    "path": "/image",
    "base_url": "http://192.168.0.156:8000"
  },
  "display": {
    "width": 800,
    "height": 480,
    "refresh_interval_sec": 300
  }
}
```

### Different server

```json
{
  "image": {
    "path": "/api/display",
    "base_url": "http://192.168.1.100:3000"
  },
  "display": {
    "width": 800,
    "height": 480,
    "refresh_interval_sec": 600
  }
}
```

### Hourly refresh

```json
{
  "image": {
    "path": "/image",
    "base_url": "http://192.168.0.156:8000"
  },
  "display": {
    "width": 800,
    "height": 480,
    "refresh_interval_sec": 3600
  }
}
```
