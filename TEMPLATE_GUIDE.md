# Home Assistant Template Guide

## How Entity IDs Work

### In Home Assistant

Entity IDs have the format: `domain.entity_name`

Examples:

- `sensor.temperature_humidity_sensor_6e74_temperature`
- `sensor.temperature_humidity_sensor_6e74_humidity`
- `binary_sensor.door`
- `switch.living_room_light`

### In Templates

Replace the **dot** between domain and entity name with an **underscore**:

| Home Assistant Entity ID | Template Reference                |
| ------------------------ | --------------------------------- |
| `sensor.temperature`     | `entities.sensor_temperature`     |
| `binary_sensor.door`     | `entities.binary_sensor_door`     |
| `sensor.temp_sensor_123` | `entities.sensor_temp_sensor_123` |

## Template Syntax

### Basic Value Display

```handlebars
{{entities.sensor_temperature.state}}
```

### With Attributes

```handlebars
{{entities.sensor_temperature.state}}{{entities.sensor_temperature.attributes.unit_of_measurement}}
```

### Conditionals

```handlebars
{{#if entities.binary_sensor_door}}
  {{#if entities.binary_sensor_door.state_is_on}}
    <p>Door is OPEN</p>
  {{else}}
    <p>Door is closed</p>
  {{/if}}
{{/if}}
```

### Formatting Helpers

```handlebars
<!-- Round to integer -->
{{round entities.sensor_temperature.state}}

<!-- Format with decimals -->
{{formatNumber entities.sensor_temperature.state 2}}

<!-- Math operations -->
{{add entities.sensor_1.state entities.sensor_2.state}}
```

### Common Issues

#### 1. Missing Domain Prefix

❌ **Wrong:**

```handlebars
{{entities.temperature_sensor.state}}
```

✅ **Correct:**

```handlebars
{{entities.sensor_temperature_sensor.state}}
```

#### 2. Extra Dots in Reference

❌ **Wrong:**

```handlebars
{{entities.sensor.temperature_sensor.state}}
```

✅ **Correct:**

```handlebars
{{entities.sensor_temperature_sensor.state}}
```

#### 3. Not Replacing Domain Dot

❌ **Wrong:**
For HA entity `sensor.my_sensor`:

```handlebars
{{entities.sensor.my_sensor.state}}
```

✅ **Correct:**

```handlebars
{{entities.sensor_my_sensor.state}}
```

## Helper Properties

Every entity has these automatically added:

- **`.state`** - The entity state as a string
- **`.state_number`** - State converted to number
- **`.state_is_on`** - Boolean, true if state is "on"
- **`.state_is_off`** - Boolean, true if state is "off"
- **`.attributes`** - All entity attributes
- **`.last_changed`** - ISO timestamp

## Available Helpers

### Number Helpers

- `{{formatNumber value decimals}}` - Format with specific decimal places
- `{{round value}}` - Round to nearest integer
- `{{add a b}}` - Addition
- `{{subtract a b}}` - Subtraction
- `{{multiply a b}}` - Multiplication
- `{{divide a b}}` - Division

### String Helpers

- `{{uppercase text}}` - Convert to uppercase
- `{{lowercase text}}` - Convert to lowercase
- `{{truncate text length}}` - Truncate with ellipsis

### Global Variables

- `{{now}}` - Current timestamp (ISO format)
- `{{timestamp}}` - Current Unix timestamp

## Example Template

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: Arial;
        padding: 20px;
      }
      .sensor {
        font-size: 48px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <h1>Home Status</h1>

    <!-- Temperature Sensor -->
    <div>
      Temperature: {{#if entities.sensor_temperature_humidity_sensor_6e74_temperature}} {{round
      entities.sensor_temperature_humidity_sensor_6e74_temperature.state}}{{entities.sensor_temperature_humidity_sensor_6e74_temperature.attributes.unit_of_measurement}}
      {{else}} -- °C {{/if}}
    </div>

    <!-- Binary Sensor with Conditional Styling -->
    {{#if entities.binary_sensor_door}}
    <div style="{{#if entities.binary_sensor_door.state_is_on}}color: red{{else}}color: green{{/if}}">
      Door: {{#if entities.binary_sensor_door.state_is_on}}OPEN{{else}}Closed{{/if}}
    </div>
    {{/if}}

    <p style="font-size: 12px; color: #999;">Updated: {{now}}</p>
  </body>
</html>
```

## E-Ink Display Optimization

When designing templates for e-ink displays, follow these guidelines:

### Fixed Dimensions

```css
body {
  width: 800px;
  height: 600px;
  overflow: hidden;
}
```

### No Anti-Aliasing

```css
body {
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
}
```

### High Contrast

- Use pure black (#000000) and white (#FFFFFF) only
- Avoid gradients, shadows, and semi-transparent colors
- Use thick borders (3px or more) for better visibility

### Layout Tips

- Avoid complex animations or transitions
- Keep font sizes large (minimum 11px)

## Workflow

1. **Create template** in `templates/` directory
2. **Render with HA data:**
   ```bash
   curl "http://localhost:8000/ha/render?template=your-template.html"
   ```
3. **Convert to image:**
   ```bash
   curl "http://localhost:8000/image?template=your-template.html&format=bmp" > output.bmp
   ```

## Supported Multi-Word Domains

The system automatically recognizes these domains:

- `binary_sensor`
- `device_tracker`
- `media_player`
- `remote_control`
- `climate_control`
- `cover_control`

For other domains, use single-word format (sensor, switch, light, etc.).
