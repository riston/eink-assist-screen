#!/usr/bin/env python3
"""
Convert 1-bit BMP images to C byte arrays for ESP32 PROGMEM storage.

Usage:
    python icon_to_array.py <input.bmp> <array_name>

Example:
    python icon_to_array.py wifi_error_64x64.bmp ICON_WIFI_ERROR

The script will output C code that can be copied into error_icons.h
"""

import sys
import struct

def parse_bmp_header(data):
    """Parse BMP file header to get image dimensions and data offset."""
    # BMP signature
    if data[0:2] != b'BM':
        raise ValueError("Not a valid BMP file")

    # Data offset (where pixel data starts)
    data_offset = struct.unpack('<I', data[10:14])[0]

    # DIB header size
    dib_header_size = struct.unpack('<I', data[14:18])[0]

    # Image dimensions
    width = struct.unpack('<i', data[18:22])[0]
    height = struct.unpack('<i', data[22:26])[0]

    # Bits per pixel
    bpp = struct.unpack('<H', data[28:30])[0]

    if bpp != 1:
        raise ValueError(f"Only 1-bit BMP supported, got {bpp}-bit")

    return {
        'width': abs(width),
        'height': abs(height),
        'data_offset': data_offset,
        'is_bottom_up': height > 0
    }

def bmp_to_icon_array(filename, icon_name):
    """Convert BMP file to C array format."""
    try:
        with open(filename, 'rb') as f:
            data = f.read()

        # Parse header
        info = parse_bmp_header(data)

        print(f"// Image info: {info['width']}x{info['height']}, bottom-up: {info['is_bottom_up']}")
        print(f"// File: {filename}")
        print(f"// Size: {len(data)} bytes total, {len(data) - info['data_offset']} bytes pixel data")
        print()

        # Extract pixel data (skip header)
        pixel_data = data[info['data_offset']:]

        # Invert colors for e-ink display (BMP uses opposite polarity)
        inverted = bytes(~b & 0xFF for b in pixel_data)

        # Generate C array
        print(f"const uint8_t {icon_name}[] PROGMEM = {{")

        # Output 12 bytes per line for readability
        for i in range(0, len(inverted), 12):
            chunk = inverted[i:i+12]
            line = "  " + ", ".join(f"0x{b:02x}" for b in chunk)
            if i + 12 < len(inverted):
                line += ","
            print(line)

        print("};")
        print()
        print(f"// Array size: {len(inverted)} bytes")
        print(f"// Memory usage: {len(inverted)} bytes in flash (PROGMEM)")

    except FileNotFoundError:
        print(f"Error: File '{filename}' not found", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    if len(sys.argv) != 3:
        print("Usage: python icon_to_array.py <input.bmp> <array_name>")
        print()
        print("Example:")
        print("  python icon_to_array.py wifi_error_64x64.bmp ICON_WIFI_ERROR")
        print()
        print("Generates C code for error_icons.h from a 1-bit BMP file.")
        sys.exit(1)

    filename = sys.argv[1]
    icon_name = sys.argv[2]

    bmp_to_icon_array(filename, icon_name)

if __name__ == "__main__":
    main()
