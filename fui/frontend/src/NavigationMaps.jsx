// Render the basic map
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch } from './utils/api.js';
import { getNightStyle } from './styles/s52-night.js';

const NavigationMaps = ({ liveTelemetry }) => {
  const mapContainer      = useRef(null);
  const mapInstance       = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const initializeMap = async () => {
      try {
        // Fetch the map server IP from the node backend
        const res = await apiFetch('/api/system/config');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch system config!");
        }

        const config = await res.json();
        if (!active) return;

        // Note on zoom levels;
        // Zoom 4 - 6: Oceanic / Regional Overview (Whole lakes or coasts)
        // Zoom 8 - 10: Coastal / Transit (General routing between ports)
        // Zoom 12 - 14: Approach / Nearshore (Approaching a harbor or navigating tight channels)
        // Zoom 15 - 18: Berthing / Harbour (Extreme detail, docks, individual mooring buoys)

        // Initialize the WebGL Map Canvas
        mapInstance.current = new maplibregl.Map({
          container: mapContainer.current,
          style: getNightStyle(config.mapServerUrl), 
          center: liveTelemetry?.position?.longitude && liveTelemetry?.position?.latitude 
             ? [liveTelemetry.position.longitude, liveTelemetry.position.latitude]
             : [-80.0, 43.0],
          zoom: liveTelemetry?.position?._timestamp && (Date.now() - liveTelemetry.position._timestamp < 10000)
             ? 13   // 13: Tight approach zoom for a live, fresh lock (< 10 seconds old)
             : liveTelemetry?.position?.longitude 
               ? 10 // 10: Coastal zoom for a stale lock (we have a position, but it is old)
               : 6, // 6: Regional overview if we have no position data at all,
          pitch: 0,
          bearing: 0, 
          attributionControl: false // Remove the MapLibre logo, though they should be credited elsewhere
        });

        // Basic zoom and rotation controls to start with.
        mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');
      } catch (err) {
        console.error("Map initialization failed! Error: ", err);
        if (active) setError(err.message);
      }
    };

    if (mapContainer.current && !mapInstance.current) {
      initializeMap();
    }

    // Cleanup the WebGL context when the user navigates away
    return () => {
      active = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    }
  }, []);

  return (
    <div className="maps-container">
      {error ? (
        <div className="maps-error">Map error: [{error}]</div>
      ) : (
        <div ref={mapContainer} className="maps-viewport"/>
      )}
    </div>
  );
};

export default NavigationMaps;
