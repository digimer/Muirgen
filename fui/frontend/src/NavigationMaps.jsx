// Render the basic map
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { apiFetch } from './utils/api.js';
import { getNightStyle } from './styles/s52-night.js';
import { formatCoordinate } from './utils/formatters.js';

// Haversine formula to mathematically project a geographic coordinate
const projectCoordinate = (lat, lon, bearingDeg, distanceNM) => {
  const radius   = 3440.065; // Earth radius in Nautical Miles
  const distance = distanceNM;
  const lat1     = lat * Math.PI / 180;
  const lon1     = lon * Math.PI / 180;
  const bearing  = bearingDeg * Math.PI / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance / radius) +
    Math.cos(lat1) * Math.sin(distance / radius) * Math.cos(bearing)
  );
  let lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance / radius) * Math.cos(lat1),
    Math.cos(distance / radius) - Math.sin(lat1) * Math.sin(lat2)
  );

  return [lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]; // MapLibre expects [lng, lat]
};

// Calculate distance between two coordinates in Nautical Miles
const calculateDistanceNM = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const earthRadiusNM      = 3440.065; 
  const deltaLatRad        = (lat2 - lat1) * Math.PI / 180;
  const deltaLonRad        = (lon2 - lon1) * Math.PI / 180;
  const chordLengthSquared = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) +
                             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                             Math.sin(deltaLonRad/2) * Math.sin(deltaLonRad/2);
  const angularDistance    = 2 * Math.atan2(Math.sqrt(chordLengthSquared), Math.sqrt(1 - chordLengthSquared));
  
  return earthRadiusNM * angularDistance;
};

// Generate GeoJSON for the 1-hour Predictor Vector
const generatePredictorGeoJSON = (lat, lon, speedKnots, cogDeg) => {
  // If moving incredibly slow (e.g. docked), don't draw the predictor line
  if (lat == null || lon == null || speedKnots == null || cogDeg == null || speedKnots < 0.1) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features = [];
  
  // Main 60-minute predictor line
  const p60 = projectCoordinate(lat, lon, cogDeg, speedKnots * 1.0);
  features.push({
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[lon, lat], p60] }
  });

  // Calculate notches (width dynamically scales slightly with speed to remain visible)
  const notchWidthNM = Math.max(0.01, speedKnots * 0.005);
  
  // 15m, 30m, 45m marks (orthogonal cross-ticks)
  [0.25, 0.5, 0.75].forEach(fraction => {
    const center = projectCoordinate(lat, lon, cogDeg, speedKnots * fraction);
    const left   = projectCoordinate(center[1], center[0], cogDeg - 90, notchWidthNM);
    const right  = projectCoordinate(center[1], center[0], cogDeg + 90, notchWidthNM);
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [left, right] }
    });
  });

  // 60m arrow head (a triangle pointing forward)
  const arrowBackLeft  = projectCoordinate(p60[1], p60[0], cogDeg - 135, notchWidthNM * 2);
  const arrowBackRight = projectCoordinate(p60[1], p60[0], cogDeg + 135, notchWidthNM * 2);
  features.push({
    type: "Feature",
    geometry: { type: "LineString", coordinates: [arrowBackLeft, p60, arrowBackRight] }
  });

  return { type: "FeatureCollection", features };
};

const NavigationMaps = ({ liveTelemetry }) => {
  const mapContainer          = useRef(null);
  const mapInstance           = useRef(null);
  const vesselMarker          = useRef(null);
  const mapLoaded             = useRef(false);
  const viewLatRef            = useRef(null);
  const viewLngRef            = useRef(null);
  const viewDistRef           = useRef(null);
  const latestTelemetry       = useRef(liveTelemetry);
  const [error, setError]     = useState(null);
  const [mapMode, setMapMode] = useState('NORTH_UP'); // FREE_PAN, NORTH_UP, HEAD_UP

  // Keep telemetry ref fresh for the high-performance move listener
  useEffect(() => {
    latestTelemetry.current = liveTelemetry;
  }, [liveTelemetry]);

  // Map Initialization
  useEffect(() => {
    let active = true;

    const initializeMap = async () => {
      try {
        const res = await apiFetch('/api/system/config');
        if (!res.ok) throw new Error("Failed to fetch system config!");
        const config = await res.json();
        if (!active) return;

        // Fetch available layers to prevent validation crashes
        let availableLayers = null;
        try {
          const tileRes = await fetch(`${config.mapServerUrl}/charts`);
          if (tileRes.ok) {
            const tileData = await tileRes.json();
            if (tileData.vector_layers) availableLayers = tileData.vector_layers.map(l => l.id);
          }
        } catch (e) {
          console.warn("Failed to pre-fetch TileJSON: ", e);
        }

        const initialLat = liveTelemetry?.position?.latitude || 43.0;
        const initialLng = liveTelemetry?.position?.longitude || -80.0;

        mapInstance.current = new maplibregl.Map({
          container: mapContainer.current,
          style: getNightStyle(config.mapServerUrl, availableLayers), 
          center: [initialLng, initialLat],
          zoom: liveTelemetry?.position?._timestamp && (Date.now() - liveTelemetry.position._timestamp < 10000) ? 13 : 6,
          pitch: 0,
          bearing: 0, 
          attributionControl: false
        });

        mapInstance.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        mapInstance.current.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'nautical' }), 'bottom-left');
        mapInstance.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        // High-performance DOM update for coordinates to avoid 60FPS React state re-renders
        mapInstance.current.on('move', () => {
          if (viewLatRef.current && viewLngRef.current) {
            const center = mapInstance.current.getCenter();
            viewLatRef.current.innerText = formatCoordinate(center.lat, true);
            viewLngRef.current.innerText = formatCoordinate(center.lng, false);

            // Calculate range if we have a live GPS fix
            if (viewDistRef.current && latestTelemetry.current?.position?.latitude != null) {
              const dist = calculateDistanceNM(
                latestTelemetry.current.position.latitude,
                latestTelemetry.current.position.longitude,
                center.lat,
                center.lng
              );
              viewDistRef.current.innerText = `${dist.toFixed(2)} nm`;
            }
          }
        });

        // Break tracking lock on ANY user interaction (drag, scroll wheel, 
        // pinch, etc.). Programmatic tracking movements (easeTo) will not have
        // an originalEvent.
        mapInstance.current.on('movestart', (e) => {
          if (e.originalEvent) {
            setMapMode('FREE_PAN');
          }
        });

        mapInstance.current.on('load', () => {
          mapLoaded.current = true;

          // Add GeoJSON source for the mathematical predictor vector
          mapInstance.current.addSource('predictor-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });

          // Draw the predictor lines dynamically on top of the charts
          mapInstance.current.addLayer({
            id: 'predictor-line',
            type: 'line',
            source: 'predictor-source',
            paint: {
              'line-color': '#ff0000',
              'line-width': 1.5,
              'line-dasharray': [4, 2] // Dashed COG vector as per IMO standards
            }
          });
        });

      } catch (err) {
        console.error("Map initialization failed: ", err);
        if (active) setError(err.message);
      }
    };

    if (mapContainer.current && !mapInstance.current) initializeMap();

    return () => {
      active = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []); // Only runs once on mount

  // Real-Time Telemetry & Tracking Logic
  useEffect(() => {
    if (!mapInstance.current || !liveTelemetry?.position?.latitude || !liveTelemetry?.position?.longitude) return;

    const lat        = liveTelemetry.position.latitude;
    const lng        = liveTelemetry.position.longitude;
    const headingDeg = liveTelemetry.motion?.heading_magnetic || 0; 
    
    // Convert m/s to Knots for the Haversine calculation
    const speedKnots = liveTelemetry.motion?.speed_over_ground ? liveTelemetry.motion.speed_over_ground * 1.94384 : 0;
    
    // Use COG if available, fallback to True Heading if drifting
    const cogDeg = liveTelemetry.motion?.course_over_ground != null ? liveTelemetry.motion.course_over_ground : headingDeg;

    // A. The Asteroids Vessel Marker
    if (!vesselMarker.current) {
      const el = document.createElement('div');
      el.className = 'vessel-marker';
      el.innerHTML = `
        <svg viewBox="0 0 100 100" style="width: 24px; height: 24px; filter: drop-shadow(0px 0px 4px #ff0000);">
          <polygon points="50,10 20,90 50,70 80,90" fill="none" stroke="#ff0000" stroke-width="6" stroke-linejoin="miter"/>
        </svg>
      `;
      // 'map' alignment ensures the SVG rotates perfectly with the canvas
      vesselMarker.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
        .setLngLat([lng, lat])
        .addTo(mapInstance.current);
    }

    // Live update the marker coordinates and rotation
    vesselMarker.current.setLngLat([lng, lat]);
    vesselMarker.current.setRotation(headingDeg);

    // Live Update Predictor Line GeoJSON
    if (mapLoaded.current) {
      const source = mapInstance.current.getSource('predictor-source');
      if (source) {
        source.setData(generatePredictorGeoJSON(lat, lng, speedKnots, cogDeg));
      }
    }

    // Handle Camera Modes
    if (mapMode === 'NORTH_UP') {
      // Lock map to ship, force North (bearing 0) up.
      mapInstance.current.easeTo({ center: [lng, lat], bearing: 0, duration: 1000, easing: t => t });
    } else if (mapMode === 'HEAD_UP') {
      // Lock map to ship, rotate map so vessel's heading is pointing perfectly UP on screen.
      mapInstance.current.easeTo({ center: [lng, lat], bearing: headingDeg, duration: 1000, easing: t => t });
    }
  }, [liveTelemetry, mapMode]);

  // Initialize coordinates immediately when entering FREE_PAN mode
  useEffect(() => {
    if (mapMode === 'FREE_PAN' && mapInstance.current && viewLatRef.current && viewLngRef.current) {
      const center = mapInstance.current.getCenter();
      viewLatRef.current.innerText = formatCoordinate(center.lat, true);
      viewLngRef.current.innerText = formatCoordinate(center.lng, false);

      if (viewDistRef.current && latestTelemetry.current?.position?.latitude != null) {
        const dist = calculateDistanceNM(
          latestTelemetry.current.position.latitude,
          latestTelemetry.current.position.longitude,
          center.lat,
          center.lng
        );
        viewDistRef.current.innerText = `${dist.toFixed(2)} nm`;
      }
    }
  }, [mapMode]);

  return (
    <div className="maps-container">
      {error ? (
        <div className="maps-error">Map error: [{error}]</div>
      ) : (
        <>
          <div ref={mapContainer} className="maps-viewport" />
          
          {/* Tracking Mode Controls UI */}
          <div className="map-mode-controls">
            {['FREE_PAN', 'NORTH_UP', 'HEAD_UP'].map(mode => (
              <button 
                key={mode}
                onClick={() => setMapMode(mode)}
                className={`map-mode-button ${mapMode === mode ? 'active' : ''}`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>
          {/* Map Center Coordinate Display */}
          {mapMode === 'FREE_PAN' && (
            <>
              <div className="map-center-crosshair">
                🞡
              </div>
              <div className="map-view-coords">
                <span>🞡 View:</span>
                <span ref={viewLatRef}>--° --.---' -</span>
                <span className="telemetry-data-divider">┆</span>
                <span ref={viewLngRef}>---° --.---' -</span>
                <span className="telemetry-data-divider">┆</span>
                <span>Range: <span ref={viewDistRef}>--.-- nm</span></span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default NavigationMaps;
