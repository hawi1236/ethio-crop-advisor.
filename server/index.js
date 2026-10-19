import express from "express";
import { existsSync } from "node:fs";
import process from "node:process";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { closeDatabase, connectDatabase, recommendationStore } from "./database.js";

const app = express();
const port = Number(process.env.PORT) || 3002;
const clientDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const geocodingCache = new Map();
const conditionsCache = new Map();
const weatherCache = new Map();
const PROVIDER_TIMEOUT_MS = 15000;
const ETHIOPIA_BOUNDS = { minLatitude: 3.3, maxLatitude: 15.0, minLongitude: 32.9, maxLongitude: 48.0 };

export const soilTypes = ["Nitisol", "Vertisol", "Cambisol", "Luvisol"];
export const crops = ["Maize", "Teff", "Wheat", "Barley", "Sorghum", "Chickpea", "Faba bean"];
export const farmSizes = ["0.5 hectare", "1 hectare", "2 hectares", "5 hectares", "10 hectares", "20+ hectares"];
export const priorities = ["soilHealth", "water", "income", "food"];
export const irrigationOptions = ["yes", "no", "unknown"];

const cropTraits = {
  Maize: { group: "cereal", waterNeed: "high" },
  Teff: { group: "cereal", waterNeed: "medium" },
  Wheat: { group: "cereal", waterNeed: "medium" },
  Barley: { group: "cereal", waterNeed: "low" },
  Sorghum: { group: "cereal", waterNeed: "low" },
  Chickpea: { group: "legume", waterNeed: "low" },
  "Faba bean": { group: "legume", waterNeed: "medium" },
};

const rotationCandidates = [
  { crops: ["Teff", "Faba bean", "Wheat"], reasonKey: "reason1" },
  { crops: ["Maize", "Faba bean", "Teff"], reasonKey: "reason2" },
  { crops: ["Wheat", "Chickpea", "Teff"], reasonKey: "reason3" },
  { crops: ["Barley", "Faba bean", "Wheat"], reasonKey: "reason1" },
  { crops: ["Sorghum", "Chickpea", "Teff"], reasonKey: "reason3" },
  { crops: ["Faba bean", "Wheat", "Chickpea"], reasonKey: "reason2" },
  { crops: ["Wheat", "Faba bean", "Barley"], reasonKey: "reason1" },
  { crops: ["Maize", "Chickpea", "Sorghum"], reasonKey: "reason3" },
];

app.use(express.json({ limit: "16kb" }));
app.locals.recommendationStore = recommendationStore;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ethio-crop-advisor-api", apiVersion: 1 });
});

app.get("/api/crops", (_req, res) => {
  res.json({ crops });
});

app.get("/api/recommendations", async (_req, res) => {
  try {
    const recommendations = await app.locals.recommendationStore.listRecent();
    return res.json({ recommendations });
  } catch (error) {
    console.error("Could not read recommendation history:", error);
    return res.status(500).json({ error: "Recommendation history could not be loaded." });
  }
});

app.get("/api/locations", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: "Search for a location using 2 to 100 characters." });
  }

  try {
    const cacheKey = query.toLocaleLowerCase();
    const results = await getCached(geocodingCache, cacheKey, 10 * 60 * 1000, async () => {
      const search = async (name) => {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.search = new URLSearchParams({
          name,
          count: "8",
          language: "en",
          format: "json",
          countryCode: "ET",
        });
        return fetchJson(url, "Location search");
      };
      let data = await search(query);
      if ((!Array.isArray(data.results) || data.results.length === 0) && query.includes(",")) {
        data = await search(query.slice(0, query.indexOf(",")).trim());
      }
      return (Array.isArray(data.results) ? data.results : [])
        .filter((place) => (
          place.country_code === "ET"
          && Number.isFinite(place.latitude)
          && Number.isFinite(place.longitude)
          && isInEthiopia(place.latitude, place.longitude)
        ))
        .map((place) => ({
          id: `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`,
          name: place.name,
          admin1: place.admin1 ?? null,
          latitude: place.latitude,
          longitude: place.longitude,
          country: "Ethiopia",
        }));
    });

    return res.json({ results });
  } catch (error) {
    return sendProviderError(res, error);
  }
});

app.post("/api/recommend", async (req, res) => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const { soilType, previousCrop, currentCrop, farmSize, priority, irrigation } = body;
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const invalidFields = [];

  if (!soilTypes.includes(soilType)) invalidFields.push("soilType");
  if (!crops.includes(previousCrop)) invalidFields.push("previousCrop");
  if (!crops.includes(currentCrop)) invalidFields.push("currentCrop");
  if (!farmSizes.includes(farmSize)) invalidFields.push("farmSize");
  if (!priorities.includes(priority)) invalidFields.push("priority");
  if (!irrigationOptions.includes(irrigation)) invalidFields.push("irrigation");
  if (!location || location.length > 200) invalidFields.push("location");

  if (invalidFields.length > 0) {
    return res.status(400).json({
      error: "Invalid or missing form values.",
      fields: invalidFields,
    });
  }

  const validCandidates = rotationCandidates.filter(({ crops: sequence }) => (
    sequence.length === 3
    && new Set(sequence).size === sequence.length
    && sequence.every((crop) => crops.includes(crop))
    && sequence[0] !== currentCrop
    && sequence[0] !== previousCrop
  ));

  const scoredCandidates = validCandidates.map((candidate) => ({
    ...candidate,
    score: scoreRotation(candidate.crops, priority, irrigation),
  }));

  const results = scoredCandidates
    .sort((a, b) => b.score - a.score || a.crops.join(",").localeCompare(b.crops.join(",")))
    .slice(0, 3)
    .map(({ crops: sequence, score, reasonKey }, index) => ({
      crops: sequence,
      score,
      reasonKey,
      labelKey: index === 0 ? "bestFit" : index === 1 ? "balanced" : "waterSaving",
      evidenceStatus: "needs-local-validation",
    }));

  const responseBody = {
    recommendations: results,
    context: { soilType, previousCrop, currentCrop, farmSize, irrigation, priority, location },
    scoring: {
      type: "prototype-rule-match",
      meaning: "A relative match to the prototype's stated priorities, not a probability or a yield, income, or soil-health forecast.",
      baseScore: 50,
      weights: {
        legume: priority === "soilHealth" ? 12 : priority === "food" ? 8 : 5,
        waterEfficient: priority === "water" ? 10 : 0,
        mediumWaterNeedWithoutIrrigation: priority === "water" && irrigation !== "yes" ? -4 : 0,
        highWaterNeedWithoutIrrigation: priority === "water" && irrigation !== "yes" ? -8 : 0,
        cropGroupDiversity: priority === "soilHealth" ? 5 : 3,
      },
      validated: false,
    },
    environmentalDataUsed: false,
    limitations: [
      "Environmental values are not used to rank rotations.",
      "The crop rules and scores are illustrative and require review by local agricultural experts.",
      "Soil type and farm size are recorded but do not affect ranking until supported by reviewed local evidence.",
    ],
  };

  try {
    const record = await app.locals.recommendationStore.save(responseBody);
    return res.status(201).json({ ...record, ...responseBody });
  } catch (error) {
    console.error("Could not save recommendation:", error);
    return res.status(500).json({ error: "Recommendation could not be saved. Please try again." });
  }
});

app.get("/api/farm-conditions", async (req, res) => {
  const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (!location || location.length > 200 || !isInEthiopia(latitude, longitude)) {
    return res.status(400).json({ error: "Select a valid Ethiopian location before requesting environmental data." });
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  try {
    const conditions = await getCached(conditionsCache, cacheKey, 60 * 60 * 1000, () => fetchPowerConditions(latitude, longitude));
    return res.json({ ...conditions, location, coordinates: { latitude, longitude } });
  } catch (error) {
    return sendProviderError(res, error);
  }
});

app.get("/api/weather", async (req, res) => {
  const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (!location || location.length > 200 || !isInEthiopia(latitude, longitude)) {
    return res.status(400).json({ error: "Select a valid Ethiopian location before requesting weather data." });
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  try {
    const weather = await getCached(weatherCache, cacheKey, 10 * 60 * 1000, () => fetchOpenMeteoWeather(latitude, longitude));
    return res.json({ ...weather, location, coordinates: { latitude, longitude } });
  } catch (error) {
    return sendProviderError(res, error);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/.*/, (req, res, next) => {
    if (extname(req.path)) return next();
    res.sendFile(resolve(clientDistPath, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error(`API error at ${req.path}:`, error);
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: "Internal server error." });
});

class ProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderError";
  }
}

function isInEthiopia(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= ETHIOPIA_BOUNDS.minLatitude
    && latitude <= ETHIOPIA_BOUNDS.maxLatitude
    && longitude >= ETHIOPIA_BOUNDS.minLongitude
    && longitude <= ETHIOPIA_BOUNDS.maxLongitude;
}

function sendProviderError(res, error) {
  if (error instanceof ProviderError) {
    return res.status(503).json({ error: error.message });
  }
  console.error("Environmental-data provider error:", error);
  return res.status(502).json({ error: "Environmental data could not be retrieved. Please try again shortly." });
}

async function fetchJson(url, providerName) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new ProviderError(`${providerName} took too long to respond. Please try again.`);
    }
    throw error;
  }
  if (!response.ok) {
    throw new ProviderError(`${providerName} is temporarily unavailable (HTTP ${response.status}). Please try again later.`);
  }
  return response.json();
}

async function getCached(cache, key, ttl, load) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);

  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  return value;
}

function dateString(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchPowerConditions(latitude, longitude) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 5);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const startDate = dateString(start);
  const endDate = dateString(end);
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.search = new URLSearchParams({
    parameters: "PRECTOTCORR,T2M,RH2M",
    community: "AG",
    longitude: String(longitude),
    latitude: String(latitude),
    start: startDate,
    end: endDate,
    format: "JSON",
    "time-standard": "UTC",
  });

  const data = await fetchJson(url, "NASA POWER");
  const values = data?.properties?.parameter;
  const precipitation = values?.PRECTOTCORR;
  const temperature = values?.T2M;
  const humidity = values?.RH2M;
  if (!precipitation || !temperature || !humidity) {
    throw new ProviderError("NASA POWER did not return all requested weather measurements for this location.");
  }

  const validDays = Object.keys(temperature).filter((day) => (
    isValidPowerValue(temperature[day])
    && isValidPowerValue(precipitation[day])
    && isValidPowerValue(humidity[day])
  ));
  if (validDays.length < 20) {
    throw new ProviderError("NASA POWER returned too few valid daily measurements for the selected period.");
  }

  const average = (series) => validDays.reduce((sum, day) => sum + series[day], 0) / validDays.length;
  const rainfallTotal = validDays.reduce((sum, day) => sum + precipitation[day], 0);
  return {
    rainfall: { value: round(rainfallTotal, 1), unit: "mm", days: validDays.length, label: "Total corrected precipitation" },
    temperature: { value: round(average(temperature), 1), unit: "°C", days: validDays.length, label: "Mean daily air temperature at 2 m" },
    humidity: { value: round(average(humidity), 1), unit: "%", days: validDays.length, label: "Mean relative humidity at 2 m" },
    source: "NASA POWER",
    product: "Daily meteorological point data (GEOSIT/POWER)",
    spatialResolution: "Approximately 0.5° grid; not a farm-level measurement",
    period: { start: `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`, end: `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}` },
    validDays: validDays.length,
    retrievedAt: new Date().toISOString(),
    isSample: false,
    limitations: "Gridded regional estimates are not direct measurements on an individual farm. NASA POWER does not provide soil moisture or crop health in this dashboard.",
    sourceUrl: "https://power.larc.nasa.gov/",
  };
}

async function fetchOpenMeteoWeather(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "auto",
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    forecast_days: "7",
  });

  const data = await fetchJson(url, "Open-Meteo");
  const current = data?.current;
  const daily = data?.daily;
  if (!current || !daily || !Array.isArray(daily.time) || daily.time.length === 0) {
    throw new ProviderError("Open-Meteo did not return current and forecast weather data for this location.");
  }

  const currentObservation = {
    temperature: Number(current.temperature_2m),
    humidity: Number(current.relative_humidity_2m),
    windSpeed: Number(current.wind_speed_10m),
    precipitation: Number(current.precipitation),
    time: typeof current.time === "string" ? current.time : null,
    isObservation: true,
  };

  if (!Number.isFinite(currentObservation.temperature)
    || !Number.isFinite(currentObservation.humidity)
    || !Number.isFinite(currentObservation.windSpeed)
    || !Number.isFinite(currentObservation.precipitation)) {
    throw new ProviderError("Open-Meteo returned incomplete current weather measurements.");
  }

  const forecast = daily.time.map((day, index) => ({
    date: day,
    temperatureMax: Number(daily.temperature_2m_max[index]),
    temperatureMin: Number(daily.temperature_2m_min[index]),
    precipitationSum: Number(daily.precipitation_sum[index]),
    isForecast: true,
  }));

  if (!forecast.every((entry) => (
    Number.isFinite(entry.temperatureMax)
    && Number.isFinite(entry.temperatureMin)
    && Number.isFinite(entry.precipitationSum)
  ))) {
    throw new ProviderError("Open-Meteo returned incomplete daily forecast data.");
  }

  const totalPrecipitation = forecast.reduce((sum, entry) => sum + entry.precipitationSum, 0);

  return {
    current: currentObservation,
    forecast,
    forecastDays: forecast.length,
    period: forecast.length > 0
      ? { start: forecast[0].date, end: forecast[forecast.length - 1].date }
      : null,
    precipitationTotal7Day: round(totalPrecipitation, 1),
    source: "Open-Meteo",
    product: "Current weather observation and 7-day forecast (ECMWF)",
    spatialResolution: "Approximately 11 km grid; not a farm-level measurement",
    retrievedAt: new Date().toISOString(),
    isSample: false,
    limitations: "Current values are modelled observations and the daily series is a forecast, not measured at your farm. Weather data alone does not determine soil moisture, crop health, yield, or the best crop to plant.",
    sourceUrl: "https://open-meteo.com/",
    attribution: "Weather data provided by Open-Meteo",
  };
}

function isValidPowerValue(value) {
  return Number.isFinite(value) && value !== -999;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function scoreRotation(sequence, priority, irrigation) {
  const traits = sequence.map((crop) => cropTraits[crop]);
  const legumeCount = traits.filter((trait) => trait.group === "legume").length;
  const lowWaterCount = traits.filter((trait) => trait.waterNeed === "low").length;
  const mediumWaterCount = traits.filter((trait) => trait.waterNeed === "medium").length;
  const highWaterCount = traits.filter((trait) => trait.waterNeed === "high").length;
  const groupCount = new Set(traits.map((trait) => trait.group)).size;

  let score = 50 + legumeCount * (priority === "soilHealth" ? 12 : priority === "food" ? 8 : 5);
  score += groupCount * (priority === "soilHealth" ? 5 : 3);
  if (priority === "water") {
    score += lowWaterCount * 10;
    if (irrigation !== "yes") {
      score -= mediumWaterCount * 4;
      score -= highWaterCount * 8;
    }
  }

  return Math.max(0, Math.min(100, score));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  connectDatabase().then(() => {
    const server = app.listen(port, () => {
      console.log(`EthioCrop API listening on http://localhost:${port}`);
    });

    const shutdown = () => {
      server.close((error) => {
        if (error) {
          console.error("Could not close API server:", error);
          process.exitCode = 1;
        }
        closeDatabase().catch((closeError) => {
          console.error("Could not close MongoDB connection:", closeError);
          process.exitCode = 1;
        });
      });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }).catch((error) => {
    console.error("Could not start API server:", error);
    process.exitCode = 1;
  });
}

export default app;
