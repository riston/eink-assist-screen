# Server Image Endpoint Parameters

Your render server at `/image` accepts the following parameters:

## Required Parameters (one of):

### `url` (string)
URL or data URL to render
- Can be HTTP/HTTPS URL
- Can be `file://` URL for local files
- Can be `data:text/html,<html>...</html>` for inline HTML
- Can be `data:image/svg+xml,<svg>...</svg>` for inline SVG

**Example:**
```bash
curl "http://localhost:8000/image?url=https://example.com&format=bmp"
```

### `template` (string)
Name of pre-made template file (mutually exclusive with `url`)
- Uses templates from your templates directory
- Supports Handlebars templating with Home Assistant integration

**Example:**
```bash
curl "http://localhost:8000/image?template=dashboard.html&format=bmp"
```

## Output Format Parameters:

### `format` (string, default: "png")
Output image format
- Valid values: `png`, `jpeg`, `webp`, `bmp`
- For e-ink displays, use `bmp` (generates 1-bit monochrome)

### `width` (number, default: 800)
Output image width in pixels

### `height` (number, default: 480)
Output image height in pixels

**Example:**
```bash
# Generate 64x64 icon
curl "http://localhost:8000/image?url=...&format=bmp&width=64&height=64"

# Generate 128x128 icon
curl "http://localhost:8000/image?url=...&format=bmp&width=128&height=128"
```

### `quality` (number, 0-100, default varies)
Image quality for lossy formats (JPEG, WebP)
- Only applies to JPEG and WebP formats
- Ignored for PNG and BMP

### `threshold` (number, 0-255, default: 128)
Black/white threshold for BMP conversion
- Only applies to BMP format
- Lower values (100-120): More black pixels, better for light images
- Middle values (128): Balanced
- Higher values (140-160): More white pixels, better for dark images

**Example:**
```bash
# More contrast, more black
curl "http://localhost:8000/image?url=...&format=bmp&threshold=110"

# More white, lighter result
curl "http://localhost:8000/image?url=...&format=bmp&threshold=145"
```

## Chunking Parameters (for memory-constrained devices):

### `offset` (number, default: 0)
Starting byte position in the output image

### `limit` (number, optional)
Number of bytes to return from offset

### `includeHeader` (boolean, default: false)
Include file header with chunked data

**Example:**
```bash
# Get first 16000 bytes (skip 62-byte BMP header)
curl "http://localhost:8000/image?url=...&format=bmp&offset=62&limit=16000"
```

## Complete Examples

### Generate 64×64 WiFi error icon:
```bash
SVG=$(cat wifi_icon.svg)
curl -G "http://localhost:8000/image" \
  --data-urlencode "url=data:image/svg+xml,${SVG}" \
  --data-urlencode "format=bmp" \
  --data-urlencode "width=64" \
  --data-urlencode "height=64" \
  --data-urlencode "threshold=128" \
  -o wifi_error.bmp
```

### Generate full-screen dashboard:
```bash
curl "http://localhost:8000/image?template=dashboard.html&format=bmp&width=800&height=480&threshold=128" \
  -o dashboard.bmp
```

### Generate PNG with custom size:
```bash
curl "http://localhost:8000/image?url=https://example.com&format=png&width=400&height=300" \
  -o screenshot.png
```

### Test different thresholds:
```bash
for threshold in 110 128 145; do
  curl "http://localhost:8000/image?url=...&format=bmp&threshold=${threshold}" \
    -o "test_${threshold}.bmp"
done
```

## Helper Scripts

### Using svg_to_icon.sh:
```bash
# Handles all parameters automatically
./svg_to_icon.sh input.svg output.bmp [size] [threshold]

# Examples:
./svg_to_icon.sh wifi.svg wifi_64.bmp 64 128
./svg_to_icon.sh wifi.svg wifi_128.bmp 128 140
```

## Parameter Precedence

1. **Size**: HTML viewport size matches `width` and `height` parameters
2. **Content size**: CSS in your HTML can override display size
3. **SVG viewBox**: SVG scaling is independent of viewport

**Best practice:** For icons, set both URL parameters and HTML/CSS to the same size:
```bash
HTML="<html><body style='width:64px;height:64px;margin:0;'>${SVG}</body></html>"
curl -G "http://localhost:8000/image" \
  --data-urlencode "url=data:text/html,${HTML}" \
  --data-urlencode "width=64" \
  --data-urlencode "height=64" \
  ...
```
