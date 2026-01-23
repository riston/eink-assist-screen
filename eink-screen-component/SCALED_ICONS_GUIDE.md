# Scaled Icon System for E-Ink Display

Store tiny icons and scale them up when displaying - saves flash memory without quality loss on e-ink displays.

## How It Works

1. **Store small**: 32×32 icon = 128 bytes
2. **Display large**: Scale 2×, 3×, or 4× when drawing
3. **Perfect for e-ink**: Monochrome, sharp edges look great scaled

## Memory Savings

| Stored Size | Storage | Scale 2× | Scale 3× | Scale 4× |
|-------------|---------|----------|----------|----------|
| 32×32       | 128 B   | 64×64    | 96×96    | 128×128  |
| 48×48       | 288 B   | 96×96    | 144×144  | 192×192  |
| 64×64       | 512 B   | 128×128  | 192×192  | 256×256  |

**Example:** 3 icons at 32×32 = 384 bytes vs 3 icons at 128×128 = 6,144 bytes (16× smaller!)

## Configuration

In `src/error_icons.h`:

```cpp
#define ICON_WIDTH 32    // Stored size
#define ICON_HEIGHT 32
#define ICON_SCALE 2     // Display scale (2 = 64×64, 3 = 96×96, 4 = 128×128)
```

## Creating Scaled Icons

### Step 1: Generate Small Icons

```bash
# Create 32×32 icons
./svg_to_icon.sh example_icons/wifi_error.svg wifi_32.bmp 32 128
./svg_to_icon.sh example_icons/server_error.svg server_32.bmp 32 128
./svg_to_icon.sh example_icons/http_error.svg http_32.bmp 32 128
```

### Step 2: Convert to C Arrays

```bash
./icon_to_array.py wifi_32.bmp ICON_WIFI_ERROR > wifi_array.txt
./icon_to_array.py server_32.bmp ICON_SERVER_ERROR > server_array.txt
./icon_to_array.py http_32.bmp ICON_HTTP_ERROR > http_array.txt
```

### Step 3: Update error_icons.h

Copy the arrays from the .txt files into `src/error_icons.h`, replacing the placeholder data.

### Step 4: Upload to ESP32

```bash
platformio run --target upload
```

## Adjusting Display Size

Want larger icons? Just change `ICON_SCALE`:

```cpp
#define ICON_SCALE 3  // Now displays at 96×96 (3× larger)
```

No need to regenerate icons - the same 32×32 data is scaled on the fly!

## Performance

**Scaling overhead:**
- 32×32 @ 2× scale: ~4ms to draw
- 32×32 @ 4× scale: ~15ms to draw

For error screens (rare events), this is negligible.

## Why This Works for E-Ink

1. **Monochrome**: Only black/white, no gray antialiasing lost
2. **Low DPI**: E-ink is ~150 DPI, scaling looks fine
3. **Static content**: Icons don't animate, blocky edges are okay
4. **Sharp edges**: Error icons are simple shapes, scale perfectly

## Design Tips for Scalable Icons

**Good:**
- Bold lines (≥3px at stored size)
- Simple shapes
- High contrast
- Geometric designs

**Avoid:**
- Thin lines (<2px)
- Fine details
- Complex patterns
- Text (unless ≥14pt)

## Examples

### 32×32 stored, 2× scale (64×64 displayed):
```
Storage: 128 bytes each
Display: 64×64 pixels
Good for: Simple icons, dashboard indicators
```

### 32×32 stored, 3× scale (96×96 displayed):
```
Storage: 128 bytes each
Display: 96×96 pixels
Good for: Prominent error screens
```

### 32×32 stored, 4× scale (128×128 displayed):
```
Storage: 128 bytes each
Display: 128×128 pixels
Good for: Large warning indicators
```

## Testing Different Scales

Generate multiple test versions:

```bash
# Generate 32×32 source
./svg_to_icon.sh example_icons/wifi_error.svg wifi_32.bmp 32 128

# Test how it looks at different display sizes
./svg_to_icon.sh example_icons/wifi_error.svg wifi_64.bmp 64 128  # 2× reference
./svg_to_icon.sh example_icons/wifi_error.svg wifi_96.bmp 96 128  # 3× reference
./svg_to_icon.sh example_icons/wifi_error.svg wifi_128.bmp 128 128 # 4× reference
```

Compare the references to see which scale looks best, then use that `ICON_SCALE` value with your 32×32 stored icons.

## Advanced: Different Scales Per Icon

If you want different icons at different scales, you can store them at different sizes:

```cpp
// error_icons.h
#define WIFI_ICON_SIZE 32
#define SERVER_ICON_SIZE 48
#define HTTP_ICON_SIZE 32

const uint8_t ICON_WIFI_ERROR[32*32/8] = {...};    // 128 bytes
const uint8_t ICON_SERVER_ERROR[48*48/8] = {...};  // 288 bytes
const uint8_t ICON_HTTP_ERROR[32*32/8] = {...};    // 128 bytes
```

Then call with appropriate scale:
```cpp
drawScaledBitmap(x, y, ICON_WIFI_ERROR, 32, 32, GxEPD_BLACK, 2);    // 64×64
drawScaledBitmap(x, y, ICON_SERVER_ERROR, 48, 48, GxEPD_BLACK, 2); // 96×96
drawScaledBitmap(x, y, ICON_HTTP_ERROR, 32, 32, GxEPD_BLACK, 3);   // 96×96
```

## Troubleshooting

**Icons look too blocky:**
- Increase stored size (32→48 or 48→64)
- Or reduce scale factor

**Icons too small:**
- Increase `ICON_SCALE`
- Or store larger icons

**Icons not displaying:**
- Check that ICON_WIDTH/HEIGHT match your stored icon size
- Verify arrays are marked PROGMEM
- Check serial monitor for errors

## Summary

✅ Store 32×32 (128 bytes each)
✅ Set `ICON_SCALE 2` for 64×64 display
✅ Change scale anytime without regenerating icons
✅ Perfect quality for e-ink displays
✅ 16× memory savings compared to storing at full size
