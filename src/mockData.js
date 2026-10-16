// Legacy demo fixtures retained for reference; the React app reads from the API.
// Crop names are English; the UI translates them.

// Fixed illustrative values only. These are not measured at a farm location.
// GET /api/farm-conditions currently returns the same demo shape with metadata.
// value/status are keys the UI translates, except soilMoisture
// and temperature, whose values are numbers.
export const farmConditions = {
  rainfall: { value: "moderate", status: "normal" },
  soilMoisture: { value: 62, status: "moderate" },   // percent
  plantHealth: { value: "healthy", status: "good" },
  temperature: { value: 22, status: "suitable" }      // degrees C
};

// Older illustrative examples. POST /api/recommend now ranks a candidate set
// according to the submitted form and returns explicit prototype limitations.
export const rotationData = {
  soilHealth: {
    labelKey: "bestFit",
    crops: ["Teff", "Faba bean", "Wheat"],
    score: 91,
    reasonKey: "reason1"
  },
  water: {
    labelKey: "waterSaving",
    crops: ["Wheat", "Chickpea", "Teff"],
    score: 78,
    reasonKey: "reason3"
  },
  income: {
    labelKey: "balanced",
    crops: ["Maize", "Faba bean", "Teff"],
    score: 82,
    reasonKey: "reason2"
  },
  food: {
    labelKey: "food",
    crops: ["Maize", "Wheat", "Faba bean"],
    score: 86,
    reasonKey: "reason2"
  }
};