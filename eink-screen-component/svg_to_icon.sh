#!/bin/bash
# Convert SVG to e-ink BMP icon via render server
#
# Usage: ./svg_to_icon.sh input.svg output.bmp [size] [threshold]
#
# Examples:
#   ./svg_to_icon.sh wifi.svg wifi_error.bmp
#   ./svg_to_icon.sh wifi.svg wifi_error.bmp 64 128
#   ./svg_to_icon.sh wifi.svg wifi_error.bmp 128 140

set -e

# Default values
SERVER_URL="${RENDER_SERVER_URL:-http://localhost:8000}"
SIZE="${3:-64}"
THRESHOLD="${4:-128}"

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <input.svg> <output.bmp> [size] [threshold]"
    echo ""
    echo "Arguments:"
    echo "  input.svg    - Path to SVG file"
    echo "  output.bmp   - Output BMP filename"
    echo "  size         - Icon size in pixels (default: 64)"
    echo "  threshold    - B/W threshold 0-255 (default: 128)"
    echo ""
    echo "Environment:"
    echo "  RENDER_SERVER_URL - Server URL (default: http://localhost:8000)"
    echo ""
    echo "Examples:"
    echo "  $0 wifi.svg wifi_error.bmp"
    echo "  $0 wifi.svg wifi_error.bmp 128 140"
    exit 1
fi

INPUT_SVG="$1"
OUTPUT_BMP="$2"

# Check if input file exists
if [ ! -f "$INPUT_SVG" ]; then
    echo "Error: Input file '$INPUT_SVG' not found"
    exit 1
fi

echo "Converting SVG to e-ink BMP..."
echo "  Input:     $INPUT_SVG"
echo "  Output:    $OUTPUT_BMP"
echo "  Size:      ${SIZE}x${SIZE}"
echo "  Threshold: $THRESHOLD"
echo "  Server:    $SERVER_URL"
echo ""

# Read SVG content
SVG_CONTENT=$(<"$INPUT_SVG")

# Clean up SVG for HTML embedding:
# 1. Remove XML declaration and DOCTYPE (break embedded SVG)
# 2. Remove CDATA markers but keep the content (HTML doesn't need them)
# 3. Remove HTML comments
# 4. Remove width/height attributes from <svg> tag (keep viewBox for proper scaling)
SVG_CONTENT=$(echo "$SVG_CONTENT" | \
    sed '/<\?xml/d' | \
    sed '/<!DOCTYPE/d' | \
    sed 's/<!\[CDATA\[//g' | \
    sed 's/\]\]>//g' | \
    sed '/<!--.*-->/d' | \
    perl -0pe 's/(<svg[^>]*?)\s+width="[^"]*"/$1/gs' | \
    perl -0pe 's/(<svg[^>]*?)\s+height="[^"]*"/$1/gs')

# Wrap in HTML with exact size and force SVG to scale via CSS
HTML_CONTENT="<html><head><style>body{margin:0;padding:0;width:${SIZE}px;height:${SIZE}px;background:white;overflow:hidden;display:flex;align-items:center;justify-content:center;}svg{width:100%;height:100%;}</style></head><body>${SVG_CONTENT}</body></html>"

# Make request to render server
curl -f -G "$SERVER_URL/image" \
  --data-urlencode "url=data:text/html,${HTML_CONTENT}" \
  --data-urlencode "format=bmp" \
  --data-urlencode "threshold=${THRESHOLD}" \
  --data-urlencode "width=${SIZE}" \
  --data-urlencode "height=${SIZE}" \
  -o "$OUTPUT_BMP" \
  --progress-bar

if [ $? -eq 0 ]; then
    FILE_SIZE=$(stat -f%z "$OUTPUT_BMP" 2>/dev/null || stat -c%s "$OUTPUT_BMP" 2>/dev/null)
    echo ""
    echo "✓ Success! Generated $OUTPUT_BMP ($FILE_SIZE bytes)"
    echo ""
    echo "Next steps:"
    echo "  1. Convert to C array:"
    echo "     ./icon_to_array.py $OUTPUT_BMP ICON_NAME"
    echo ""
    echo "  2. Copy output into src/error_icons.h"
else
    echo ""
    echo "✗ Error: Failed to convert SVG"
    exit 1
fi
