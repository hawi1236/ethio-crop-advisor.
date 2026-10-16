import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ETHIOPIA_MAP_BOUNDS = [
  [3.3, 32.9],
  [15.0, 48.0],
];

const selectedIcon = L.divIcon({
  className: "farm-map-marker",
  html: '<span class="farm-map-marker-pin"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

function MapSelectionEvents({ onSelect, onInvalidSelection }) {
  useMapEvents({
    click(event) {
      const [[south, west], [north, east]] = ETHIOPIA_MAP_BOUNDS;
      if (
        event.latlng.lat < south
        || event.latlng.lat > north
        || event.latlng.lng < west
        || event.latlng.lng > east
      ) {
        onInvalidSelection();
        return;
      }
      onSelect({
        id: `${event.latlng.lat.toFixed(4)},${event.latlng.lng.toFixed(4)}`,
        name: "Map point",
        admin1: null,
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        country: "Ethiopia",
        selectionMethod: "map",
      });
    },
  });
  return null;
}

function FitSelection({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 9), {
        duration: 0.5,
      });
    }
  }, [location, map]);
  return null;
}

export default function FarmLocationMap({ selectedLocation, onSelect, onInvalidSelection }) {
  return (
    <MapContainer
      className="farm-location-map"
      center={[8.75, 38.98]}
      zoom={5}
      minZoom={5}
      maxZoom={15}
      maxBounds={ETHIOPIA_MAP_BOUNDS}
      maxBoundsViscosity={1}
      scrollWheelZoom={false}
      aria-label="Map of Ethiopia. Select a farm location by clicking the map."
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapSelectionEvents onSelect={onSelect} onInvalidSelection={onInvalidSelection} />
      <FitSelection location={selectedLocation} />
      {selectedLocation && (
        <Marker
          position={[selectedLocation.latitude, selectedLocation.longitude]}
          icon={selectedIcon}
        />
      )}
    </MapContainer>
  );
}
