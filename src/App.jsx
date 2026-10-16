import { useEffect, useState } from "react";
import FarmLocationMap from "./FarmLocationMap.jsx";
import "./App.css";

function isRecommendationResponse(data) {
  return Array.isArray(data?.recommendations)
    && data.recommendations.length > 0
    && data.recommendations.every((recommendation) => (
      Array.isArray(recommendation.crops)
      && recommendation.crops.length === 3
      && recommendation.crops.every((crop) => typeof crop === "string")
      && Number.isFinite(recommendation.score)
      && recommendation.score >= 0
      && recommendation.score <= 100
      && typeof recommendation.labelKey === "string"
      && typeof recommendation.reasonKey === "string"
    ))
    && typeof data.scoring?.validated === "boolean";
}

function isFarmConditionsResponse(data) {
  return typeof data?.location === "string"
    && data.source === "NASA POWER"
    && Number.isFinite(data.rainfall?.value)
    && data.rainfall.value >= 0
    && data.rainfall.unit === "mm"
    && Number.isFinite(data.temperature?.value)
    && data.temperature.unit === "°C"
    && Number.isFinite(data.humidity?.value)
    && data.humidity.value >= 0
    && data.humidity.value <= 100
    && data.humidity.unit === "%"
    && Number.isFinite(data.coordinates?.latitude)
    && Number.isFinite(data.coordinates?.longitude)
    && typeof data.period?.start === "string"
    && typeof data.period?.end === "string"
    && typeof data.retrievedAt === "string"
    && Number.isFinite(Date.parse(data.retrievedAt))
    && typeof data.spatialResolution === "string";
}

function locationDisplayName(location, mapPointText) {
  if (location.selectionMethod === "map") {
    return `${mapPointText} (${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)})`;
  }
  return `${location.name}${location.admin1 ? `, ${location.admin1}` : ""}`;
}

function getApiErrorMessage(response, data, fallback, outdatedServerMessage) {
  if (response.status === 404 && data?.error === "API route not found.") {
    return outdatedServerMessage;
  }
  return data?.error || fallback;
}

function App() {
  const [language, setLanguage] = useState("en");
  const [soilType, setSoilType] = useState("Nitisol");
  const [previousCrop, setPreviousCrop] = useState("Maize");
  const [currentCrop, setCurrentCrop] = useState("Teff");
  const [farmSize, setFarmSize] = useState("2 hectares");
  const [irrigation, setIrrigation] = useState("unknown");
  const [priority, setPriority] = useState("soilHealth");
  const [locationDraft, setLocationDraft] = useState("Bishoftu");
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationSearchError, setLocationSearchError] = useState("");
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSelectionError, setMapSelectionError] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [scoring, setScoring] = useState(null);
  const [conditionsResult, setConditionsResult] = useState({
    location: "",
    data: null,
    error: "",
  });
  const [conditionsRefresh, setConditionsRefresh] = useState(0);

  const isAmharic = language === "am";
  const text = {
    en: {
      planner: "Farm planner",
      how: "How it works",
      about: "About",
      help: "Help",
      start: "Start planning",

      eyebrow: "ETHIOCROP ADVISOR",
      title: "What should you plant after this harvest?",
      description:
        "EthioCrop Advisor uses your farm details to show example crop rotations and their reasons in plain words.",

      farmTitle: "Tell us about your farm",
      farmSubtitle: "Takes about one minute.",

      location: "Farm location",
      locationPlaceholder: "Town, woreda, or region",
      locationSelect: "Select a matching Ethiopian location",
      locationHint: "Search Ethiopia and choose the correct town or district.",
      geocodingCredit: "Place search by Open-Meteo",
      locationSearchLoading: "Searching Ethiopian locations...",
      locationNoResults: "No matching Ethiopian locations found.",
      locationSearchError: "Could not search locations. Check your connection and try again.",
      outdatedApiServer: "The website reached an older or misconfigured API. Stop both server terminals, restart them from the project folder with `npm.cmd run dev:server` and `npm.cmd run dev`, then reload the Vite URL.",
      mapSelect: "Choose on map",
      hideMap: "Hide map",
      mapHint: "Click the map to place your farm pin. Zoom in for a more precise location.",
      mapApproximation: "The map view is limited to an approximate Ethiopia area. Check that your pin is inside the country.",
      mapInvalid: "That point is outside the map area for this Ethiopia pilot.",
      mapPoint: "Map point",
      selectedLocation: "Selected location",
      retry: "Try again",
      soil: "Soil type",
      previous: "Previous crop",
      current: "Current crop",
      size: "Farm size",
      irrigation: "Irrigation available?",
      irrigationYes: "Yes",
      irrigationNo: "No",
      irrigationUnknown: "Not sure",

      priorities: "What matters most to you?",
      soilHealth: "Soil health",
      water: "Water saving",
      income: "Income",
      food: "Food",

      rotationButton: "Find my rotation →",
      free: "Free",
      noAccount: "No account",
      nasa: "NASA POWER weather",

      now: "Now",
      next: "Next",
      afterThat: "After that",

      teff: "Teff",
      fabaBean: "Faba bean",
      wheat: "Wheat",
      maize: "Maize",
      chickpea: "Chickpea",

     meher2026: "Meher 2026",
meher2027: "Meher 2027",
meher2028: "Meher 2028",

      why: "Why:",
      farmNow: "Your farm right now",
      farmNowSubtitle:
        "Recent NASA POWER gridded weather estimates for the selected location. These regional estimates are not farm measurements.",

      rainfall: "30-day rainfall total",
      humidity: "Relative humidity",
      dataSource: "Source",
      dataPeriod: "Data period",
      retrievedAt: "Retrieved",
      dataResolution: "Spatial resolution",
      noLocationSelected: "Search for a place in Ethiopia and select a matching result to load its environmental data.",
      conditionsLoading: "Loading recent environmental data...",
      weatherDisclaimer: "These are gridded estimates, not measurements at your farm. NASA POWER does not provide soil moisture or crop health here.",
      weatherLoadError: "Environmental data could not be loaded. Check your connection and retry.",

      temperature: "Temperature",
      suitable: "Suitable",

      scoreMeaning: "Prototype rule-match score, not a yield or profit prediction. Weather is shown for context and does not affect these options yet. Rules need local expert review.",

      options: "Your rotation options",
      optionsSubtitle: "Each one comes with a reason.",

      bestFit: "Best fit",
      balanced: "Balanced",
      waterSaving: "Water-saving",

      reason1:
        "Adds a bean crop between cereals to restore soil nitrogen.",

      reason2:
        "Mixes cereal and pulse; balances income and soil health.",

      reason3:
        "Chickpea needs less water, useful if rain is uncertain.",

      works: "How it works",
      worksSubtitle: "Four easy steps.",

      step1: "Describe your farm",
      step1Text: "Region, soil, crops and size.",

      step2: "We retrieve weather data",
      step2Text:
        "NASA POWER provides recent gridded weather estimates for the selected Ethiopian location.",

      step3: "We suggest example rotations",
      step3Text:
        "Example sequences are selected for your chosen priority.",

      step4: "You compare options",
      step4Text:
        "Scores come with plain-language reasons.",

      questions: "Help and common questions",
      questionsSubtitle:
        "Short answers for first-time users.",

      dataQuestion: "Is the data live?",
      dataAnswer:
        "Recent weather estimates are retrieved from NASA POWER. They represent a roughly 0.5-degree grid, not measurements on your farm. Soil moisture and crop-health satellite products are not connected yet.",

      rotationQuestion: "How is the rotation score worked out?",
      rotationAnswer:
        "The current API returns example rotations and scores. Verify crop choices with a local agricultural expert.",

      accountQuestion: "Do I need an account?",
      accountAnswer:
        "No. The prototype is designed to work without an account.",

      expertQuestion:
        "Does this replace an agricultural expert?",
      expertAnswer:
        "No. It is designed to support farmers and agricultural professionals.",

      contactTitle: "Still need help?",
      contactText:
        "For farm-specific advice, speak with your local agricultural development agent. You can also browse the help topics below.",

      contact: "Browse help topics",

      ready: "Ready to plan your next season?",
      recommendationLoading: "Loading recommendations...",
      requestFailed: "The request failed. Check that the API server is running and try again.",
      noRecommendations: "Choose your farm details, then find your rotation.",

      footer1: "EthioCrop Advisor · Team Qedamawiyan",
      footer2:
        "NASA Space Apps Challenge · Crop-planning prototype"
    },

    am: {
      planner: "የእርሻ ዕቅድ",
      how: "እንዴት ይሰራል",
      about: "ስለ እኛ",
      help: "እገዛ",
      start: "ዕቅድ ጀምር",

      eyebrow: "ኢትዮክሮፕ አማካሪ",
      title: "ከዚህ ምርት በኋላ ምን መዝራት አለብዎት?",
      description:
        "ኢትዮክሮፕ አማካሪ ምሳሌያዊ የሰብል ዙሮችንና ምክንያቶቻቸውን በቀላል ቋንቋ ያሳያል።",
      farmTitle: "ስለ እርሻዎ ይንገሩን",
      farmSubtitle: "አንድ ደቂቃ ያህል ይወስዳል።",

      location: "የእርሻ ቦታ",
      locationPlaceholder: "ከተማ፣ ወረዳ ወይም ክልል",
      locationSelect: "ትክክለኛውን የኢትዮጵያ ቦታ ይምረጡ",
      locationHint: "ኢትዮጵያ ውስጥ ያለ ከተማ ወይም ወረዳ ፈልገው ይምረጡ።",
      geocodingCredit: "የቦታ ፍለጋ በOpen-Meteo",
      locationSearchLoading: "የኢትዮጵያ ቦታዎችን በመፈለግ ላይ...",
      locationNoResults: "ተመሳሳይ የኢትዮጵያ ቦታ አልተገኘም።",
      locationSearchError: "ቦታውን መፈለግ አልተቻለም። ኢንተርኔትዎን ያረጋግጡ።",
      outdatedApiServer: "ድረ-ገጹ የቆየ ወይም በትክክል ያልተዋቀረ API አግኝቷል። ሁለቱንም አገልጋዮች ያቁሙ፣ በፕሮጀክቱ አቃፊ ውስጥ `npm.cmd run dev:server` እና `npm.cmd run dev` እንደገና ያስኪዱ፣ ከዚያ የVite አድራሻውን ይክፈቱ።",
      mapSelect: "በካርታ ላይ ይምረጡ",
      hideMap: "ካርታውን ደብቅ",
      mapHint: "የእርሻዎን ቦታ ለመምረጥ ካርታውን ይጫኑ። ቦታውን ለማጉላት ያሳድጉ።",
      mapApproximation: "የካርታው ክልል የኢትዮጵያን ግምታዊ አካባቢ ያሳያል። ምልክቱ በኢትዮጵያ ውስጥ መሆኑን ያረጋግጡ።",
      mapInvalid: "ይህ ቦታ ከኢትዮጵያ የሙከራ ካርታ ውጭ ነው።",
      mapPoint: "የካርታ ቦታ",
      selectedLocation: "የተመረጠው ቦታ",
      retry: "እንደገና ይሞክሩ",
      soil: "የአፈር አይነት",
      previous: "ያለፈው ሰብል",
      current: "የአሁኑ ሰብል",
      size: "የእርሻ መጠን",
      irrigation: "መስኖ አለ?",
      irrigationYes: "አዎ",
      irrigationNo: "የለም",
      irrigationUnknown: "አላውቅም",

      priorities: "ለእርስዎ በጣም አስፈላጊው ምንድነው?",
      soilHealth: "የአፈር ጤና",
      water: "ውሃ ቆጣቢነት",
      income: "ገቢ",
      food: "ምግብ",

      rotationButton: "የሰብል ዙሬን ፈልግ →",
      free: "ነፃ",
      noAccount: "መለያ አያስፈልግም",
      nasa: "የNASA POWER የአየር ሁኔታ",

      now: "አሁን",
      next: "ቀጣይ",
      afterThat: "ከዚያ በኋላ",

      teff: "ጤፍ",
      fabaBean: "ባቄላ",
      wheat: "ስንዴ",
      maize: "በቆሎ",
      chickpea: "ሽምብራ",

      meher2026: "መኸር 2026",
meher2027: "መኸር 2027",
meher2028: "መኸር 2028",

      why: "ለምን:",
      farmNow: "የእርሻዎ የአሁኑ ሁኔታ",
      farmNowSubtitle:
        "ለተመረጠው ቦታ የNASA POWER የቅርብ ጊዜ የአየር ሁኔታ ግምቶች።",

      rainfall: "የ30 ቀን የዝናብ ጠቅላላ መጠን",
      humidity: "አንጻራዊ እርጥበት",
      dataSource: "ምንጭ",
      dataPeriod: "የመረጃ ጊዜ",
      retrievedAt: "የተቀበለበት ጊዜ",
      dataResolution: "የቦታ ጥራት",
      noLocationSelected: "የአየር ሁኔታ መረጃ ለማግኘት ኢትዮጵያ ውስጥ ያለ ቦታ ፈልገው ይምረጡ።",
      conditionsLoading: "የቅርብ ጊዜ የአካባቢ መረጃን በማምጣት ላይ...",
      weatherDisclaimer: "እነዚህ የግሪድ ግምቶች ናቸው፤ በእርሻዎ ላይ የተወሰዱ መለኪያዎች አይደሉም። NASA POWER እዚህ የአፈር እርጥበትን ወይም የሰብል ጤናን አያቀርብም።",
      weatherLoadError: "የአካባቢ መረጃ ማምጣት አልተቻለም። ኢንተርኔትዎን ያረጋግጡና እንደገና ይሞክሩ።",

      temperature: "የሙቀት መጠን",
      suitable: "ተስማሚ",

      scoreMeaning: "ውጤቱ የማሳያ ደንቦችን ብቻ ያመለክታል፤ የምርት ወይም የገቢ ትንበያ አይደለም። የአየር ሁኔታው ለማጣቀሻ ብቻ ነው፣ አሁን የሰብል ምርጫን አይቀይርም። ደንቦቹ በአካባቢያዊ ባለሙያ መገምገም አለባቸው።",

      options: "የሰብል ዙር አማራጮች",
      optionsSubtitle:
        "እያንዳንዱ አማራጭ ምክንያት አለው።",

      bestFit: "በጣም ተስማሚ",
      balanced: "ሚዛናዊ",
      waterSaving: "ውሃ ቆጣቢ",

      reason1:
        "በሁለት የእህል ሰብሎች መካከል ጥራጥሬ በመጨመር የአፈርን ናይትሮጅን ያድሳል።",

      reason2:
        "የእህልና የጥራጥሬ ሰብሎችን በማቀላቀል ገቢንና የአፈር ጤናን ያመጣጥናል።",

      reason3:
        "ሽምብራ አነስተኛ ውሃ ስለሚፈልግ ዝናብ እርግጠኛ ባልሆነበት ጊዜ ጠቃሚ ነው።",

      works: "እንዴት ይሰራል?",
      worksSubtitle: "አራት ቀላል ደረጃዎች።",

      step1: "ስለ እርሻዎ ይግለጹ",
      step1Text: "ክልል፣ አፈር፣ ሰብሎች እና መጠን።",

      step2: "የአየር ሁኔታ መረጃ እናሳያለን",
      step2Text:
        "NASA POWER ለተመረጠው የኢትዮጵያ ቦታ የግሪድ የአየር ሁኔታ ግምቶችን ይሰጣል።",

      step3: "ምሳሌያዊ የሰብል ዙሮችን እንጠቁማለን",
      step3Text:
        "የምሳሌ ሰብል ቅደም ተከተሎች በተመረጠው ቅድሚያ መሰረት ይመረጣሉ።",

      step4: "አማራጮችን ያወዳድሩ",
      step4Text:
        "ውጤቶቹ በቀላል ቋንቋ ምክንያት ይኖራቸዋል።",

      questions: "እገዛ እና ተደጋጋሚ ጥያቄዎች",
      questionsSubtitle:
        "ለመጀመሪያ ጊዜ ተጠቃሚዎች አጭር መልሶች።",

      dataQuestion: "መረጃው ቀጥታ ነው?",
      dataAnswer:
        "የቅርብ ጊዜ የአየር ሁኔታ ግምቶች ከNASA POWER ይመጣሉ። ወደ 0.5 ዲግሪ የግሪድ ክልልን ይወክላሉ፤ በእርሻዎ ላይ የተወሰዱ መለኪያዎች አይደሉም። የአፈር እርጥበትና የሰብል ጤና መረጃ ገና አልተገናኘም።",

      rotationQuestion:
        "የሰብል ዙር ውጤት እንዴት ይሰላል?",

      rotationAnswer:
        "አሁን ያለው API ምሳሌያዊ የሰብል ዙሮችንና ውጤቶችን ይመልሳል። የሰብል ምርጫዎችን ከአካባቢያዊ የግብርና ባለሙያ ጋር ያረጋግጡ።",

      accountQuestion: "መለያ ያስፈልገኛል?",
      accountAnswer:
        "አይ። ይህ ፕሮቶታይፕ ያለ መለያ እንዲሰራ ተዘጋጅቷል።",

      expertQuestion:
        "ይህ የግብርና ባለሙያን ይተካል?",

      expertAnswer:
        "አይ። ገበሬዎችንና የግብርና ባለሙያዎችን ለመደገፍ የተዘጋጀ ነው።",

      contactTitle: "አሁንም እገዛ ያስፈልግዎታል?",

      contactText:

  "ለእርሻዎ የተለየ ምክር ለማግኘት የአካባቢዎን የግብርና ልማት ባለሙያ ያነጋግሩ። ከታች ያሉትን የእገዛ ርዕሶችም ማየት ይችላሉ።",
      contact: "የእገዛ ርዕሶችን ይመልከቱ",

      ready:
        "የሚቀጥለውን የእርሻ ወቅት ለማቀድ ዝግጁ ነዎት?",

      recommendationLoading: "ምክሮችን በማምጣት ላይ...",
      requestFailed: "ጥያቄው አልተሳካም። እባክዎ API አገልጋዩ መስራቱን ያረጋግጡ እና እንደገና ይሞክሩ።",
      noRecommendations: "የእርሻዎን መረጃ ይምረጡ እና የሰብል ዙርዎን ያግኙ።",

      footer1: "ኢትዮክሮፕ አማካሪ · ቡድን ቀዳማዊያን",
      footer2:
        "NASA Space Apps Challenge · የሰብል ዕቅድ ማሳያ"
    }
  };

  const t = text[language];
  function clearRecommendations() {
    setRecommendations([]);
    setRecommendationError("");
    setScoring(null);
  }

  async function fetchRecommendations(event) {
    event.preventDefault();
    if (!selectedLocation) {
      setRecommendationError(t.noLocationSelected);
      return;
    }
    setRecommendationLoading(true);
    setRecommendationError("");

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soilType,
          previousCrop,
          currentCrop,
          farmSize,
          irrigation,
          priority,
          location: selectedLocationName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data, "Could not load recommendations.", t.outdatedApiServer));
      }
      if (!isRecommendationResponse(data)) {
        throw new Error("The API returned recommendations in an unexpected format.");
      }
      setRecommendations(data.recommendations);
      setScoring(data.scoring);
    } catch (error) {
      setRecommendations([]);
      setRecommendationError(
        error instanceof Error ? error.message : t.requestFailed,
      );
    } finally {
      setRecommendationLoading(false);
    }
  }

  useEffect(() => {
    const query = locationDraft.trim();
    if (query.length < 2 || selectedLocation?.selectionMethod === "map") {
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLocationSearchError("");
      setLocationSearchLoading(true);
      try {
        const response = await fetch(`/api/locations?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(getApiErrorMessage(response, data, t.locationSearchError, t.outdatedApiServer));
        }
        if (!Array.isArray(data.results)) throw new Error("The location search returned an unexpected format.");
        setLocations(data.results);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLocations([]);
          setLocationSearchError(error instanceof Error ? error.message : t.locationSearchError);
        }
      } finally {
        if (!controller.signal.aborted) setLocationSearchLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [locationDraft, selectedLocation?.selectionMethod, t.locationSearchError, t.outdatedApiServer]);

  useEffect(() => {
    if (!selectedLocation) {
      return undefined;
    }
    const controller = new AbortController();
    const locationId = selectedLocation.id;
    async function fetchConditions() {
      try {
        const response = await fetch(
          `/api/farm-conditions?location=${encodeURIComponent(locationDisplayName(selectedLocation, t.mapPoint))}&latitude=${selectedLocation.latitude}&longitude=${selectedLocation.longitude}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(getApiErrorMessage(response, data, t.weatherLoadError, t.outdatedApiServer));
        }
        if (!isFarmConditionsResponse(data)) {
          throw new Error("The API returned farm conditions in an unexpected format.");
        }
        setConditionsResult({ location: locationId, data, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setConditionsResult({
            location: locationId,
            data: null,
            error: error instanceof Error ? error.message : t.requestFailed,
          });
        }
      }
    }

    void fetchConditions();
    return () => controller.abort();
  }, [selectedLocation, t.mapPoint, t.requestFailed, t.outdatedApiServer, t.weatherLoadError, conditionsRefresh]);

  const hasCurrentConditions = Boolean(selectedLocation) && conditionsResult.location === selectedLocation.id;
  const farmConditions = hasCurrentConditions ? conditionsResult.data : null;
  const conditionsLoading = Boolean(selectedLocation) && !hasCurrentConditions;
  const conditionsError = hasCurrentConditions ? conditionsResult.error : "";
  const selectedLocationName = selectedLocation
    ? locationDisplayName(selectedLocation, t.mapPoint)
    : "";

  const names = {
  en: {},
  am: {
    "Bishoftu, Oromia": "ቢሾፍቱ, ኦሮሚያ",

    Nitisol: "ኒቲሶል (ቀይ አፈር)",
    Vertisol: "ቨርቲሶል (ጥቁር ሸክላ)",
    Cambisol: "ካምቢሶል",
    Luvisol: "ሉቪሶል",

    Maize: "በቆሎ",
    Teff: "ጤፍ",
    Wheat: "ስንዴ",
    Barley: "ገብስ",
    Sorghum: "ማሽላ",
    Chickpea: "ሽምብራ",
    "Faba bean": "ባቄላ",

    "0.5 hectare": "0.5 ሄክታር",
    "1 hectare": "1 ሄክታር",
    "2 hectares": "2 ሄክታር",
    "5 hectares": "5 ሄክታር",
    "10 hectares": "10 ሄክታር",
    "20+ hectares": "20+ ሄክታር"
  }
};

const label = (value) => names[language][value] || value;

const soilOptions = ["Nitisol", "Vertisol", "Cambisol", "Luvisol"];
const cropOptions = ["Maize", "Teff", "Wheat", "Barley", "Sorghum", "Chickpea", "Faba bean"];
const sizeOptions = ["0.5 hectare", "1 hectare", "2 hectares", "5 hectares", "10 hectares", "20+ hectares"];
const displayRecommendations = recommendations.map((recommendation) => ({
  ...recommendation,
  label: t[recommendation.labelKey] || recommendation.labelKey,
  reason: recommendation.reason || t[recommendation.reasonKey] || "",
}));
const selectedRecommendation = displayRecommendations[0];

const faqs = [
  { q: t.dataQuestion, a: t.dataAnswer },
  { q: t.rotationQuestion, a: t.rotationAnswer },
  { q: t.accountQuestion, a: t.accountAnswer },
  { q: t.expertQuestion, a: t.expertAnswer }
];
const cropClass = (crop) =>
  ({
    Teff: "teff",
    "Faba bean": "bean",
    Wheat: "wheat",
    Maize: "maize",
    Chickpea: "chickpea"
  }[crop] || "");

const rotationOptions = displayRecommendations;
  return (
    <div className={isAmharic ? "app amharic" : "app"}>

      {/* NAVIGATION */}
      <header className="navbar">
<button
  type="button"
  className="menu-button"
  aria-label="Menu"
  onClick={() => setMenuOpen(true)}
>
  <span></span>
  <span></span>
  <span></span>
</button>
        <div className="logo">
          <div className="logo-icon">🌱</div>
         <span>{isAmharic ? "ኢትዮክሮፕ አማካሪ" : "EthioCrop Advisor"}</span>
        </div>

        <nav className="nav-links">
          <a href="#planner">{t.planner}</a>
          <a href="#how-it-works">{t.how}</a>
          <a href="#about">{t.about}</a>
          <a href="#help">{t.help}</a>
        </nav>

        
        <div className="nav-actions">

  <div className="lang-toggle">
    <button
      type="button"
      className={!isAmharic ? "active" : ""}
      onClick={() => setLanguage("en")}
    >
      EN
    </button>

    <button
      type="button"
      className={isAmharic ? "active" : ""}
      onClick={() => setLanguage("am")}
    >
      አማ
    </button>
  </div>

  <button
    className="start-button"
    onClick={() => {
      document.getElementById("farm-form").scrollIntoView({
        behavior: "smooth"
      });
    }}
  >
    {t.start}
  </button>

</div>

      </header>
      {/* MOBILE MENU */}
<div
  className={`menu-overlay ${menuOpen ? "open" : ""}`}
  onClick={() => setMenuOpen(false)}
></div>

<aside className={`mobile-menu ${menuOpen ? "open" : ""}`}>

  <div className="mobile-menu-top">
    <strong>{isAmharic ? "ኢትዮክሮፕ አማካሪ" : "EthioCrop Advisor"}</strong>
    <button
      type="button"
      className="menu-close"
      aria-label="Close"
      onClick={() => setMenuOpen(false)}
    >
      ✕
    </button>
  </div>

  <a href="#planner" onClick={() => setMenuOpen(false)}>
    <span>🌾</span> {t.planner}
  </a>
  <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
    <span>🧭</span> {t.how}
  </a>
  <a href="#about" onClick={() => setMenuOpen(false)}>
    <span>ℹ️</span> {t.about}
  </a>
  <a href="#help" onClick={() => setMenuOpen(false)}>
    <span>❓</span> {t.help}
  </a>

  <div className="mobile-menu-card">
    <p>{t.ready}</p>
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        document.getElementById("farm-form").scrollIntoView({
          behavior: "smooth"
        });
      }}
    >
      {t.start}
    </button>
  </div>

</aside>
            <div className="pattern-border"></div>
      <div className="flag-stripe"></div>
      <main>

        {/* HERO / FARM PLANNER */}
        <section className="hero" id="planner">

          {/* FARM INFORMATION CARD */}
          <div className="farm-card" id="farm-form">

            <div className="farm-image">
  <svg
    viewBox="0 0 760 270"
    preserveAspectRatio="xMidYMid slice"
    width="100%"
    height="100%"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bcdde8" />
        <stop offset="1" stopColor="#e3eff0" />
      </linearGradient>
      <pattern
        id="stripes"
        width="14"
        height="14"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(20)"
      >
        <rect width="3" height="14" fill="rgba(0,0,0,0.12)" />
      </pattern>
    </defs>

    {/* sky */}
    <rect width="760" height="270" fill="url(#sky)" />

    {/* sun */}
    <circle cx="600" cy="62" r="46" fill="#d9dfc8" />
    <circle cx="600" cy="62" r="28" fill="#e0a73a" />

    {/* birds */}
    <path d="M200 62 q8 -8 16 0 q8 -8 16 0" stroke="#123f3d" strokeWidth="2" fill="none" />
    <path d="M250 85 q6 -6 12 0 q6 -6 12 0" stroke="#123f3d" strokeWidth="2" fill="none" />

    {/* mountains */}
    <path d="M0 165 L120 80 L210 135 L330 60 L450 140 L540 100 L760 170 L760 270 L0 270Z" fill="#a3c3c9" />
    <path d="M0 180 L160 115 L300 165 L430 112 L580 155 L760 120 L760 270 L0 270Z" fill="#94b9c0" />

    {/* far green hill */}
    <path d="M0 195 Q190 150 400 182 T760 165 L760 270 L0 270Z" fill="#7ea75a" />

    {/* fields */}
    <path d="M0 215 Q200 180 400 210 T760 195 L760 270 L0 270Z" fill="#e0a73a" />
    <path d="M0 240 Q200 212 400 236 T760 222 L760 270 L0 270Z" fill="#4f8f3a" />
    <path d="M0 258 Q200 240 400 256 T760 246 L760 270 L0 270Z" fill="#b0722a" />

    {/* stripe texture over all fields */}
    <path d="M0 215 Q200 180 400 210 T760 195 L760 270 L0 270Z" fill="url(#stripes)" />

    {/* hut */}
    <polygon points="128,180 150,160 172,180" fill="#c0763a" />
    <rect x="134" y="180" width="32" height="20" fill="#d89a52" />
    <rect x="146" y="186" width="9" height="14" fill="#6b3a1f" />

    {/* tree */}
    <rect x="517" y="160" width="6" height="30" fill="#6b4a2a" />
    <ellipse cx="520" cy="156" rx="48" ry="14" fill="#3f6b34" />
    <ellipse cx="505" cy="152" rx="26" ry="8" fill="#5f9a3f" />
  </svg>
</div>


            <div className="farm-content">

              <h2>{t.farmTitle}</h2>

              <p className="small-text">
                {t.farmSubtitle}
              </p>

              <form
                id="farm-planner-form"
                onSubmit={(event) => {
                  void fetchRecommendations(event);
                  document.getElementById("rotation-options").scrollIntoView({
                    behavior: "smooth",
                  });
                }}
              >
              <label className="location-box">
                <span>
                  <small>{t.location}</small>
                  <input
                    type="text"
                    value={locationDraft}
                    maxLength={200}
                    placeholder={t.locationPlaceholder}
                    required
                    onChange={(event) => {
                      setLocationDraft(event.target.value);
                      setSelectedLocation(null);
                      setLocations([]);
                      setLocationSearchLoading(false);
                      clearRecommendations();
                    }}
                  />
                </span>
              </label>
              <p className="location-hint">{t.locationHint}</p>
              <p className="location-attribution">
                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{t.geocodingCredit}</a>
              </p>
              <button
                type="button"
                className="map-toggle"
                aria-expanded={mapOpen}
                onClick={() => {
                  setMapOpen((open) => !open);
                  setMapSelectionError("");
                }}
              >
                {mapOpen ? t.hideMap : t.mapSelect}
              </button>
              {mapOpen && (
                <div className="map-picker">
                  <p className="location-hint">{t.mapHint}</p>
                  <FarmLocationMap
                    selectedLocation={selectedLocation}
                    onSelect={(place) => {
                      setSelectedLocation(place);
                      setLocationDraft(locationDisplayName(place, t.mapPoint));
                      setMapSelectionError("");
                      setLocationSearchError("");
                      setLocations([]);
                      setRecommendations([]);
                      setRecommendationError("");
                      setScoring(null);
                    }}
                    onInvalidSelection={() => setMapSelectionError(t.mapInvalid)}
                  />
                  <p className="location-hint map-warning">{t.mapApproximation}</p>
                  {mapSelectionError && <p className="api-message" role="alert">{mapSelectionError}</p>}
                </div>
              )}
              {selectedLocation && (
                <p className="selected-location">
                  <strong>{t.selectedLocation}:</strong> {selectedLocationName}
                </p>
              )}
              <div className="location-select">
                <label htmlFor="location-match">{t.locationSelect}</label>
                <select
                  id="location-match"
                  value={selectedLocation?.id ?? ""}
                  required={!selectedLocation}
                  onChange={(event) => {
                    const match = locations.find((place) => place.id === event.target.value);
                    setSelectedLocation(match ?? null);
                    setMapSelectionError("");
                    clearRecommendations();
                  }}
                >
                  <option value="" disabled>{t.locationSelect}</option>
                  {selectedLocation?.selectionMethod === "map" && (
                    <option value={selectedLocation.id}>{selectedLocationName}</option>
                  )}
                  {locations.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}{place.admin1 ? `, ${place.admin1}` : ""} · {place.country}
                    </option>
                  ))}
                </select>
              </div>
              {locationSearchLoading && <p className="location-hint" role="status">{t.locationSearchLoading}</p>}
              {!locationSearchLoading && locationDraft.trim().length >= 2 && locations.length === 0 && !locationSearchError && selectedLocation?.selectionMethod !== "map" && (
                <p className="location-hint" role="status">{t.locationNoResults}</p>
              )}
              {locationSearchError && <p className="api-message" role="alert">{locationSearchError}</p>}

            <div className="farm-grid">

  <label className="select-box">
    <small>{t.soil}</small>
    <select value={soilType} onChange={(e) => { setSoilType(e.target.value); clearRecommendations(); }}>
      {soilOptions.map((o) => (
        <option key={o} value={o}>{label(o)}</option>
      ))}
    </select>
  </label>

  <label className="select-box">
    <small>{t.previous}</small>
    <select value={previousCrop} onChange={(e) => { setPreviousCrop(e.target.value); clearRecommendations(); }}>
      {cropOptions.map((o) => (
        <option key={o} value={o}>{label(o)}</option>
      ))}
    </select>
  </label>

  <label className="select-box">
    <small>{t.current}</small>
    <select value={currentCrop} onChange={(e) => { setCurrentCrop(e.target.value); clearRecommendations(); }}>
      {cropOptions.map((o) => (
        <option key={o} value={o}>{label(o)}</option>
      ))}
    </select>
  </label>

  <label className="select-box">
    <small>{t.size}</small>
    <select value={farmSize} onChange={(e) => { setFarmSize(e.target.value); clearRecommendations(); }}>
      {sizeOptions.map((o) => (
        <option key={o} value={o}>{label(o)}</option>
      ))}
    </select>
  </label>

</div>

              <label className="select-box irrigation-box">
                <small>{t.irrigation}</small>
                <select value={irrigation} onChange={(event) => { setIrrigation(event.target.value); clearRecommendations(); }}>
                  <option value="yes">{t.irrigationYes}</option>
                  <option value="no">{t.irrigationNo}</option>
                  <option value="unknown">{t.irrigationUnknown}</option>
                </select>
              </label>

              <p className="priority-title">
                {t.priorities}
              </p>


              <div className="priority-buttons">

  <button
    type="button"
    aria-pressed={priority === "soilHealth"}
    className={priority === "soilHealth" ? "active" : ""}
    onClick={() => { setPriority("soilHealth"); clearRecommendations(); }}
  >
    {t.soilHealth}
  </button>

  <button
    type="button"
    aria-pressed={priority === "water"}
    className={priority === "water" ? "active" : ""}
    onClick={() => { setPriority("water"); clearRecommendations(); }}
  >
    {t.water}
  </button>

  <button
    type="button"
    aria-pressed={priority === "income"}
    className={priority === "income" ? "active" : ""}
    onClick={() => { setPriority("income"); clearRecommendations(); }}
  >
    {t.income}
  </button>

  <button
    type="button"
    aria-pressed={priority === "food"}
    className={priority === "food" ? "active" : ""}
    onClick={() => { setPriority("food"); clearRecommendations(); }}
  >
    {t.food}
  </button>

</div>

              </form>
            </div>

          </div>


          {/* RECOMMENDATION */}
          <div className="hero-content">

            <p className="eyebrow">
              {t.eyebrow}
            </p>

            <h1>{t.title}</h1>

            <p className="hero-description">
              {t.description}
            </p>


            {/* CROP ROTATION */}
{selectedRecommendation ? (
<div className="rotation-box">

  <div className="crop-flow">
  {selectedRecommendation.crops.map((crop, index) => (
    <div key={crop} className={`crop ${cropClass(crop)}`}>
      <small>
        {index === 0 ? t.now : index === 1 ? t.next : t.afterThat}
      </small>

      <strong>{label(crop)}</strong>

      <span>
        {index === 0
          ? t.meher2026
          : index === 1
          ? t.meher2027
          : t.meher2028}
      </span>
    </div>
  ))}
</div>
  <div className="score-row">
    <strong>
      {selectedRecommendation.score}
      <span>/100</span>
    </strong>

    <p>
      <b>{t.why}</b> {selectedRecommendation.reason}
    </p>
  </div>
  {scoring && <p className="score-disclaimer">{t.scoreMeaning}</p>}

</div>
) : (
  <p className="api-message" role={recommendationError ? "alert" : "status"}>
    {recommendationError || (recommendationLoading ? t.recommendationLoading : t.noRecommendations)}
  </p>
)}

            <button
  className="rotation-button"
  type="submit"
  form="farm-planner-form"
  disabled={recommendationLoading}
>
  {recommendationLoading ? t.recommendationLoading : t.rotationButton}
</button>


            <div className="badges">

              <span>{t.free}</span>
              <span>{t.noAccount}</span>
              <span>{t.nasa}</span>

            </div>

          </div>

        </section>


        {/* CURRENT FARM CONDITIONS */}
        <section className="section" id="about">

          <div className="section-heading">

            <h2>{t.farmNow}</h2>

            <p>{t.farmNowSubtitle}</p>

          </div>


          {conditionsLoading && !farmConditions ? (
            <p className="api-message" role="status">{t.conditionsLoading}</p>
          ) : conditionsError ? (
            <div className="api-message" role="alert">
              <span>{conditionsError || t.weatherLoadError}</span>{" "}
              <button type="button" className="inline-retry" onClick={() => setConditionsRefresh((value) => value + 1)}>
                {t.retry}
              </button>
            </div>
          ) : farmConditions ? (
          <div className="data-grid">
  <div className="data-card">
    <small>{t.rainfall}</small>
    <strong>{farmConditions.rainfall.value} {farmConditions.rainfall.unit}</strong>
    <span>{farmConditions.rainfall.days} {isAmharic ? "የመረጃ ቀናት" : "valid days"}</span>
  </div>

  <div className="data-card">
    <small>{t.temperature}</small>
    <strong>{farmConditions.temperature.value} {farmConditions.temperature.unit}</strong>
    <span>{isAmharic ? "በ2 ሜትር አማካይ ሙቀት" : "Mean air temperature at 2 m"}</span>
  </div>

  <div className="data-card">
    <small>{t.humidity}</small>
    <strong>{farmConditions.humidity.value} {farmConditions.humidity.unit}</strong>
    <span>{isAmharic ? "በ2 ሜትር አማካይ" : "Mean relative humidity at 2 m"}</span>
  </div>

</div>
          ) : (
            <p className="api-message" role="status">{t.noLocationSelected}</p>
          )}

          {farmConditions && (
            <div className="environment-meta">
              <p>
                <strong>{t.dataSource}:</strong>{" "}
                <a href={farmConditions.sourceUrl} target="_blank" rel="noreferrer">{farmConditions.source}</a>
                {" · "}
                <strong>{t.dataPeriod}:</strong> {farmConditions.period.start} – {farmConditions.period.end}
                {" · "}
                <strong>{t.location}:</strong> {farmConditions.location} ({farmConditions.coordinates.latitude.toFixed(3)}, {farmConditions.coordinates.longitude.toFixed(3)})
              </p>
              <p>
                      <strong>{t.retrievedAt}:</strong>{" "}
                      <time dateTime={farmConditions.retrievedAt}>
                        {new Date(farmConditions.retrievedAt).toLocaleString(isAmharic ? "am-ET" : "en-ET")}
                      </time>
                    </p>
                    <p>
                      <strong>{t.dataResolution}:</strong> {farmConditions.spatialResolution}
                      {" · "}
                {farmConditions.validDays} / 30 {isAmharic ? "የተጠቃሚ ቀናት" : "valid days"}
              </p>
              <p className="sample-text">{t.weatherDisclaimer}</p>
            </div>
          )}

        </section>


        {/* ROTATION OPTIONS */}
        <section className="section" id="rotation-options">
          <div className="section-heading">

            <h2>{t.options}</h2>

            <p>{t.optionsSubtitle}</p>

          </div>


          {rotationOptions.length > 0 ? (
            <div className="rotation-grid">
              {rotationOptions.map((option, index) => (
                <div
                  key={option.crops.join("-")}
                  className={`rotation-card ${index === 0 ? "featured" : ""}`}
                >
                  <div className="card-strip">
                    {option.crops.map((crop) => (
                      <span key={crop} className={cropClass(crop)}></span>
                    ))}
                  </div>

                  <div className="card-body">
                    <small>{option.label}</small>
                    <h3>{option.crops.map((crop) => label(crop)).join(" → ")}</h3>
                    <strong>{option.score}</strong>
                    <div className="score-bar">
                      <span style={{ width: `${option.score}%` }}></span>
                    </div>
                    <p>{option.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="api-message" role={recommendationError ? "alert" : "status"}>
              {recommendationError || (recommendationLoading ? t.recommendationLoading : t.noRecommendations)}
            </p>
          )}

        </section>


        {/* HOW IT WORKS */}
        <section
          className="section how-section"
          id="how-it-works"
        >

          <div className="section-heading">

            <h2>{t.works}</h2>

            <p>{t.worksSubtitle}</p>

          </div>


          <div className="steps">

            <div className="step">

              <span>1</span>

              <h3>{t.step1}</h3>

              <p>{t.step1Text}</p>

            </div>


            <div className="step">

              <span>2</span>

              <h3>{t.step2}</h3>

              <p>{t.step2Text}</p>

            </div>


            <div className="step">

              <span>3</span>

              <h3>{t.step3}</h3>

              <p>{t.step3Text}</p>

            </div>


            <div className="step">

              <span>4</span>

              <h3>{t.step4}</h3>

              <p>{t.step4Text}</p>

            </div>

          </div>

        </section>


        {/* HELP / FAQ */}
        <section
          className="section help-section"
          id="help"
        >

          <div className="section-heading">

            <h2>{t.questions}</h2>

            <p>{t.questionsSubtitle}</p>

          </div>


          <div className="faq-grid">
  {faqs.map((item, index) => (
    <div
      key={index}
      className={`faq ${openFaq === index ? "open" : ""}`}
    >
      <button
        type="button"
        className="faq-question"
        onClick={() => setOpenFaq(openFaq === index ? null : index)}
      >
        <span>{item.q}</span>
        <span className="faq-icon">{openFaq === index ? "−" : "+"}</span>
      </button>

      {openFaq === index && <p>{item.a}</p>}
    </div>
  ))}
</div>

        </section>


        {/* CONTACT */}
        <section className="contact-section">

          <div>

            <h2>{t.contactTitle}</h2>

            <p>{t.contactText}</p>

          </div>

          <a href="#help">{t.contact}</a>

        </section>


        {/* FINAL CALL TO ACTION */}
        <section className="final-section">

          <h2>{t.ready}</h2>

          <button
  onClick={() => {
    document.getElementById("farm-form").scrollIntoView({
      behavior: "smooth"
    });
  }}
>
  {t.start}
</button>

        </section>

      </main>


      {/* FOOTER */}
      <footer>

        <span>{t.footer1}</span>

        <span>{t.footer2}</span>

      </footer>

    </div>
  );
}

export default App;