# E-Ink Browser Renderer

A rendering service that converts Handlebars HTML templates into images optimized for e-ink displays. Fetches real-time sensor data from Home Assistant and renders it into multiple image formats (PNG, JPEG, WebP, BMP).

_NB!_ This is an experimental project, make sure to change the entities and template mapping according to your Home Assistant setup.

![Screen](/assets/screen.jpg)

## Hardware

- [Waveshare 7.5" e-Paper V2](https://www.waveshare.com/wiki/7.5inch_e-Paper_HAT_Manual) (800x480, 1-bit monochrome)
- [E-Paper ESP32 Driver Board](https://www.waveshare.com/e-paper-esp32-driver-board.htm)

### E-Ink Stand (Laser Cut)

The `eink-stand/` directory contains laser cut files for a plywood stand to hold the e-ink display:

| File | Format | Description |
|------|--------|-------------|
| `eink-stand.dxf` | DXF | Universal CAD format, compatible with most laser cutters |
| `eink-stand.lbrn2` | LightBurn | Native LightBurn project file with layer settings |

**Material**: 3mm plywood (birch or similar)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              ESP32 + E-ink Display                          │
│  (eink-screen-component)                                    │
│                                                             │
│  1. Boot → Connect WiFi                                     │
│  2. GET /config → Load display settings                     │
│  3. GET /image → Fetch rendered BMP in chunks               │
│  4. Display image on e-ink panel                            │
│  5. Sleep → Repeat every N seconds                          │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│              Node.js Renderer Server                        │
│                                                             │
│  • Render Handlebars templates with HA data                 │
│  • Screenshot HTML via Puppeteer                            │
│  • Convert to 1-bit monochrome BMP                          │
│  • Serve chunked image data for memory-constrained devices  │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│              Home Assistant API                             │
│  (sensors, weather, calendars)                              │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Renderer (Node.js)

- **Runtime**: Node.js 23.x, TypeScript 5.9, ES Modules
- **Browser Automation**: Puppeteer (HTML to image rendering)
- **Template Engine**: Handlebars (dynamic content)
- **Image Processing**: Jimp, bmp-ts (format conversion)

### Display Client (ESP32)

- **Framework**: Arduino with PlatformIO (C++)
- **Display Library**: GxEPD2 (e-paper driver)
- **JSON Parser**: ArduinoJson
- **Connectivity**: WiFi (HTTP client)

## ESP32 Setup

### 1. Configure WiFi

Copy the secrets template and add your WiFi credentials:

```bash
cd eink-screen-component
cp src/secrets.example.h src/secrets.h
```

Edit `src/secrets.h`:

```cpp
#define WIFI_SSID "your-wifi-network"
#define WIFI_PASSWORD "your-wifi-password"
```

### 2. Configure Server URL

Edit `src/config.h` to set your renderer server address:

```cpp
#define DEFAULT_BASE_URL "http://192.168.1.100:8000"
```

### 3. Build and Upload

```bash
# Using PlatformIO CLI
pio run --target upload

# Monitor serial output
pio device monitor
```

### SPI Pin Configuration

Default pins in `src/config.h`:

| Pin  | Function     | ESP32 GPIO |
| ---- | ------------ | ---------- |
| SCK  | Clock        | 13         |
| MISO | Data In      | 12         |
| MOSI | Data Out     | 14         |
| CS   | Chip Select  | 15         |
| DC   | Data/Command | 27         |
| RST  | Reset        | 26         |
| BUSY | Busy Signal  | 25         |

## Renderer Setup

### Environment Variables (`.env`)

```bash
# Home Assistant
HA_URL=http://192.168.0.129:8123
HA_ACCESS_TOKEN=<your_home_assistant_jwt_token>

# Server
BASE_HOST=192.168.0.113    # Host for server binding and config URLs (default: localhost)
BASE_PORT=8000             # Port for server binding (default: 8000)
ACTIVE_TEMPLATE=dashboard-full.html  # Default template (default: dashboard-full.html)
```

To get a Home Assistant access token, go to your profile in Home Assistant and create a Long-Lived Access Token under the "Security" tab. See [Home Assistant Authentication](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token) for details.

### Entity Mappings (`config/entity-mappings.json`)

Maps user-friendly names to Home Assistant entity IDs:

```json
{
  "weather": "weather.forecast_ehte",
  "indoor_temp": "sensor.temperature_humidity_sensor_6e74_temperature",
  "main_door": "binary_sensor.main_door_iaszone",
  "risto_kalender": "calendar.risto_kalender"
}
```

## API Endpoints

### GET /config

Returns server configuration and display specifications.

**Response:**

```json
{
  "image": {
    "path": "/image",
    "parameters": {
      "format": "bmp",
      "quality": 80,
      "threshold": 128,
      "template": "dashboard-full.html"
    },
    "base_url": "http://192.168.0.113:8000"
  },
  "display": {
    "width": 800,
    "height": 480,
    "refresh_interval_sec": 300
  }
}
```

### GET /image

Converts HTML to image via screenshot and format conversion.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to screenshot (mutually exclusive with `template`) |
| `template` | string | Template filename (mutually exclusive with `url`) |
| `format` | string | Output format: `png`, `jpeg`, `webp`, `bmp` (default: `png`) |
| `quality` | number | JPEG quality 1-100 (default: 80) |
| `threshold` | number | B&W threshold 0-255 for 1-bit images (default: 128) |
| `offset` | number | Starting byte position for chunked downloads |
| `limit` | number | Bytes to retrieve from offset |
| `includeHeader` | boolean | Include BMP header in offset responses |

**Response:** Binary image data

### GET /ha/render

Renders Handlebars template with Home Assistant entity data.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `template` | string | Template filename (required) |
| `cache_ttl` | number | Cache TTL in seconds (default: 300) |
| `force_refresh` | boolean | Bypass cache and refetch data |
| `format` | string | `json` (default) or `html` |

**Response (JSON):**

```json
{
  "success": true,
  "template": "dashboard-full.html",
  "entities_fetched": 12,
  "html_length": 4521,
  "cached_at": "2026-01-21T12:34:56Z",
  "cache_key": "ha:dashboard-full.html"
}
```

### GET /ha/entities

Fetches raw entity and calendar data for a template.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `template` | string | Template filename (required) |

**Response:**

```json
{
  "success": true,
  "template": "dashboard-full.html",
  "entities_count": 12,
  "entities": {
    "sensor_temperature": {
      "entity_id": "sensor.temperature",
      "state": "21.5",
      "attributes": { "unit_of_measurement": "°C" }
    }
  },
  "calendars_count": 1,
  "calendars": {
    "calendar_risto_kalender": [{ "summary": "Meeting", "start": { "dateTime": "..." } }]
  }
}
```

## Usage

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

Server starts at `http://localhost:8000`

### Testing

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

### Examples

**Render template to image:**

```bash
curl "http://localhost:8000/image?template=dashboard-full.html&format=bmp" > dashboard.bmp
```

**Get rendered HTML:**

```bash
curl "http://localhost:8000/ha/render?template=dashboard-full.html&format=html"
```

**Get entity data:**

```bash
curl "http://localhost:8000/ha/entities?template=dashboard-full.html"
```

**Chunked download for memory-constrained devices:**

```bash
curl "http://localhost:8000/image?template=dashboard-full.html&format=bmp&offset=62&limit=10240&includeHeader=true"
```

## Template Development

Create templates in the `templates/` directory:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        width: 800px;
        height: 480px;
      }
    </style>
  </head>
  <body>
    <h1>Temperature: {{round entities.sensor_temperature.state}}C</h1>
    <p>Door: {{#if entities.binary_sensor_door.state_is_on}}OPEN{{else}}Closed{{/if}}</p>
  </body>
</html>
```

### Entity References

- Use `entities.<domain>_<name>` format (replace dots with underscores)
- Or use semantic names from `entity-mappings.json`: `entities.indoor_temp`
- Access state: `entities.sensor_temperature.state`
- Access attributes: `entities.sensor_temperature.attributes.unit_of_measurement`

### Available Helpers

| Category   | Helpers                                                        |
| ---------- | -------------------------------------------------------------- |
| Math       | `add`, `subtract`, `multiply`, `divide`, `round`, `percentage` |
| Strings    | `uppercase`, `lowercase`, `truncate`, `capitalize`, `split`    |
| Formatting | `formatNumber`, `formatTime`, `formatDate`, `weatherCondition` |
| UI         | `icon`, `weatherIcon`, `volumeBar`                             |
| Comparison | `eq`, `lt`, `gt`, `lte`, `gte`                                 |
| Arrays     | `limit`, `shuffle`                                             |
