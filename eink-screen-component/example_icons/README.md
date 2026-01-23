# Example SVG Icons

This directory contains example SVG icons for common error scenarios.

## Quick Start

**1. Use the helper script (easiest):**
```bash
./svg_to_icon.sh example_icons/wifi_error.svg wifi_error_64x64.bmp
./svg_to_icon.sh example_icons/server_error.svg server_error_64x64.bmp
./svg_to_icon.sh example_icons/http_error.svg http_error_64x64.bmp
```

**2. Convert to C arrays:**
```bash
./icon_to_array.py wifi_error_64x64.bmp ICON_WIFI_ERROR > wifi_output.txt
./icon_to_array.py server_error_64x64.bmp ICON_SERVER_ERROR > server_output.txt
./icon_to_array.py http_error_64x64.bmp ICON_HTTP_ERROR > http_output.txt
```

**3. Copy the arrays into `src/error_icons.h`**

## Manual Methods

### Method 1: Direct curl with file:// URL

```bash
# If your server supports file:// protocol
curl "http://localhost:8000/image?url=file://$(pwd)/example_icons/wifi_error.svg&format=bmp&threshold=128" \
  -o wifi_error.bmp
```

### Method 2: Inline SVG content

```bash
# Read SVG and embed in data URL
SVG=$(cat example_icons/wifi_error.svg)
curl -G "http://localhost:8000/image" \
  --data-urlencode "url=data:image/svg+xml,${SVG}" \
  --data-urlencode "format=bmp" \
  --data-urlencode "threshold=128" \
  --data-urlencode "width=64" \
  --data-urlencode "height=64" \
  -o wifi_error.bmp
```

### Method 3: Wrap in HTML (best control)

```bash
# Wrap SVG in HTML for sizing
SVG=$(cat example_icons/wifi_error.svg)
HTML="<html><body style='margin:0;display:flex;align-items:center;justify-content:center;width:64px;height:64px;background:white;'>${SVG}</body></html>"

curl -G "http://localhost:8000/image" \
  --data-urlencode "url=data:text/html,${HTML}" \
  --data-urlencode "format=bmp" \
  --data-urlencode "threshold=128" \
  --data-urlencode "width=64" \
  --data-urlencode "height=64" \
  -o wifi_error.bmp
```

## Included Icons

### wifi_error.svg
WiFi symbol with X overlay - for network connection errors

### server_error.svg
Server rack with warning triangle - for server unreachable errors

### http_error.svg
Document with error X - for HTTP request failures

## Customizing Icons

Edit the SVG files with any text editor or SVG tool:
- Keep designs simple and bold
- Use stroke-width ≥ 2-3 for clarity on e-ink
- Avoid gradients (will become solid black/white)
- Test with different threshold values (120-140 typical range)

## Size Variations

Generate different sizes:

```bash
# 32x32 (smaller, 128 bytes)
./svg_to_icon.sh example_icons/wifi_error.svg wifi_32.bmp 32

# 64x64 (recommended, 512 bytes)
./svg_to_icon.sh example_icons/wifi_error.svg wifi_64.bmp 64

# 128x128 (larger detail, 2KB)
./svg_to_icon.sh example_icons/wifi_error.svg wifi_128.bmp 128
```

Remember to update `ICON_WIDTH` and `ICON_HEIGHT` in `src/error_icons.h` to match!

## Testing Threshold Values

Different threshold values affect how the image converts to pure black/white:

```bash
# Lower threshold = more black pixels
./svg_to_icon.sh example_icons/wifi_error.svg wifi_110.bmp 64 110

# Default middle ground
./svg_to_icon.sh example_icons/wifi_error.svg wifi_128.bmp 64 128

# Higher threshold = more white pixels
./svg_to_icon.sh example_icons/wifi_error.svg wifi_145.bmp 64 145
```

View the BMPs and pick the one that looks best for your design.
