# E-Ink Renderer — Home Assistant Addon

## Installation

### Adding the repository

1. Open your Home Assistant instance
2. Navigate to **Settings → Add-ons → Add-on Store**
3. Click the **⋮** menu (top-right) and select **Repositories**
4. Paste the repository URL:
   ```
   https://github.com/riston/eink-assist-screen
   ```
5. Click **Add** and then **Close**
6. The **E-Ink Renderer** addon should now appear in the store — click it and then click **Install**

### Configuration

After installation, go to the addon's **Configuration** tab and set the following options:

| Option               | Description                                                                                                                                     | Default                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `access_token`       | A long-lived Home Assistant access token. Create one at **Profile → Long-Lived Access Tokens**. Leave empty if using Supervisor-injected token. | `""`                        |
| `home_assistant_url` | URL of your Home Assistant instance. When running as an addon this is usually the internal Docker hostname.                                     | `http://homeassistant:8123` |
| `cache_ttl_default`  | Default cache time-to-live in seconds for Home Assistant API responses.                                                                         | `300`                       |
| `cache_max_size`     | Maximum number of cached API responses.                                                                                                         | `50`                        |
| `active_template`    | The HTML template file to render (must exist in `/data/templates/`).                                                                            | `dashboard-full.html`       |

### Starting the addon

1. Go to the **Info** tab and click **Start**
2. Check the **Log** tab to verify it started successfully
3. The renderer API will be available at `http://<your-ha-ip>:8000`

## Usage

### API Endpoints

- `GET /config` — Returns the current configuration as JSON
- `GET /render` — Renders the active template and returns the image
- `GET /templates` — Lists available templates

### Custom templates

Templates are stored in `/data/templates/` inside the addon container. On first start, the built-in default templates are copied there. You can customize them by editing the files directly (accessible via the Samba or SSH addons) or by mounting the `/data/` directory.

### Browserless integration

This addon does **not** include a built-in browser. It connects to a remote browser via WebSocket using the `BROWSER_WS_ENDPOINT` environment variable. You can run [browserless](https://www.browserless.io/) as a separate container or addon alongside the renderer.

## Local Development Setup

You can run the renderer as a Docker addon locally without a full Home Assistant installation. This is useful for developing templates and testing the API.

### Prerequisites

- Docker installed on your machine
- A Home Assistant instance accessible from your machine (for API calls)
- A long-lived access token from Home Assistant (**Profile → Long-Lived Access Tokens**)

### 1. Build the image

```bash
docker build -t eink-renderer .
```

### 2. Run with Docker

```bash
docker run -p 8000:8000 \
  -e HA_ACCESS_TOKEN=<your-token> \
  -e HA_URL=http://host.docker.internal:8123 \
  -e BROWSER_WS_ENDPOINT=ws://host.docker.internal:3000 \
  eink-renderer
```

> `host.docker.internal` resolves to your host machine from inside the container (works on Docker Desktop for macOS/Windows). On Linux, use `--network host` or the actual IP of the host.

### 3. Run with Docker Compose

Create a `docker-compose.yml` alongside the Dockerfile:

```yaml
services:
  renderer:
    build: .
    ports:
      - "8000:8000"
    environment:
      - HA_ACCESS_TOKEN=<your-token>
      - HA_URL=http://host.docker.internal:8123
      - BROWSER_WS_ENDPOINT=ws://browserless:3000
    volumes:
      - renderer-data:/data

  browserless:
    image: browserless/chrome
    ports:
      - "3000:3000"

volumes:
  renderer-data:
```

Then start both services:

```bash
docker compose up --build
```

### 4. Verify

```bash
# Check the renderer is running
curl http://localhost:8000/config

# List available templates
curl http://localhost:8000/templates
```

### Environment variables reference

| Variable              | Description                                        | Default                     |
| --------------------- | -------------------------------------------------- | --------------------------- |
| `HA_ACCESS_TOKEN`     | Home Assistant long-lived access token             | —                           |
| `HA_URL`              | Home Assistant URL                                 | `http://homeassistant:8123` |
| `BROWSER_WS_ENDPOINT` | WebSocket URL for the remote browser (browserless) | `""`                        |
| `BASE_HOST`           | Host the server binds to                           | `0.0.0.0`                   |
| `BASE_PORT`           | Port the server listens on                         | `8000`                      |
| `TEMPLATES_DIR`       | Path to the templates directory                    | `/data/templates`           |
| `ACTIVE_TEMPLATE`     | Default template to render                         | `dashboard-full.html`       |

### Tips

- Mount a local `templates/` directory for live editing: `-v ./templates:/data/templates`
- The `/data/` directory is seeded with defaults on first run. Delete the volume (`docker volume rm renderer-data`) to re-seed from built-in defaults.
- Logs are written to stdout — use `docker logs -f <container>` to follow them.

## Troubleshooting

- **Addon won't start** — Check the Log tab. The most common cause is a missing `access_token`. Either set one manually or ensure `homeassistant_api: true` is active so the Supervisor injects `HASSIO_TOKEN` automatically.
- **Cannot connect to Home Assistant** — Verify that `home_assistant_url` is correct. When running as an addon, the default `http://homeassistant:8123` should work without changes.
- **Template not found** — Make sure the file specified in `active_template` exists in `/data/templates/`. Run `GET /templates` to list available templates.
