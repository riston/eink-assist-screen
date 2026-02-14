# Offset-Based Rendering Guidelines

## Overview

Offset-based rendering allows you to download BMP images in chunks rather than downloading the entire image at once. This is particularly useful for e-ink displays with limited memory or bandwidth constraints.

## How It Works

The renderer generates a complete BMP image in memory, but allows you to retrieve specific byte ranges through URL parameters:

- **offset**: Starting byte position in the image
- **limit**: Number of bytes to retrieve from the offset
- **includeHeader**: (Optional) Include the BMP header for browser viewing

## BMP File Structure

Understanding the BMP structure is crucial for offset-based downloads:

```
┌─────────────────────────┐
│ BMP File Header (14 B)  │  Bytes 0-13
├─────────────────────────┤
│ DIB Header (40 B)       │  Bytes 14-53
├─────────────────────────┤
│ Color Palette (8 B)     │  Bytes 54-61  (for 1-bit BMP)
├─────────────────────────┤
│ Pixel Data              │  Bytes 62+
│ (varies by resolution)  │
└─────────────────────────┘
```

For standard 800x480 1-bit BMP:
- **Header size**: 62 bytes (file header + DIB header + color palette)
- **Pixel data size**: 48,000 bytes
- **Total file size**: 48,062 bytes

## Usage Patterns

### Pattern 1: Full Image Download (Default)

For devices with sufficient memory, download the complete image:

```bash
GET /image?url=<target>&format=bmp
```

**Response**: Complete BMP file (48,062 bytes for 800x480)

### Pattern 2: Chunked Download for E-ink Device

For memory-constrained devices, download pixel data in chunks:

```bash
# First chunk (skip header, get first 10KB of pixel data)
GET /image?url=<target>&format=bmp&offset=62&limit=10240

# Second chunk
GET /image?url=<target>&format=bmp&offset=10302&limit=10240

# Third chunk
GET /image?url=<target>&format=bmp&offset=20542&limit=10240

# Continue until all pixel data is downloaded...
```

**Important**:
- Start offset at 62 to skip the header
- Calculate next offset as: `previous_offset + previous_limit`
- The e-ink device should reconstruct the image by writing chunks sequentially to its display buffer

### Pattern 3: Chunked Download with Browser Preview

For debugging or viewing chunks in a browser:

```bash
# Get chunk with header included
GET /image?url=<target>&format=bmp&offset=62&limit=10240&includeHeader=true
```

**Response**: 10,302 bytes (62-byte header + 10,240 bytes pixel data)

This creates a valid BMP file that can be opened in image viewers or browsers.

**Important**: The BMP header describes the full image (800x480, 48,000 bytes), but only partial pixel data is included. Most image viewers will:
- Display the actual pixel data correctly (first 10,240 bytes)
- Fill missing pixel data with BLACK (not white) since missing bytes are treated as 0x00
- For 1-bit BMP: bit 0 = black, bit 1 = white in the color palette

So if you download offset=62, limit=5000 with includeHeader=true:
- Top ~5-10 rows will display correctly
- Remaining ~470+ rows will appear solid BLACK

## Implementation Guidelines

### For E-ink Display Firmware

1. **Calculate chunk size** based on available RAM:
   ```
   chunk_size = min(available_ram - overhead, remaining_bytes)
   ```

2. **Download header separately** (optional but recommended):
   ```bash
   GET /image?url=<target>&format=bmp&offset=0&limit=62
   ```
   Parse header to verify image dimensions match your display.

3. **Download pixel data in chunks**:
   ```python
   offset = 62  # Start after header
   chunk_size = 10240  # 10KB chunks

   while offset < total_image_size:
       response = get(f"/image?url={url}&format=bmp&offset={offset}&limit={chunk_size}")
       write_to_display_buffer(response.data)
       offset += chunk_size
   ```

4. **Handle last chunk** which may be smaller:
   ```python
   remaining = total_image_size - offset
   if remaining < chunk_size:
       chunk_size = remaining
   ```

### For Testing/Development

1. **Verify full image first**:
   ```bash
   curl "http://localhost:8000/image?url=data:text/html,<h1>Test</h1>&format=bmp" \
     -o test_full.bmp
   open test_full.bmp  # Verify it renders correctly
   ```

2. **Test chunked download**:
   ```bash
   # Download chunks with headers for visual verification
   curl "http://localhost:8000/image?url=data:text/html,<h1>Test</h1>&format=bmp&offset=62&limit=10240&includeHeader=true" \
     -o test_chunk1.bmp
   open test_chunk1.bmp  # Should show partial image
   ```

3. **Verify reconstruction**:
   ```bash
   # Download header
   curl "http://localhost:8000/image?url=<url>&format=bmp&offset=0&limit=62" \
     -o reconstructed.bmp

   # Append chunks
   curl "http://localhost:8000/image?url=<url>&format=bmp&offset=62&limit=10240" \
     >> reconstructed.bmp
   curl "http://localhost:8000/image?url=<url>&format=bmp&offset=10302&limit=10240" \
     >> reconstructed.bmp
   # ... continue for all chunks

   # Compare with original
   diff original.bmp reconstructed.bmp
   ```

## Best Practices

### Chunk Size Selection

Choose chunk size based on your constraints:

| Device RAM | Recommended Chunk Size | Chunks for 800x480 |
|-----------|----------------------|-------------------|
| 2-4 KB    | 2,048 bytes         | ~24 chunks        |
| 8-16 KB   | 8,192 bytes         | ~6 chunks         |
| 32+ KB    | 16,384 bytes        | ~3 chunks         |
| 64+ KB    | Full image          | 1 request         |

### Network Optimization

1. **Use persistent connections**: Keep HTTP connection alive between chunk requests
2. **Pipeline requests**: If supported, send multiple chunk requests without waiting
3. **Handle retries**: Implement retry logic for failed chunk downloads
4. **Cache images**: Store rendered images server-side with cache keys based on URL+params

### Error Handling

```python
def download_chunk(url, offset, limit, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.get(
                f"/image?url={url}&format=bmp&offset={offset}&limit={limit}",
                timeout=30
            )
            if response.status_code == 200:
                return response.content
            elif response.status_code == 500:
                # Server error, retry
                continue
            else:
                # Client error, don't retry
                raise Exception(f"HTTP {response.status_code}")
        except requests.Timeout:
            if attempt == max_retries - 1:
                raise
            continue
    raise Exception("Max retries exceeded")
```

## Parameter Reference

### Required Parameters

- **url**: Target URL to render (must be URL-encoded)
- **format**: Image format (`bmp` recommended for e-ink)

### Optional Parameters

- **width**: Viewport width in pixels (default: 800)
- **height**: Viewport height in pixels (default: 480)
- **threshold**: Black/white threshold 0-255 (default: 128)
- **offset**: Starting byte position (default: 0)
- **limit**: Maximum bytes to return (default: entire image)
- **includeHeader**: Include BMP header when using offset (default: false)

## Examples

### Example 1: Download Full Image

```bash
curl "http://localhost:8000/image?url=https://example.com&format=bmp" \
  -o display.bmp
```

### Example 2: Memory-Constrained Device (Arduino/ESP32)

```cpp
const char* url = "http://192.168.0.113:8000/image";
const char* target = "https://example.com";
const int CHUNK_SIZE = 4096;  // 4KB chunks
int offset = 62;  // Skip header

while (offset < 48062) {  // Total image size
    String request = String(url) +
                    "?url=" + urlEncode(target) +
                    "&format=bmp" +
                    "&offset=" + offset +
                    "&limit=" + CHUNK_SIZE;

    HTTPClient http;
    http.begin(request);
    int httpCode = http.GET();

    if (httpCode == 200) {
        WiFiClient* stream = http.getStreamPtr();
        uint8_t buffer[CHUNK_SIZE];
        int len = stream->readBytes(buffer, CHUNK_SIZE);

        // Write to e-ink display buffer
        writeToDisplay(buffer, len);

        offset += len;
    }

    http.end();
}
```

### Example 3: Python Client with Progress

```python
import requests
from tqdm import tqdm

def download_chunked_image(url, output_file, chunk_size=10240):
    # Get image metadata
    response = requests.get(
        f"http://localhost:8000/image",
        params={"url": url, "format": "bmp", "offset": 0, "limit": 62}
    )
    header = response.content

    # Parse BMP header to get total size
    import struct
    total_size = struct.unpack('<I', header[2:6])[0]

    with open(output_file, 'wb') as f:
        # Write header
        f.write(header)

        # Download pixel data in chunks
        offset = 62
        with tqdm(total=total_size-62, unit='B', unit_scale=True) as pbar:
            while offset < total_size:
                response = requests.get(
                    f"http://localhost:8000/image",
                    params={
                        "url": url,
                        "format": "bmp",
                        "offset": offset,
                        "limit": chunk_size
                    }
                )

                chunk = response.content
                f.write(chunk)

                offset += len(chunk)
                pbar.update(len(chunk))

# Usage
download_chunked_image("https://example.com", "output.bmp")
```

## Troubleshooting

### Issue: Reconstructed image is corrupted

**Cause**: Chunks downloaded in wrong order or with gaps

**Solution**:
- Ensure sequential offset calculation
- Verify each chunk's byte count matches expected
- Check that final file size matches BMP header's declared size

### Issue: Image appears inverted or shifted

**Cause**: BMP row padding not accounted for

**Solution**: The renderer handles padding automatically. Ensure you're downloading complete rows when possible:
```python
row_size_bytes = math.ceil(width / 8)
padded_row_size = math.ceil(row_size_bytes / 4) * 4
chunk_size = padded_row_size * num_rows
```

### Issue: "includeHeader=true" creates images with incorrect dimensions

**Cause**: Partial pixel data doesn't match full image dimensions in header

**Solution**: This is expected behavior. The header describes the full image, but only partial pixel data is included. These files are for preview only, not for e-ink rendering.

### Issue: Partial images with includeHeader show black area at bottom

**Cause**: Missing pixel data bytes are interpreted as 0x00 by image viewers

**Solution**: This is expected behavior. When viewing partial chunks:
- Actual pixel data displays correctly
- Missing data appears as BLACK (since 0x00 = black in 1-bit BMP)
- This is useful for debugging - you can see exactly how much data was received
- The black area shows what's missing, not what will render on the e-ink display

### Issue: Server returns 500 error

**Cause**: Puppeteer failed to render page

**Solution**:
- Check server logs for details
- Verify target URL is accessible
- Ensure sufficient memory for rendering
- Check Chrome/Puppeteer is properly installed

## Performance Considerations

### Server-Side Caching

The renderer generates images on-demand. For production:

1. **Implement caching**: Cache rendered images with TTL
2. **Use hash keys**: `hash(url + width + height + threshold)`
3. **Store full images**: Store complete BMP, serve chunks from cache

### Client-Side Optimization

1. **Batch small chunks**: Multiple tiny requests create overhead
2. **Use compression**: Enable gzip for network transfer (decompress on device)
3. **Partial updates**: Only download changed regions when possible

### Network Bandwidth

For 800x480 1-bit BMP (48,062 bytes):
- **WiFi (1 Mbps)**: ~0.4 seconds
- **3G (384 Kbps)**: ~1 second
- **2G (64 Kbps)**: ~6 seconds
- **LoRa (5 Kbps)**: ~77 seconds

Consider chunk size and update frequency based on your network.

## Security Notes

1. **URL validation**: The server validates URL format but doesn't restrict domains
2. **Rate limiting**: Implement rate limiting to prevent abuse
3. **Timeout**: Page rendering times out after 10 seconds
4. **Resource limits**: Puppeteer runs with sandbox disabled for compatibility

For production deployments, add:
- Authentication/API keys
- Domain whitelist for target URLs
- Request rate limiting
- HTTPS enforcement
