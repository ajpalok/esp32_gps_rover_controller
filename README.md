# Web UI — GPS-guided Semi-Autonomous Rover

This repository contains the static web UI used by the rover. The UI provides:
- A main dashboard with map (Leaflet + OpenStreetMap) used for waypoint editing and autonomous control.
- A separate Manual Control page for direct (gamepad/keyboard/touch) control.

## Files
- `index.html` — Main dashboard (map, waypoints, autonomous controls, status, settings modal).
- `manual.html` — Dedicated manual control page (gamepad layout, speed slider, keyboard shortcuts).
- `style.css` — Styling used by the main and manual pages.
- `script.js` — Client logic for the main dashboard (map, waypoint management, autonomous commands, status updates).
- `manual.js` — Client logic for manual control (hold-to-move buttons, keyboard controls with preventDefault for arrow keys, speed slider).
- `README.md` — This file.

> Note: These static files are served by the ESP32 web server in the sketch (they are embedded in `GPS_guided_semi_autonomous_rover.ino` as PROGMEM strings). You can also run them locally for development/testing.

---

## Local development / quick test
If you want to open the pages in a desktop browser for UI work (no rover connected), use a simple static server.

From the `web/` folder run (bash / Windows Subsystem for Linux or Git Bash is fine):

```bash
# serve on port 5500 (or any free port)
python -m http.server 5500 --bind 127.0.0.1
```

Then open:
- Main dashboard: http://127.0.0.1:5500/index.html
- Manual control page: http://127.0.0.1:5500/manual.html

Notes:
- The dashboard fetches the rover API at `http://<rover-ip>/api/...`. When running locally, set the Rover IP in the Settings modal or store it in localStorage.
- The UI depends on the Leaflet CDN (tile layer and JS). Ensure your dev machine has internet access.

---

## API endpoints used by the UI (served by the ESP32 sketch)
The sketch provides these endpoints (HTTP):

- `GET  /api/status` — JSON containing GPS (lat/lon), heading, speed, satellites, gpsValid, autonomousMode, currentWaypoint, totalWaypoints, distanceToTarget, etc.
- `POST /api/control` — Form-encoded control command body `command=<forward|backward|left|right|stop>&speed=<0-255>` for manual driving (used by `manual.js`).
- `POST /api/waypoints` — JSON array of {lat, lon} for waypoints (used by `script.js`).
- `POST /api/start` — Start autonomous mission.
- `POST /api/stop` — Stop autonomous mission.
- `GET  /manual.html` — Manual control page served from PROGMEM (or static file when testing locally).
- `GET  /manual.js` and `/script.js` and `/style.css` — Static assets.

(Exact JSON fields and control parameter names are implemented in the sketch. Check `webserver.h` and `GPS_guided_semi_autonomous_rover.ino` for full schema.)

---

## UX notes / keyboard behavior
- When using the Manual Control page, the arrow keys and WASD are captured for rover control and the default page scroll is prevented (the code calls `e.preventDefault()` while those keys are active). This preserves normal page scrolling when not actively controlling the rover.
- The spacebar is used as a Stop command and also prevents default scrolling.

---

## Troubleshooting
- Map tiles not showing / map not loading:
  - Ensure the browser can access `https://{s}.tile.openstreetmap.org/...` (internet access required for tiles).
  - If using local files served from `file://` (double-clicking the HTML), many browsers block cross-origin requests and Leaflet tiles may fail — use a local HTTP server instead (see Local development above).
  - If the rover is on a different host, update the Rover IP in the Settings modal (top-right) so `script.js` can reach `http://<rover-ip>/api/status`.

- `Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')`:
  - This was caused by the main `script.js` attempting to attach listeners to manual control elements that don't exist on the main dashboard. The repository now separates manual control into `manual.html` and `manual.js`; `script.js` no longer references those elements.

---

## Embedding / deploying to the ESP32
Two common approaches:

1. Embedded in sketch (current approach)
   - The project currently embeds minified HTML/CSS/JS into `GPS_guided_semi_autonomous_rover.ino` as `PROGMEM` string constants (see `HTML_CONTENT`, `CSS_CONTENT`, `JS_CONTENT`, `MANUAL_HTML_CONTENT`, `MANUAL_JS_CONTENT`).
   - To update these files you can edit the files in `web/`, then copy/minify and paste into the sketch constants (or write a small script to convert files to PROGMEM strings). Keep them reasonably minified to fit flash/ram.

2. LittleFS / SPIFFS
   - Alternatively, store `index.html`, `manual.html`, `script.js`, `manual.js`, `style.css` on the ESP32 filesystem (LittleFS). This makes iteration simpler — upload web files with the filesystem uploader in PlatformIO or Arduino tools.

If you want, I can add a small script to convert the `web/` files into PROGMEM string literals and update the sketch automatically — tell me which workflow you prefer.

---
