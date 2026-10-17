import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const { default: app } = await import("./index.js");
const recommendationHistory = [];
let nextRecommendationId = 0;
app.locals.recommendationStore = {
  async save(response) {
    const record = {
      id: `test-${++nextRecommendationId}`,
      createdAt: new Date().toISOString(),
      ...response,
    };
    recommendationHistory.unshift(record);
    return { id: record.id, createdAt: record.createdAt };
  },
  async listRecent(limit = 50) {
    return recommendationHistory.slice(0, limit);
  },
};

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("health route reports that the API is ready", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "ethio-crop-advisor-api",
    apiVersion: 1,
  });
});

test("crops route returns the available crops", async () => {
  const response = await fetch(`${baseUrl}/api/crops`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    crops: ["Maize", "Teff", "Wheat", "Barley", "Sorghum", "Chickpea", "Faba bean"],
  });
});

test("recommendations are saved and can be retrieved", async () => {
  const response = await fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      soilType: "Nitisol",
      previousCrop: "Maize",
      currentCrop: "Teff",
      farmSize: "2 hectares",
      irrigation: "no",
      priority: "water",
      location: "Bishoftu",
    }),
  });

  assert.equal(response.status, 201);
  const savedRecommendation = await response.json();
  assert.match(savedRecommendation.id, /^test-/);
  assert.ok(savedRecommendation.createdAt);

  const historyResponse = await fetch(`${baseUrl}/api/recommendations`);
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.equal(history.recommendations[0].id, savedRecommendation.id);
  assert.deepEqual(history.recommendations[0].context, savedRecommendation.context);
  assert.deepEqual(history.recommendations[0].recommendations, savedRecommendation.recommendations);
});

test("recommendations validate inputs and avoid repeating recent crops first", async () => {
  const response = await fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      soilType: "Nitisol",
      previousCrop: "Maize",
      currentCrop: "Teff",
      farmSize: "2 hectares",
      irrigation: "no",
      priority: "water",
      location: " Bishoftu, Oromia ",
    }),
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.context.location, "Bishoftu, Oromia");
  assert.equal(result.environmentalDataUsed, false);
  assert.equal(result.scoring.validated, false);
  assert.equal(result.recommendations.length, 3);
  assert.ok(result.recommendations.every(({ crops: sequence }) => (
    sequence.length === 3
    && new Set(sequence).size === sequence.length
    && sequence[0] !== "Maize"
    && sequence[0] !== "Teff"
  )));
  assert.ok(result.recommendations.every(({ score }) => score >= 0 && score <= 100));
});

test("water priority and irrigation status affect the transparent demo score", async () => {
  const payload = {
    soilType: "Nitisol",
    previousCrop: "Maize",
    currentCrop: "Teff",
    farmSize: "2 hectares",
    priority: "water",
    location: "Bishoftu",
  };
  const request = (irrigation) => fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, irrigation }),
  });

  const withoutIrrigation = await (await request("no")).json();
  const withIrrigation = await (await request("yes")).json();
  assert.notDeepEqual(
    withoutIrrigation.recommendations.map(({ score }) => score),
    withIrrigation.recommendations.map(({ score }) => score),
  );
});

test("selected priority changes the ranked rotations", async () => {
  const payload = {
    soilType: "Nitisol",
    previousCrop: "Maize",
    currentCrop: "Teff",
    farmSize: "2 hectares",
    irrigation: "unknown",
    location: "Bishoftu",
  };
  const request = (priority) => fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, priority }),
  });

  const soilHealth = await (await request("soilHealth")).json();
  const water = await (await request("water")).json();
  assert.notEqual(
    soilHealth.recommendations[0].crops.join(","),
    water.recommendations[0].crops.join(","),
  );
});

test("invalid form values return the invalid field names", async () => {
  const response = await fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority: "unknown" }),
  });

  assert.equal(response.status, 400);
  const result = await response.json();
  assert.equal(result.error, "Invalid or missing form values.");
  assert.ok(result.fields.includes("irrigation"));
  assert.ok(result.fields.includes("location"));
});

test("provider failures return an explicit availability error instead of demo values", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => (
    String(url).startsWith("https://power.larc.nasa.gov/")
      ? Promise.reject(new Error("Test provider unavailable"))
      : originalFetch(url, options)
  );
  try {
    const response = await fetch(`${baseUrl}/api/farm-conditions?location=Bishoftu&latitude=8.75&longitude=38.98`);
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /could not be retrieved/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("location search only returns in-country geocoding results", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://geocoding-api.open-meteo.com/")) {
      return originalFetch(url, options);
    }
    assert.match(String(url), /countryCode=ET/);
    return new Response(JSON.stringify({
      results: [
        { name: "Bishoftu", admin1: "Oromia", country_code: "ET", latitude: 8.75, longitude: 38.98 },
        { name: "Bishoftu", admin1: "Outside Ethiopia", country_code: "XX", latitude: 8.75, longitude: 38.98 },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await fetch(`${baseUrl}/api/locations?query=Bishoftu`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].name, "Bishoftu");
    assert.equal(result.results[0].country, "Ethiopia");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("location search retries the place name when an administrative qualifier does not match", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://geocoding-api.open-meteo.com/")) {
      return originalFetch(url, options);
    }
    callCount += 1;
    const name = new URL(String(url)).searchParams.get("name");
    const results = name === "Bishoftu"
      ? [{ name: "Bishoftu", admin1: "Oromiya", country_code: "ET", latitude: 8.75225, longitude: 38.97846 }]
      : [];
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const response = await fetch(`${baseUrl}/api/locations?query=Bishoftu%2C%20Oromia`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(callCount, 2);
    assert.equal(result.results[0].name, "Bishoftu");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NASA POWER observations are aggregated with source, period, units, and spatial caveat", async () => {
  const originalFetch = globalThis.fetch;
  const days = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [
    `202609${String(index + 1).padStart(2, "0")}`,
    index === 0 ? -999 : 5,
  ]));
  const temperature = Object.fromEntries(Object.keys(days).map((day) => [day, 20]));
  const humidity = Object.fromEntries(Object.keys(days).map((day) => [day, 60]));
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://power.larc.nasa.gov/")) {
      return originalFetch(url, options);
    }
    assert.match(String(url), /PRECTOTCORR%2CT2M%2CRH2M|PRECTOTCORR,T2M,RH2M/);
    return new Response(JSON.stringify({
      properties: {
        parameter: {
          PRECTOTCORR: days,
          T2M: temperature,
          RH2M: humidity,
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await fetch(`${baseUrl}/api/farm-conditions?location=Bishoftu&latitude=8.75&longitude=38.98`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.location, "Bishoftu");
    assert.equal(result.rainfall.value, 145);
    assert.equal(result.rainfall.unit, "mm");
    assert.equal(result.temperature.value, 20);
    assert.equal(result.humidity.value, 60);
    assert.equal(result.source, "NASA POWER");
    assert.equal(result.isSample, false);
    assert.equal(result.validDays, 29);
    assert.equal(result.spatialResolution, "Approximately 0.5° grid; not a farm-level measurement");
    assert.match(result.period.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(result.retrievedAt)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("conditions reject coordinates outside Ethiopia without calling providers", async () => {
  const response = await fetch(`${baseUrl}/api/farm-conditions?location=London&latitude=51.5&longitude=-0.12`);
  assert.equal(response.status, 400);
});

test("malformed JSON and unknown API paths return explicit errors", async () => {
  const malformed = await fetch(`${baseUrl}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, "Request body must be valid JSON.");

  const missingRoute = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(missingRoute.status, 404);
});
