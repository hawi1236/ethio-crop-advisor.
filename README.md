# EthioCrop Advisor

EthioCrop Advisor is an early-stage crop-planning prototype for exploring example crop rotations in Ethiopia. Its rotation options are illustrative and not agronomic advice; its weather values are retrieved from NASA POWER and are gridded regional estimates, not direct farm measurements or soil/crop satellite observations. The app makes no yield or income forecasts.

## Requirements

- Node.js 22.13+ or 24+ (required by the built-in SQLite module and current Vite version)
- npm

## Run locally on Windows

Open two terminals in the project folder, `C:\Users\h\Desktop\ethio-crop-advisor`.

Install dependencies once:

```powershell
npm.cmd install
```

Terminal 1 — start the API:

```powershell
npm.cmd run dev:server
```

The API uses port `3002` by default to avoid colliding with older local servers. If needed, set `PORT` before starting the backend. To point Vite at a different API address, set `VITE_API_PROXY_TARGET` before starting the frontend (for example, `$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:3002"`).
The backend creates a local SQLite database at `server/data/ethio-crop-advisor.sqlite` and saves recommendation requests and results. The database is created automatically on first startup and is excluded from version control. Set `DATABASE_PATH` before starting the API to use a different database file.

Terminal 2 — start the website:

```powershell
npm.cmd run dev
```

Open the frontend URL printed by Vite (usually `http://localhost:5173`). Keep both terminals open while using the prototype. If either server was already running before these changes, stop both with `Ctrl+C` and restart them so Vite loads the updated API proxy. Use the newly printed frontend URL.

## Deploy to Render

This project includes a Render Blueprint in `render.yaml`. Push the project to GitHub, then in Render choose **New → Blueprint**, connect the repository, and apply the blueprint. It builds the Vite frontend and serves it with the Express API as one web service. The blueprint sets `DATABASE_PATH` to `/var/data/ethio-crop-advisor.sqlite` and attaches a persistent disk so recommendation history survives deploys. Render persistent disks require a paid web service; review Render's current pricing before applying the blueprint. The SQLite history is for this single service and is not shared between multiple running instances.

## Checks

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Current capabilities and limits

- English and Amharic user interface.
- Farm location can be typed and searched, or picked by clicking a map pin.
- Soil, recent crops, farm size, irrigation availability, and planning-priority inputs.
- Express API validates planner inputs and returns deterministic, input-sensitive example rotations.
- SQLite stores recommendation history, available from `GET /api/recommendations` (latest 50 entries).
- Location search resolves Ethiopian place names with Open-Meteo geocoding.
- Environmental dashboard retrieves recent daily precipitation, temperature, and humidity from NASA POWER for the selected coordinates. A separate Open-Meteo API route provides current conditions and a seven-day forecast.
- Data source, units, period, retrieval time, coordinates, grid resolution, and limitations are displayed for the NASA POWER dashboard.
- Recommendation scoring is a prototype rule-match rubric; soil type and farm size are recorded but not used to rank results pending locally reviewed evidence.
- Crop rotation rules have not been locally validated; weather data does not yet affect the recommendation ranking.
- NASA POWER grid data is not farm-level soil moisture or vegetation health; SMAP and MODIS products are not integrated.
- Map clicks use a bounded approximate Ethiopia view, not a surveyed farm boundary. Check the pin and coordinates.

See [BACKEND_NOTES.md](./BACKEND_NOTES.md) for API request/response details and remaining production work.
