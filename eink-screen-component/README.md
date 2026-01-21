# E-ink Image Display

ESP32-based e-ink display that renders web content on a 7.5" Waveshare display.

## Quick Reference

```bash
# 1. Setup WiFi credentials
cp src/secrets.example.h src/secrets.h
# Edit src/secrets.h with your WiFi SSID and password

# 2. (Optional) Adjust SPI pins if not using Waveshare board
# Edit src/config.h

# 3. Build and upload
pio run --target upload

# 4. Monitor (optional)
pio device monitor
```

**What you need:**
- WiFi credentials
- Image server running on your network
- USB cable for uploading

## Hardware Requirements

- **Board**: Waveshare ESP32 Driver Board
- **Display**: 7.5" e-Paper V2 (GDEY075T7, 800x480, black and white)
- **Controller**: UC8179
- **Library**: GxEPD2 v1.6.2
- **Connection**: SPI interface

## Prerequisites

Before you begin, make sure you have:

1. **PlatformIO** installed (VSCode extension or CLI)
2. **WiFi network** credentials
3. **Image server** running and accessible on your network (serves BMP image data)
4. **USB cable** to connect ESP32 to your computer

## Setup Instructions

### 1. WiFi Configuration

Configure your WiFi credentials:

```bash
# Copy the template
cp src/secrets.example.h src/secrets.h
```

Edit `src/secrets.h`:
```cpp
#define WIFI_SSID "your-wifi-network"
#define WIFI_PASSWORD "your-wifi-password"
```

**Important:** The `src/secrets.h` file is gitignored and will not be committed to version control.

### 2. SPI Pin Configuration (Optional)

The default SPI pins match the Waveshare ESP32 Driver Board. If you need to use different pins, edit `src/config.h`:

```cpp
#define SPI_SCK  13   // Clock pin
#define SPI_MISO 12   // Master In Slave Out
#define SPI_MOSI 14   // Master Out Slave In
#define SPI_SS   15   // Slave Select (Chip Select)
```

**Display pins** (also in `src/main.cpp` line 18):
- CS (Chip Select): 15
- DC (Data/Command): 27
- RST (Reset): 26
- BUSY: 25

### 3. Server Configuration (Optional)

The device fetches configuration from your server at runtime. You can create a local `config.json` for reference, but it's not required for building:

```json
{
  "image": {
    "path": "/image",
    "base_url": "http://192.168.1.167:8000",
    "parameters": {
      "format": "bmp",
      "threshold": 128,
      "url": "data:text/html,<h1>Hello World</h1>",
      "template": "your-template.html"
    }
  },
  "display": {
    "width": 800,
    "height": 480,
    "refresh_interval_sec": 300
  }
}
```

The server must provide:
- `/config` endpoint - Returns JSON configuration
- `/image` endpoint - Returns BMP image data (supports `offset` and `limit` query params)

### 4. Build and Upload

```bash
# Build the project
pio run

# Upload to ESP32
pio run --target upload

# Monitor serial output (optional, to verify connection)
pio device monitor
```

## Configuration

See [CONFIG.md](CONFIG.md) for detailed configuration options including:
- Remote server settings
- Display parameters
- Refresh intervals
- Image rendering parameters

## Security Notes

- **Never commit** `src/secrets.h` - it contains your WiFi credentials
- **Never commit** `config.json` - it may contain sensitive URLs or internal IPs
- Both files are already in `.gitignore`
- Use `src/secrets.example.h` and `config.example.json` as templates

## How It Works

### Boot Sequence

1. **SPI Initialization**: Configures SPI bus with pins from `config.h`
2. **Display Initialization**: Initializes the 7.5" e-ink display
3. **WiFi Connection**: Connects to WiFi using credentials from `secrets.h`
4. **Config Loading**: Fetches configuration from `{base_url}/config` endpoint
5. **Initial Display**: Downloads and displays the first image
6. **Refresh Timer**: Starts periodic refresh based on `refresh_interval_sec`

### Runtime Behavior

- **Periodic Refresh**: Every `refresh_interval_sec` seconds:
  - Reloads configuration (picks up remote changes)
  - Fetches and displays updated image
  - Resets refresh timer
- **Auto-Reconnect**: If WiFi disconnects, automatically reconnects before next refresh
- **Error Display**: Shows formatted error screen if image fetch fails

## Chunked Rendering

The display uses chunked downloads to work within ESP32 memory constraints:

- **Total screen size**: 48,000 bytes (800×480 pixels ÷ 8 bits/byte)
- **Number of chunks**: 3 (configurable in `src/main.cpp` line 27)
- **Chunk size**: 16,000 bytes each (~160 rows per chunk)
- **BMP header**: First 62 bytes are skipped
- **Memory efficient**: Only one chunk in RAM at a time

**Why chunks?**
- ESP32 has limited RAM (~320KB usable)
- Full screen buffer (48KB) would consume significant memory
- Chunking allows for other operations while rendering
- Configurable chunk count balances speed vs. memory usage

**Chunk processing:**
1. Request chunk from server with `offset` and `limit` parameters
2. Read chunk data into buffer
3. Invert colors (BMP uses opposite polarity from e-ink)
4. Draw chunk to display at correct Y position
5. Repeat for all chunks

## Display Capabilities

The GDEY075T7 display supports:

- **Partial updates**: Yes (via `setPartialWindow()`)
- **Fast partial update**: Yes (~450ms vs ~1200ms for full refresh)
- **Refresh times**:
  - Full refresh: ~1.2 seconds
  - Partial refresh: ~0.45 seconds
- **Ghosting**: Minimal with charge-balancing waveform
- **Recommended usage**: Periodic full refresh every 10-20 partial updates to prevent ghosting

## Troubleshooting

### Build Errors

**"secrets.h not found"**
- Copy `src/secrets.example.h` to `src/secrets.h`
- Fill in your WiFi credentials

**"GxEPD2_BW.h file not found"**
- Run `pio lib install` to install dependencies
- Dependencies are listed in `platformio.ini`

### WiFi Connection Issues

**Device won't connect to WiFi**
- Verify SSID and password in `src/secrets.h`
- Check serial monitor output for connection status
- Ensure WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Try moving device closer to router

**WiFi keeps disconnecting**
- Check signal strength (RSSI in serial monitor)
- Verify router isn't blocking MAC address
- Check for WiFi power saving settings on router

### Display Issues

**Display shows nothing / stays white**
- Check serial monitor for error messages
- Verify server is running and accessible at configured URL
- Test server endpoint manually: `curl http://your-server:8000/config`
- Check SPI pin connections match `src/config.h`
- Verify display cable is properly connected

**Error screen appears**
- Read error message on display
- Check serial monitor for detailed error info
- Common causes:
  - HTTP request failed: Server not reachable
  - Invalid response size: Server returned wrong data
  - WiFi not connected: Check network

**Colors inverted (black/white swapped)**
- Color inversion is handled in `displayImage()` at line 402-404
- This is normal - BMP polarity is inverted for e-ink
- If still wrong, check server BMP generation

**Image appears corrupted or garbled**
- Verify server sends BMP format data
- Check chunk alignment (must be byte-aligned)
- Verify image dimensions match display (800×480)
- Try reducing chunk count in `src/main.cpp` line 27

**Partial refresh shows ghosting**
- Perform periodic full refresh (not yet implemented)
- Ghosting is normal after many partial updates
- Full refresh clears ghost images

### Server Issues

**Config endpoint not found**
- Verify server implements `/config` endpoint
- Returns JSON with image and display configuration
- See `config.example.json` for format

**Image endpoint not working**
- Server must implement `/image` endpoint
- Must support `offset` and `limit` query parameters
- Returns raw BMP pixel data (excluding header for chunks)

**Chunk rendering errors**
- Check server correctly calculates chunk offsets
- BMP header is 62 bytes (skip for all chunks)
- Each chunk should be exactly `limit` bytes
- Chunks must be sent in top-to-bottom order

### Hardware Issues

**Display update is very slow**
- Normal for e-ink: Full refresh ~1.2s, partial ~0.45s
- Reduce chunk count for faster updates (more memory usage)
- Check network latency to server

**Display pins not responding**
- Verify wiring matches pin definitions in `src/config.h`
- Check continuity on SPI bus pins
- Ensure display has proper 3.3V power supply
- RST and BUSY pins must be connected

## Performance Tuning

### Chunk Count
Edit `src/main.cpp` line 27 to adjust chunk count:
- **More chunks** (e.g., 8): Less memory, more HTTP requests, slower
- **Fewer chunks** (e.g., 2): More memory, fewer HTTP requests, faster
- **Current**: 3 chunks (16KB each, good balance)

### Refresh Interval
Configure via server's `/config` endpoint:
- Shorter interval: More frequent updates, more battery drain
- Longer interval: Less frequent updates, better battery life
- Recommended: 300-600 seconds (5-10 minutes)

## Technical Details

- **Display Model**: GDEY075T7
- **Controller**: UC8179
- **Interface**: 4-wire SPI
- **Color Depth**: 1-bit (black/white)
- **Resolution**: 800×480 pixels
- **Active Area**: 163.2×97.92 mm
- **Pixel Size**: 0.204×0.204 mm
- **Partial Update**: Supported via differential waveform
- **Power**: 3.3V (display) + 5V (logic optional via level shifters)
