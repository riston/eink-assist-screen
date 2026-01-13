# Implementation Plan: Home Assistant API Integration

## Overview

Add a separate endpoint to render HTML templates (stored on the server) with live sensor data fetched from Home Assistant API. Templates use Handlebars syntax for placeholders, and the final rendered HTML is converted to images via the existing Puppeteer pipeline.

## Requirements Summary

- **Template Storage**: HTML files in `templates/` directory on server
- **Placeholder Format**: Handlebars/Mustache template engine (supports loops, conditionals, helpers)
- **Data Source**: Fetch entity states and attributes from Home Assistant REST API
- **Flow Pattern**: Server stores templates → fetches HA data → renders → converts to image
- **Integration**: Render templates via new endpoint, integrate with existing `/image` pipeline

---

## Architecture Design

### Endpoint Structure

**Primary Endpoint**: `GET /ha/render`

**Parameters**:
- `template` (required): Template filename (e.g., `dashboard.html`, `temperature.html`)
- `cache_ttl` (optional): Time-to-live in seconds for caching rendered HTML (default: 300)
- `force_refresh` (optional): Boolean to bypass cache and re-fetch HA data

**Response Format**:
```json
{
  "success": true,
  "template": "dashboard.html",
  "entities_fetched": 5,
  "html_length": 1234,
  "cached_at": "2026-01-11T12:00:00Z",
  "cache_key": "ha:dashboard.html"
}
```

**Template Directory Structure**:
```
/renderer/
  templates/
    dashboard.html          # Main dashboard
    temperature.html        # Temperature display
    weather.html           # Weather widget
    ...
```

### Integration with Existing `/image` Endpoint

Add `template` parameter as an alternative to `url` parameter.

**Example**:
```bash
# Step 1: Render template with live HA data (optional - can skip if using auto-render)
GET /ha/render?template=dashboard.html

# Step 2: Convert rendered HTML to image using template parameter
GET /image?template=dashboard.html&format=bmp
```

**Implementation**:
- Modify parameter validation to accept either `url` OR `template` (mutually exclusive)
- If `template` parameter provided:
  - Look up rendered HTML from cache (key: `ha:<template_name>`)
  - If cache miss, automatically call render process
  - Pass HTML directly to Puppeteer using `page.setContent(html)`
- If `url` parameter provided:
  - Use existing logic with `page.goto(url)`
- Continue with existing screenshot/conversion pipeline

---

## Technical Components

### 1. Configuration (`src/config.ts`)

**Purpose**: Load and validate Home Assistant configuration from addon options

**Data Sources**:
- Environment variables set by Home Assistant addon
- `/data/options.json` (HA addon pattern)

**Configuration Schema**:
```typescript
interface HAConfig {
  accessToken: string;
  homeAssistantUrl: string;
  cacheTtlDefault: number;
  cacheMaxSize: number;
  persistCache: boolean;
}
```

**Validation**:
- Ensure `accessToken` is non-empty
- Ensure `homeAssistantUrl` is valid URL
- Validate numeric ranges for TTL and cache size

### 2. Home Assistant API Client (`src/haClient.ts`)

**Purpose**: Fetch entity states and attributes from Home Assistant REST API

**Core Methods**:
```typescript
async function getEntityState(entityId: string): Promise<EntityState>
async function getMultipleStates(entityIds: string[]): Promise<Record<string, EntityState>>
```

**Home Assistant API**:
- Endpoint: `GET /api/states/<entity_id>`
- Auth: `Authorization: Bearer <token>` header
- Response includes: state, attributes, last_changed, last_updated

**Entity State Structure**:
```typescript
interface EntityState {
  entity_id: string;
  state: string;          // e.g., "22.5", "on", "off"
  attributes: Record<string, any>;  // unit_of_measurement, friendly_name, etc.
  last_changed: string;
  last_updated: string;
}
```

**Features**:
- Batch fetching for multiple entities (parallel requests)
- Authentication with long-lived access token
- 5-second timeout per request
- Simple retry logic: 1 attempt → wait 1s → 1 final attempt
- Error categorization (network, auth, entity not found)

**Error Handling**:
- Network errors → 503 Service Unavailable
- Auth errors (401/403) → 401 Unauthorized
- Entity not found (404) → Return null or error depending on strictness

### 3. Template Storage (`src/templateStorage.ts`)

**Purpose**: Load and manage HTML template files from disk

**Template Directory**: `./templates/` (relative to project root)

**Core Methods**:
```typescript
async function loadTemplate(filename: string): Promise<string>
async function listTemplates(): Promise<string[]>
function templateExists(filename: string): boolean
```

**Features**:
- Read `.html` files from templates directory
- Validate file existence before loading
- Security: Prevent path traversal (only allow files in templates/)
- Error handling for missing files, read errors

**Template File Example** (`templates/dashboard.html`):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; font-size: 48px; padding: 20px; }
    .temperature { font-size: 72px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Home Dashboard</h1>
  <div class="temperature">
    {{entities.sensor_temperature.state}}{{entities.sensor_temperature.attributes.unit_of_measurement}}
  </div>
  <p>Humidity: {{entities.sensor_humidity.state}}%</p>
  {{#if entities.binary_sensor_door.state_is_on}}
    <p style="color: red;">Door is OPEN!</p>
  {{else}}
    <p>Door is closed</p>
  {{/if}}
</body>
</html>
```

### 4. Template Engine (`src/templateEngine.ts`)

**Purpose**: Render Handlebars templates with Home Assistant entity data

**Template Engine**: **Handlebars.js** (add as dependency)

**Core Method**:
```typescript
async function renderTemplate(
  templateHtml: string,
  entities: Record<string, EntityState>
): Promise<string>
```

**Data Structure Passed to Templates**:
```typescript
{
  entities: {
    sensor_temperature: {
      state: "22.5",
      state_number: 22.5,
      state_is_on: false,
      state_is_off: false,
      attributes: {
        unit_of_measurement: "°C",
        friendly_name: "Living Room Temperature",
        device_class: "temperature"
      },
      last_changed: "2026-01-11T12:00:00Z"
    },
    // ... more entities
  },
  now: "2026-01-11T12:05:30Z",
  timestamp: 1704974730000
}
```

**Custom Handlebars Helpers**:
- `{{formatNumber value decimals}}` - Format numbers with specific decimal places
- `{{formatDate timestamp format}}` - Format ISO timestamps
- `{{round value}}` - Round to nearest integer
- `{{state_is entity "on"}}` - Check if state matches value

**Entity Extraction**:
- Parse template to find all `{{entities.XXX}}` references
- Extract unique entity IDs
- Return list of entities to fetch from HA

### 5. Rendered HTML Cache (`src/renderedCache.ts`)

**Purpose**: In-memory storage for rendered HTML (with HA data injected) with TTL and LRU eviction

**Storage Structure**:
```typescript
interface CacheEntry {
  html: string;
  cachedAt: Date;
  ttl: number;
  templateName: string;
  entitiesFetched: number;
}

const cache = new Map<string, CacheEntry>();
```

**Cache Key Strategy**:
- Key format: `ha:<template_name>` (e.g., `ha:dashboard.html`)
- Simple and predictable

**Features**:
- TTL-based expiration (checked on retrieval)
- LRU eviction when max size reached (default: 50 rendered templates)
- Optional periodic cleanup (every 5 minutes)

**Core Methods**:
```typescript
set(key: string, html: string, ttl: number, metadata: object): void
get(key: string): string | null  // Returns null if expired
has(key: string): boolean
clear(): void
getStats(): CacheStats
```

### 6. Request Handler (`src/haHandler.ts`)

**Purpose**: Handle `/ha/render` endpoint requests with parameter validation

**Processing Flow**:
1. Parse query parameters
2. Validate required `template` parameter (filename)
3. Check if template file exists
4. Generate cache key: `ha:<template_name>`
5. Check rendered HTML cache (unless `force_refresh=true`)
6. If cache miss or force refresh:
   a. Load template file from disk
   b. Parse template to extract entity references
   c. Fetch entity states from Home Assistant API (parallel requests)
   d. Render template with Handlebars, injecting entity data
   e. Store rendered HTML in cache with TTL
7. Return success response with metadata

**Validation Pattern** (following existing code style):
- Multi-stage validation with structured errors
- Return 400 for missing/invalid parameters
- Consistent error response format

**Error Response Format**:
```json
{
  "error": "Error type",
  "message": "Detailed explanation",
  "details": { /* context-specific data */ }
}
```

---

## File Changes

### New Files

1. **`src/config.ts`** (~80 lines)
   - Load HA configuration from environment/options.json
   - Export singleton configuration object
   - Validate at startup

2. **`src/haClient.ts`** (~250 lines)
   - Home Assistant API client
   - Fetch entity states (single and batch)
   - Authentication and retry logic
   - Error categorization

3. **`src/templateStorage.ts`** (~100 lines)
   - Load HTML templates from `./templates/` directory
   - List available templates
   - Security: prevent path traversal
   - Error handling for missing files

4. **`src/templateEngine.ts`** (~200 lines)
   - Handlebars template engine integration
   - Custom helpers (formatNumber, formatDate, etc.)
   - Entity extraction from templates (parse `{{entities.XXX}}`)
   - Render templates with entity data

5. **`src/renderedCache.ts`** (~150 lines)
   - Map-based in-memory cache for rendered HTML
   - TTL checking on retrieval
   - LRU eviction
   - Cache statistics

6. **`src/haHandler.ts`** (~200 lines)
   - Request handler for `/ha/render`
   - Parameter validation
   - Orchestrate: load template → extract entities → fetch data → render
   - Structured error responses

7. **`src/haHandler.test.ts`** (~350 lines)
   - Unit tests for HA integration
   - Mock HA API responses
   - Mock template files
   - Test caching behavior
   - Test template rendering
   - Test all error scenarios

### Modified Files

1. **`src/server.ts`** (+40 lines)
   - Add route for `/ha/render` endpoint
   - Import and initialize HA components
   - Add route handler in main request router

2. **`src/imageHandler.ts`** (+30 lines)
   - Modify parameter validation to accept either `url` OR `template` (mutually exclusive)
   - Extract template name from `template` parameter
   - Look up rendered HTML from cache
   - If cache miss, optionally auto-render (or return 404)
   - Pass HTML directly to `page.setContent()` instead of `page.goto()` for template mode
   - Modify rendering logic to handle both URL mode and HTML content mode
   - Return helpful 404 if template not found

3. **`src/index.ts`** (+10 lines)
   - Initialize configuration at startup
   - Create templates directory if it doesn't exist
   - Log HA integration status
   - Log available templates

4. **`package.json`** (add dependencies)
   - **`handlebars`**: ^4.7.8 - Template engine

---

## Implementation Sequence

### Phase 1: Core Functionality (MVP)

1. **Add Handlebars dependency**
   - Run: `npm install handlebars`
   - Update package.json

2. **Create `config.ts`**
   - Load HA configuration from environment/options.json
   - Validate required fields (accessToken, homeAssistantUrl)
   - Export singleton

3. **Create `templateStorage.ts`**
   - Load HTML files from `./templates/` directory
   - Implement security checks (prevent path traversal)
   - List available templates
   - Error handling for missing files

4. **Create `haClient.ts`**
   - Implement basic API client (no retry initially)
   - GET `/api/states/<entity_id>`
   - Batch fetching for multiple entities
   - Authentication header
   - Basic error handling

5. **Create `templateEngine.ts`**
   - Initialize Handlebars
   - Implement basic custom helpers (formatNumber, formatDate)
   - Entity extraction (parse template for `{{entities.XXX}}`)
   - Render template with entity data

6. **Create `renderedCache.ts`**
   - In-memory Map storage
   - Basic set/get/has methods
   - TTL checking (no LRU initially)

7. **Create `haHandler.ts`**
   - Request handler with parameter validation
   - Orchestrate: load template → extract entities → fetch HA data → render
   - Store in cache
   - Return success response

8. **Modify `server.ts`**
   - Add route for `/ha/render`
   - Import haHandler
   - Wire up endpoint

9. **Modify `imageHandler.ts`**
   - Change validation to accept either `url` OR `template` parameter (mutually exclusive)
   - If `template` provided: look up rendered HTML from cache
   - If cache miss: optionally auto-render or return 404
   - Modify rendering to support both URL mode (`page.goto()`) and HTML mode (`page.setContent()`)
   - Pass HTML directly to Puppeteer when using `template` parameter

10. **Modify `index.ts`**
    - Initialize config at startup
    - Create `./templates/` directory if it doesn't exist
    - Log HA integration status

11. **Create example template**
    - Create `./templates/example.html`
    - Simple template with 1-2 entities for testing

12. **Manual Testing**
    - Test with real Home Assistant instance
    - Verify end-to-end workflow

### Phase 2: Robustness

13. **Add retry logic to `haClient`**
    - Simple retry (1 attempt after 1s)
    - Only retry on network errors

14. **Add LRU eviction to `renderedCache`**
    - Track access order
    - Evict least recently used when max size reached

15. **Enhance error handling**
    - Improve error messages
    - Add contextual details (missing entities, template errors)
    - Test all error paths

16. **Create `haHandler.test.ts`**
    - Mock HA API responses
    - Mock template files
    - Test caching scenarios
    - Test template rendering
    - Test error handling
    - Integration tests

17. **Add more Handlebars helpers**
    - Math operations (add, subtract, multiply, divide)
    - String operations (uppercase, lowercase, truncate)
    - Conditional helpers

### Phase 3: Polish (Optional)

18. **Add `/ha/templates` endpoint**
    - List available templates
    - Return template names and metadata

19. **Add `/ha/status` endpoint**
    - Cache statistics (hit rate, size, entries)
    - HA connectivity check
    - Configuration status
    - List of entities currently in use

20. **Update `config.yaml`**
    - Add new addon options (cache_ttl_default, cache_max_size)
    - Document configuration

21. **Documentation**
    - Update README
    - Add template creation guide
    - Add usage examples
    - API documentation

---

## Error Handling Strategy

### Error Categories

1. **Missing Configuration** → 500 Internal Server Error
   - Message: "Home Assistant not configured"
   - Details: Required configuration options (access_token, home_assistant_url)

2. **Template File Not Found** → 404 Not Found
   - Message: "Template not found: {template_name}"
   - Details: Available templates, templates directory path

3. **HA Unreachable** → 503 Service Unavailable
   - Message: "Home Assistant is unreachable"
   - Details: HA URL, timeout, error type

4. **Authentication Failed** → 401 Unauthorized
   - Message: "Invalid Home Assistant access token"
   - Details: Check addon configuration

5. **Entity Not Found** → 404 Not Found (or warning)
   - Message: "Entity not found in Home Assistant: {entity_id}"
   - Details: List of missing entities
   - Behavior: Continue rendering with null values or fail (configurable)

6. **Template Rendering Error** → 500 Internal Server Error
   - Message: "Template rendering failed"
   - Details: Handlebars error message, line number if available

7. **Cache Miss** → 404 Not Found
   - Message: "Rendered template not in cache: {template_name}"
   - Details: Suggestion to call `/ha/render` first

8. **Missing Parameters** → 400 Bad Request
   - Message: "Either 'url' or 'template' parameter is required"
   - Details: Parameter requirements

9. **Conflicting Parameters** → 400 Bad Request
   - Message: "Cannot specify both 'url' and 'template' parameters"
   - Details: Parameters are mutually exclusive

---

## Configuration

### Addon Configuration (`config.yaml`)

```yaml
options:
  access_token: ""
  home_assistant_url: "http://homeassistant:8123"
  cache_ttl_default: 300
  cache_max_size: 100
  persist_cache: false
schema:
  access_token: str
  home_assistant_url: str
  cache_ttl_default: int
  cache_max_size: int
  persist_cache: bool
```

### Environment Variables

- `HASSIO_TOKEN` or read from `/data/options.json`
- Set automatically by Home Assistant addon system

---

## Usage Examples

### Example 1: Simple Dashboard Workflow

```bash
# Step 1: Create template file (done once)
cat > templates/dashboard.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; font-size: 36px; padding: 20px; }
    .temp { font-size: 72px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Home Dashboard</h1>
  <div class="temp">
    {{entities.sensor_living_room_temperature.state}}{{entities.sensor_living_room_temperature.attributes.unit_of_measurement}}
  </div>
</body>
</html>
EOF

# Step 2: Render template with live HA data
curl "http://localhost:8000/ha/render?template=dashboard.html"

# Response:
# {
#   "success": true,
#   "template": "dashboard.html",
#   "entities_fetched": 1,
#   "html_length": 425,
#   "cached_at": "2026-01-11T12:00:00Z",
#   "cache_key": "ha:dashboard.html"
# }

# Step 3: Convert to BMP image
curl "http://localhost:8000/image?template=dashboard.html&format=bmp" --output display.bmp
```

### Example 2: Auto-Refresh E-ink Pattern

```bash
# Device firmware calls this every 5 minutes

# 1. Refresh template with latest HA data
curl "http://localhost:8000/ha/render?template=main.html&force_refresh=true"

# 2. Download first chunk for e-ink display
curl "http://localhost:8000/image?template=main.html&format=bmp&offset=62&limit=6000" > chunk1.bin

# 3. Download remaining chunks
curl "http://localhost:8000/image?template=main.html&format=bmp&offset=6062&limit=6000" > chunk2.bin
```

### Example 3: Multi-Entity Display with Conditionals

```bash
# Create advanced template with multiple entities
cat > templates/weather.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; padding: 20px; background: white; }
    .big { font-size: 64px; font-weight: bold; }
    .medium { font-size: 36px; }
    .warning { color: red; }
  </style>
</head>
<body>
  <h1>Weather Station</h1>

  <div class="big">
    {{round entities.sensor_outdoor_temperature.state}}°C
  </div>

  <div class="medium">
    Humidity: {{entities.sensor_outdoor_humidity.state}}%
  </div>

  {{#if entities.binary_sensor_rain.state_is_on}}
    <p class="warning">⚠ Rain detected!</p>
  {{else}}
    <p>No rain</p>
  {{/if}}

  <p>Wind: {{entities.sensor_wind_speed.state}} {{entities.sensor_wind_speed.attributes.unit_of_measurement}}</p>
</body>
</html>
EOF

# Render and convert to image
curl "http://localhost:8000/ha/render?template=weather.html"
curl "http://localhost:8000/image?template=weather.html&format=bmp&width=800&height=480" --output weather.bmp
```

### Example 4: One-Shot Rendering (Skip Caching)

```bash
# Directly render template to image in one request
# The /image endpoint will auto-render if cache is empty
curl "http://localhost:8000/image?template=dashboard.html&format=bmp" --output display.bmp
```

---

## Testing Strategy

### Unit Tests

**File**: `src/haHandler.test.ts`

- Mock HA API responses (success, errors, timeouts)
- Test successful template rendering
- Test caching (hit/miss/expiration)
- Test all error scenarios
- Test cache key generation
- Test parameter validation

### Integration Tests

**File**: `src/server.test.ts` (extend existing)

- Test `/ha/template` endpoint end-to-end
- Test `/image` with `ha://` URLs
- Test cache integration across endpoints
- Test configuration loading

### Manual Testing Checklist

- [ ] Create simple template with 1 entity
- [ ] Create complex template with multiple entities and conditionals
- [ ] Render template via `/ha/render?template=simple.html`
- [ ] Convert to image via `/image?template=simple.html`
- [ ] Test one-shot rendering without pre-caching (auto-render on /image request)
- [ ] Test cache hit (immediate second request to /ha/render)
- [ ] Test cache miss (invalid template name → 404)
- [ ] Test template file not found (→ 404 with helpful message)
- [ ] Test mutually exclusive params (url + template together → 400 error)
- [ ] Test with HA offline (network error → 503)
- [ ] Test with invalid token (auth error → 401)
- [ ] Test with missing entity (entity not found, continue with null or fail)
- [ ] Test with Handlebars syntax error (→ 500 with error details)
- [ ] Test cache expiration (wait for TTL, verify re-fetch)
- [ ] Test chunked rendering with HA templates
- [ ] Test LRU eviction (fill cache beyond max size)
- [ ] Test force_refresh parameter
- [ ] Test custom Handlebars helpers (formatNumber, round, etc.)

---

## Success Metrics

- `/ha/render` responds in < 800ms for templates with 5 entities (95th percentile)
- Entity fetching happens in parallel (not sequential)
- Cache hit rate > 85% for typical usage patterns
- Zero crashes from HA API errors or template errors
- All error responses include actionable information (template name, entity IDs, etc.)
- 100% test coverage for new modules
- All existing tests continue to pass
- Templates can be created/edited without server restart

---

## Data Flow Diagram

```
User/Automation
      |
      | GET /ha/render?template=dashboard.html
      v
┌──────────────────┐
│  server.ts       │
│  Route handler   │
└────────┬─────────┘
         |
         v
┌─────────────────────────┐
│  haHandler.ts           │
│  - Validate params      │
│  - Check cache (ha:*)   │
└────┬──────────────┬─────┘
     |              |
     v (miss)       v (hit)
┌─────────────────────────┐  ┌─────────────────┐
│  1. Load template file  │  │  Return cached  │
│  templateStorage.ts     │  └─────────────────┘
└────┬────────────────────┘
     |
     v
┌─────────────────────────┐
│  2. Extract entities    │
│  templateEngine.ts      │
│  Parse {{entities.X}}   │
└────┬────────────────────┘
     |
     | [entity_ids: sensor_temp, binary_sensor_door, ...]
     v
┌─────────────────────────┐
│  3. Fetch entity states │
│  haClient.ts            │
│  Parallel GET requests  │
└────┬────────────────────┘
     |
     | HTTP requests
     v
┌───────────────────────────┐
│ Home Assistant            │
│ GET /api/states/entity_id │
│ (multiple in parallel)    │
└────┬──────────────────────┘
     |
     | Entity states & attributes
     v
┌─────────────────────────┐
│  4. Render template     │
│  templateEngine.ts      │
│  Handlebars.compile()   │
└────┬────────────────────┘
     |
     | Rendered HTML with data
     v
┌─────────────────────────┐
│  5. Store in cache      │
│  renderedCache.set()    │
└────┬────────────────────┘
     |
     | Success response
     v
User receives:
{"success": true, "template": "dashboard.html", "entities_fetched": 3}

---

Later request:
      |
      | GET /image?template=dashboard.html&format=bmp
      v
┌──────────────────┐
│  imageHandler.ts │
│  - Validate      │
│  - Check params  │
└────────┬─────────┘
         |
         | template param provided
         v
┌──────────────────┐
│  renderedCache   │
│  .get("ha:...")  │
│  Returns HTML    │
└────────┬─────────┘
         |
         | HTML string (if miss, optionally auto-render)
         v
┌──────────────────┐
│  Puppeteer       │
│  setContent(html)│
│  → Screenshot    │
└────────┬─────────┘
         |
         v
┌──────────────────┐
│  BMP conversion  │
│  Chunking        │
└────────┬─────────┘
         |
         | Binary image data
         v
User receives BMP chunk
```

---

## Advantages

1. **Template ownership** - Full control over HTML/CSS without HA constraints
2. **Clean separation** - Templates managed independently from HA configuration
3. **Powerful templating** - Handlebars provides loops, conditionals, helpers
4. **Minimal HA changes** - No HA templates needed, just fetch entity states
5. **Fast rendering** - Cached HTML with configurable TTL reduces HA load
6. **Parallel fetching** - Multiple entities fetched simultaneously from HA
7. **Easy editing** - Edit HTML files directly, no server restart needed
8. **Version control** - Templates can be version controlled (git)
9. **Consistent patterns** - Same validation, error handling as existing code
10. **Only one dependency** - Just Handlebars.js added
11. **Clean integration** - Simple `template` parameter, no special protocols needed
12. **Direct HTML rendering** - Uses `page.setContent()` instead of data URLs (simpler, no encoding needed)
13. **Flexible** - Either pre-render with `/ha/render` or auto-render on `/image` request
14. **Testable** - Easy to mock templates, HA API, and test in isolation
15. **Works with existing features** - Compatible with offset/limit chunking
16. **Future-proof** - Easy to add template management API, webhooks, etc.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Handlebars template syntax errors | Medium | Try/catch during rendering, return 500 with line numbers and error details |
| Entity extraction complexity | Medium | Start with simple regex for `{{entities.XXX}}`, improve parser iteratively |
| Missing entities in HA | Medium | Configurable behavior: fail fast or continue with null values |
| Cache invalidation when entities update | High | TTL-based caching, document refresh patterns, consider webhooks in Phase 3 |
| Memory usage with large cache | Medium | LRU eviction with max 50 templates, monitor via `/ha/status` endpoint |
| Template file management | Low | Simple file-based system for MVP, add management API in Phase 3 |
| Entity fetching performance | Medium | Parallel requests to HA, timeout handling, document < 800ms target |
| Token management in addon | Low | Validate at startup with helpful errors, clear documentation |

---

## Open Questions

None - all design decisions made based on user requirements and codebase analysis.

**Key Decision Points**:
- ✅ Templates stored on server (not in HA)
- ✅ Handlebars for template engine
- ✅ Fetch entity states + attributes from HA
- ✅ Cache rendered HTML (not raw templates)
- ✅ Simple file-based template storage
- ✅ `template` parameter instead of special URL protocol
- ✅ Direct HTML rendering with `page.setContent()` instead of data URLs
