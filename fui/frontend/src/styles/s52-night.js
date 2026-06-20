const addLayerBands = (baseId, sourceLayer, type, paint, layout = {}, filter = null, minzoom = null) => {
  const layer = {
      id: baseId,
      type: type,
      source: "s57-tiles",
      "source-layer": sourceLayer,
      paint: paint,
      layout: layout
  };
  if (filter) layer.filter = filter;
  if (minzoom) layer.minzoom = minzoom;
  return [layer];
};

export const getNightStyle = (mapServerUrl) => ({
  version: 8,
  name: "Cassette Futurism - Night V2",
  metadata: {},
  sprite: "/sprites/sprite",
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "s57-tiles": {
      type: "vector",
      url: `${mapServerUrl}/charts` 
    },
    "osm-basemap": {
      type: "vector",
      url: `${mapServerUrl}/osm`
    }
  },
  layers: [
    // 1. BACKGROUND (Ocean Base)
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0a0000" } 
    },

    // 2. S-57 WATER BASE
    ...addLayerBands("DEPARE-fill", "DEPARE", "fill", {
      "fill-color": [
        "step",
        ["to-number", ["get", "DRVAL1"], 0],
        "#550000",    // Shallow water (Default glow)
        2, "#330000", // 2m+ Depth
        5, "#220000", // 5m+ Depth
        10, "#000000" // 10m+ Deep channels fade to pure black
      ]
    }),

    // 3. S-57 LAND BASE
    ...addLayerBands("LNDARE-fill", "LNDARE", "fill", {
      "fill-color": "#1a0000" // Dim red
    }),

    // 4. OSM BASEMAP (Streets drawn over S-57 Land, but UNDER marine infrastructure)
    {
      id: "osm-water",
      type: "fill",
      source: "osm-basemap",
      "source-layer": "water",
      paint: { "fill-color": "#000000" } 
    },
    {
      id: "osm-waterway",
      type: "line",
      source: "osm-basemap",
      "source-layer": "waterway",
      paint: { "line-color": "#000000", "line-width": 1.5 } 
    },
    {
      id: "osm-transportation",
      type: "line",
      source: "osm-basemap",
      "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "residential"],
      paint: { "line-color": "#440000", "line-width": 1 } 
    },
    {
      id: "osm-boundary",
      type: "line",
      source: "osm-basemap",
      "source-layer": "boundary",
      filter: ["==", "admin_level", 2], 
      paint: { "line-color": "#880000", "line-width": 1.5, "line-dasharray": [2, 2] }
    },

    // 5. S-57 DEPTH DETAILS
    ...addLayerBands("DEPCNT-line", "DEPCNT", "line", {
      "line-color": "#aa0000", 
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 12, 1.5],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.2, 12, 1]
    }, {}, null, 9),
    // CONTOUR ERASER LAYER (Bottom layer: purely to cut the line)
    ...addLayerBands("DEPCNT-label-eraser", "DEPCNT", "symbol", {
      "text-color": "#000000",
      "text-halo-color": "#000000",
      "text-halo-width": 3
    }, {
      "text-field": ["get", "VALDCO"], 
      "text-size": 16,
      "symbol-placement": "line", 
      "text-pitch-alignment": "map"
    }),
    // CONTOUR TEXT LAYER (Top layer: bright neon red)
    ...addLayerBands("DEPCNT-label-text", "DEPCNT", "symbol", {
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000", // Thicken text to defeat anti-aliasing dark fade
      "text-halo-width": 0.5
    }, {
      "text-field": ["get", "VALDCO"], 
      "text-size": 16,
      "symbol-placement": "line", 
      "text-pitch-alignment": "map"
    }),
    ...addLayerBands("SOUNDG-label", "SOUNDG", "symbol", {
      "text-color": "#ff0000", 
      "text-opacity": 1,
      "text-halo-color": "#ff0000", // Thicken text to defeat anti-aliasing dark fade
      "text-halo-width": 0.5
    }, {
      "symbol-sort-key": ["to-number", ["get", "VALSOU"]],
      "text-field": ["to-string", ["get", "VALSOU"]],
      "text-size": 16,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-padding": ["interpolate", ["linear"], ["zoom"], 10, 40, 15, 2]
    }, null, 11),
    // 6. S-57 COASTAL BASE
    ...addLayerBands("COALNE-line", "COALNE", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }),
    ...addLayerBands("SLCONS-fill", "SLCONS", "fill", {
      "fill-color": "#440000" 
    }),
    ...addLayerBands("SLCONS-line", "SLCONS", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }),
    ...addLayerBands("DOCARE-fill", "DOCARE", "fill", {
      "fill-color": "#550000"
    }),
    ...addLayerBands("PONTON-fill", "PONTON", "fill", {
      "fill-color": "#880000" 
    }),

    // 7. OSM MARINE OVERLAY (From your 18GB PBF extraction)
    {
      id: "OSMDOCKS-fill",
      type: "fill",
      source: "s57-tiles",
      "source-layer": "OSMDOCKS", // Targets the dedicated layer created by the new script
      paint: { "fill-color": "#880000" } 
    },
    {
      id: "OSMDOCKS-line-outline",
      type: "line",
      source: "s57-tiles",
      "source-layer": "OSMDOCKS",
      paint: { 
        "line-color": "#dd0000", 
        "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, 2, 18, 18] 
      } 
    },
    {
      id: "OSMDOCKS-line-fill",
      type: "line",
      source: "s57-tiles",
      "source-layer": "OSMDOCKS",
      paint: { 
        "line-color": "#880000", 
        "line-width": ["interpolate", ["exponential", 2], ["zoom"], 12, 1, 18, 14] 
      } 
    },

    // 8. S-57 HAZARDS (Zoom 8+)
    ...addLayerBands("UWTROC-icon", "UWTROC", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "hazard-rock",
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": false,
      "text-field": ["coalesce", ["get", "OBJNAM"], "Rk"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null,11),
    ...addLayerBands("WRECKS-icon", "WRECKS", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "hazard-wreck",
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": false,
      "text-field": ["coalesce", ["get", "OBJNAM"], "Wk"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 8),

    // 9. S-57 ATNs (Aids to Navigation - ALWAYS ON TOP)
    ...addLayerBands("DAYMAR-icon", "DAYMAR", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "text-field": ["step", ["zoom"], "", 12, "Daymark"], 
      "text-size": 16
    }, null, 12),
    ...addLayerBands("BOYLAT-icon", "BOYLAT", "symbol", {
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5
    }, {
      "icon-image": [
        "match",
        ["get", "COLOUR"],
        "3", "boy-port",      
        "4", "boy-starboard", 
        "boy-safe-water"      
      ],
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"], 
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 11),
    ...addLayerBands("BOYSPP-icon", "BOYSPP", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "boy-special-purpose",  
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 12),
    ...addLayerBands("BCNSPP-icon", "BCNSPP", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "boy-special-purpose", 
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 12),
    ...addLayerBands("BOYISD-icon", "BOYISD", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "boy-isolated-danger", 
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 10),
    ...addLayerBands("BOYCAR-icon", "BOYCAR", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": [
        "match",
        ["to-string", ["get", "CATCAM"]],
        "1", "boy-cardinal-north",
        "2", "boy-cardinal-east",
        "3", "boy-cardinal-south",
        "4", "boy-cardinal-west",
        "boy-isolated-danger" // Fallback icon
      ],
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 11),
    ...addLayerBands("BCNCAR-icon", "BCNCAR", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": [
        "match",
        ["to-string", ["get", "CATCAM"]],
        "1", "boy-cardinal-north",
        "2", "boy-cardinal-east",
        "3", "boy-cardinal-south",
        "4", "boy-cardinal-west",
        "boy-isolated-danger"
      ],
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 11),
    ...addLayerBands("BOYSAW-icon", "BOYSAW", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "boy-safe-water", 
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 10),
    ...addLayerBands("BCNSAW-icon", "BCNSAW", "symbol", { 
      "text-color": "#ff0000",
      "text-halo-color": "#ff0000",
      "text-halo-width": 0.5 
    }, {
      "icon-image": "boy-safe-water", 
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 2.5],
      "text-size": 16
    }, null, 10),
    ...addLayerBands("LIGHTS-icon", "LIGHTS", "symbol", {}, {
      "icon-image": "light-flare",
      "icon-optional": true,
      "icon-size": 0.5,
      "icon-allow-overlap": true
    }, null, 10)
  ]
});
