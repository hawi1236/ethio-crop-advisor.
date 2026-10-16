# EthioCrop Advisor API

The prototype uses Express in `server/index.js`; during development, Vite proxies `/api` calls to port 3002 by default. Set `PORT` to change the API port and `VITE_API_PROXY_TARGET` to point Vite at a different API address. The health response includes a service name and API version so an outdated server can be identified.

## Run locally

From the project root, use two terminals:

```powershell
npm.cmd run dev:server
```

```powershell
npm.cmd run dev
```

The API listens on `http://localhost:3002`. Check `GET /api/health`.
The first server start creates `server/data/ethio-crop-advisor.sqlite` automatically using Node.js's built-in SQLite module. Recommendation requests and results are stored in the `recommendation_history` table. Use `GET /api/recommendations` to retrieve the latest 50 saved results. Set `DATABASE_PATH` before starting the server to choose another SQLite file. This prototype does not have accounts or access controls; do not expose recommendation history publicly.

## `GET /api/locations?query=Bishoftu`

Searches Open-Meteo's geocoding service, restricted to results within Ethiopia, and returns selectable place names with coordinates. Search text must contain 2–100 characters; if a place plus administrative-area qualifier has no match, it retries the place name without the qualifier. Results are cached in memory for 10 minutes. Open-Meteo attribution and service terms should be retained if this pilot is deployed publicly.

The frontend also allows direct selection of a pin in an approximate Ethiopia map view. Map-picked coordinates go to the same farm-conditions endpoint; the UI asks users to confirm that the pin lies within Ethiopia. The current backend coordinate validation uses a broad Ethiopia bounding box, not an authoritative national boundary polygon.

## `GET /api/farm-conditions?location=Bishoftu%2C%20Oromia&latitude=8.75&longitude=38.98`

Validates the coordinates against an approximate Ethiopia bounding box and retrieves the recent 30-day daily series for `PRECTOTCORR`, `T2M`, and `RH2M` from NASA POWER Daily API. The date window ends five days before the request to allow for product latency. The API returns total precipitation in mm, mean air temperature at 2 m in °C, mean relative humidity at 2 m in %, valid observation count, period, retrieval time, coordinates, source link, and grid-resolution caveat. At least 20 valid days are required. Results are cached in memory for one hour.

The data is gridded NASA POWER meteorological data (GEOSIT/POWER), roughly 0.5° resolution, not a farm-level sensor measurement. The dashboard does not currently retrieve SMAP soil moisture, MODIS vegetation indices, or crop-health data. The upstream public API can be temporarily unavailable; the backend reports this rather than presenting fabricated fallback values.

## `POST /api/recommend`

Required JSON fields:

```json
{
  "soilType": "Nitisol",
  "previousCrop": "Maize",
  "currentCrop": "Teff",
  "farmSize": "2 hectares",
  "irrigation": "unknown",
  "priority": "soilHealth",
  "location": "Bishoftu, Oromia"
}
```

The endpoint validates each field against the planner's allowed values, trims and bounds the location, excludes candidate rotations that start with either recent crop, applies an explicit deterministic demo rubric, and returns at most three options. Invalid fields return HTTP 400 with an `error` and `fields` array. Malformed JSON returns HTTP 400; oversized JSON is capped at 16 KB.

Successful responses contain:

- `recommendations`: crop names, relative prototype match score, reason and label translation keys, and `evidenceStatus`.
- `context`: normalized form values used in the request.
- `scoring`: rubric meaning, weights, and `validated: false`.
- `environmentalDataUsed: false`.
- `limitations`: what the demo does not establish.

Scores are not probabilities, yield forecasts, or estimates of income or soil improvement. Candidate rotations and their water/crop-group traits need review by Ethiopian agricultural experts before being used for advice. Soil type and farm size are recorded but not yet used to affect ranking because no locally reviewed rule set exists.

## `GET /api/weather?location=Bishoftu&latitude=8.75&longitude=38.98`

Validates the coordinates against the approximate Ethiopia bounding box and retrieves current conditions plus a 7-day forecast from the Open-Meteo Forecast API (`https://api.open-meteo.com/v1/forecast`). Current fields are temperature at 2 m (°C), relative humidity at 2 m (%), wind speed at 10 m (km/h), and precipitation (mm). The daily series returns max/min temperature and precipitation sum. Results are cached in memory for 10 minutes.

The response includes `current` (modelled observation, flagged `isObservation: true`), `forecast` (daily entries flagged `isForecast: true`), the 7-day precipitation total, source, product, spatial-resolution caveat, retrieval time, coordinates, source link, and Open-Meteo attribution. Current values and the daily series are clearly distinguished: observations are not forecasts and forecasts are not observations.

Weather data is shown for context and does not affect crop-rotation ranking. No scientifically validated agronomic method connects this data to soil moisture, crop health, yield, or the best crop to plant.

## Tests and future work

Run API tests with `npm.cmd test`. The source integrations are an initial pilot, not a production-grade agricultural service. Before using this for decisions, review source suitability, spatial/temporal uncertainty, local agronomy, seasonal rainfall products, and extension-agronomist workflows. Environmental metrics are not currently used to rank crop rotations. No scientifically validated agronomic method is connected.
