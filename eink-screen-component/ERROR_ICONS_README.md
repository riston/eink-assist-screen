# Error Icons for E-Ink Display

This guide explains how to create and use small error icons stored directly on the ESP32 flash memory.

## Overview

Instead of fetching error screens from the server, the ESP32 can display pre-stored icons (glyphs) combined with text when errors occur. This provides:

- **Reliability**: Works even when server is unreachable
- **Efficiency**: Small memory footprint (64×64 icon = 512 bytes)
- **Visual feedback**: Better UX than text-only errors

## Icon Specifications

- **Format**: 1-bit BMP (black & white)
- **Recommended size**: 64×64 pixels (512 bytes)
- **Alternative sizes**: 32×32 (128 bytes), 128×128 (2KB)
- **Color depth**: Monochrome only

## Creating Icons

### Option 1: Design in Your Render Server

Use your existing server to render icons:

```bash
# Create a simple HTML template for the icon
cat > icon_wifi_error.html << 'EOF'
<div style="width: 64px; height: 64px; background: white; display: flex; align-items: center; justify-content: center;">
  <svg width="48" height="48" viewBox="0 0 24 24">
    <!-- WiFi symbol -->
    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9z" fill="black"/>
    <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" fill="black"/>
    <!-- X overlay -->
    <line x1="4" y1="4" x2="20" y2="20" stroke="black" stroke-width="2"/>
    <line x1="20" y1="4" x2="4" y2="20" stroke="black" stroke-width="2"/>
  </svg>
</div>
EOF

# Generate BMP using your server (with size specification)
curl "http://localhost:8000/image?url=file://$(pwd)/icon_wifi_error.html&format=bmp&threshold=128&width=64&height=64" > wifi_error_64x64.bmp
```

### Option 2: Use Image Editor

1. Create a 64×64 image in any editor (Photoshop, GIMP, Inkscape)
2. Use high contrast black/white designs
3. Export as 1-bit BMP

### Option 3: Find Icon Libraries

Free icon sources:
- [Material Icons](https://fonts.google.com/icons) - Export as SVG, convert to BMP
- [Font Awesome](https://fontawesome.com/) - Free icons
- [Feather Icons](https://feathericons.com/) - Minimalist designs

## Converting Icons to C Arrays

Use the provided `icon_to_array.py` script:

```bash
# Basic usage
./icon_to_array.py wifi_error_64x64.bmp ICON_WIFI_ERROR > icon_output.txt

# Example with all three icons
./icon_to_array.py wifi_error_64x64.bmp ICON_WIFI_ERROR > wifi.txt
./icon_to_array.py server_error_64x64.bmp ICON_SERVER_ERROR > server.txt
./icon_to_array.py http_error_64x64.bmp ICON_HTTP_ERROR > http.txt
```

The script outputs C code that looks like:
```cpp
const uint8_t ICON_WIFI_ERROR[] PROGMEM = {
  0xff, 0xfe, 0xfc, 0xf8, 0xf0, 0xe0, 0xc0, 0x80,
  // ... rest of the data
};
```

## Installing Icons

1. Copy the generated C array code
2. Open `src/error_icons.h`
3. Replace the placeholder TODO sections with your actual icon data
4. Make sure `ICON_WIDTH` and `ICON_HEIGHT` match your icon dimensions

Example:
```cpp
#define ICON_WIDTH 64
#define ICON_HEIGHT 64

const uint8_t ICON_WIFI_ERROR[] PROGMEM = {
  // Paste your generated array here
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  // ...
};
```

## Icon Design Tips

### Good for E-Ink:
- Bold, thick lines (≥2px)
- High contrast
- Simple shapes
- Minimal details
- Large icons (64×64 or bigger)

### Avoid:
- Thin lines (<2px) - may not render clearly
- Gradients - will be dithered poorly
- Complex details - will be lost in 1-bit conversion
- Anti-aliasing - creates gray pixels that threshold unpredictably

### Recommended Icon Themes:

**WiFi Error:**
- WiFi symbol with X overlay
- WiFi bars with slash
- Disconnected plug symbol

**Server Error:**
- Server/computer with warning triangle
- Cloud with X
- Broken link symbol

**HTTP Error:**
- Document with error mark
- Broken page icon
- 404/error code visual

## Testing

After installing icons, upload to ESP32:

```bash
platformio run --target upload
platformio device monitor
```

Trigger errors to see your icons:
- Disconnect WiFi to see ICON_WIFI_ERROR
- Stop the server to see ICON_SERVER_ERROR
- Return wrong HTTP code to see ICON_HTTP_ERROR

## Memory Usage

Each 64×64 icon uses 512 bytes of flash memory:
- 3 icons = 1,536 bytes (1.5 KB)
- 10 icons = 5,120 bytes (5 KB)

ESP32 has ~4MB flash, so icons use <0.1% of available space.

## Troubleshooting

**Icon appears inverted (white on black):**
- The script auto-inverts for e-ink, but if colors are wrong, check your BMP format

**Icon doesn't appear:**
- Verify icon dimensions match ICON_WIDTH/ICON_HEIGHT in error_icons.h
- Check serial monitor for memory errors
- Ensure array is marked PROGMEM

**Icon appears corrupted:**
- Verify BMP is 1-bit format (not 8-bit or 24-bit)
- Ensure complete array was copied (check byte count)

**Script fails with "Not a valid BMP":**
- Ensure file is BMP format, not PNG/JPEG renamed
- Try re-exporting with explicit 1-bit color depth

## Advanced: Creating Icons Programmatically

Python example using Pillow:

```python
from PIL import Image, ImageDraw

# Create 64x64 white background
img = Image.new('1', (64, 64), 1)
draw = ImageDraw.Draw(img)

# Draw WiFi symbol
draw.arc((10, 20, 54, 44), 0, 180, fill=0, width=3)
draw.arc((15, 25, 49, 39), 0, 180, fill=0, width=3)
draw.ellipse((28, 35, 36, 43), fill=0)

# Draw X overlay
draw.line([(10, 10), (54, 54)], fill=0, width=3)
draw.line([(54, 10), (10, 54)], fill=0, width=3)

# Save as 1-bit BMP
img.save('wifi_error_64x64.bmp')
```
