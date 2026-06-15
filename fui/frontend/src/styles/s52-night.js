const addLayerBands = (baseId, sourceLayer, type, paint, layout = {}) => {
  // Tippecanoe natively culls features by zoom level inside the vector tile.
  // We return a single layer in an array so the `...` spread operator still works below.
  return [{
      id: baseId,
      type: type,
      source: "s57-tiles",
      "source-layer": sourceLayer,
      paint: paint,
      layout: layout
  }];
};

export const getNightStyle = (mapServerUrl, availableLayers) => ({
  version: 8,
  name: "Cassette Futurism - Night",
  metadata: {},
  sprite: `${mapServerUrl}/sprites/sprite`,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "s57-tiles": {
      type: "vector",
      // MapLibre will fetch the TileJSON metadata from this URL,
      // which tells it where the actual /{z}/{x}/{y}.pbf files are.
      url: `${mapServerUrl}/charts` 
    },
    "osm-basemap": {
      type: "vector",
      url: `${mapServerUrl}/osm`
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#0a0000" // Faint red for all default landmasses
      }
    },
    {
      id: "osm-water",
      type: "fill",
      source: "osm-basemap",
      "source-layer": "water",
      paint: { "fill-color": "#000000" } // Pitch black for inland lakes/rivers
    },
    {
      id: "osm-waterway",
      type: "line",
      source: "osm-basemap",
      "source-layer": "waterway",
      paint: { "line-color": "#000000", "line-width": 1.5 } // Pitch black for canals and narrow rivers
    },
    {
      id: "osm-transportation",
      type: "line",
      source: "osm-basemap",
      "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary"], // Only major highways to prevent UI clutter
      paint: { "line-color": "#550000", "line-width": 1 } 
    },
    {
      id: "osm-boundary",
      type: "line",
      source: "osm-basemap",
      "source-layer": "boundary",
      filter: ["==", "admin_level", 2], // Only country borders
      paint: { "line-color": "#880000", "line-width": 1.5, "line-dasharray": [2, 2] }
    },
    // --- LAND & STRUCTURES ---
    ...addLayerBands("COALNE-line", "COALNE", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }),
    ...addLayerBands("SLCONS-fill", "SLCONS", "fill", {
      "fill-color": "#440000" // Solid red for Shoreline Constructions
    }),
    ...addLayerBands("SLCONS-line", "SLCONS", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }),
    ...addLayerBands("DOCARE-fill", "DOCARE", "fill", {
      "fill-color": "#550000", // Bright solid red for docks
    }),
    ...addLayerBands("DOCARE-line", "DOCARE", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }),
    ...addLayerBands("PONTON-fill", "PONTON", "fill", {
      "fill-color": "#880000" // Brightest red for floating pontoons
    }),
    ...addLayerBands("PONTON-line", "PONTON", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }),

    // --- WATER & CHANNELS ---
    ...addLayerBands("DEPARE-fill", "DEPARE", "fill", {
      "fill-color": [
        "step",
        ["to-number", ["get", "DRVAL1"], 0], // Read the Depth Range 1 attribute
        "#110000",    // Shallow water (Default glow)
        2, "#0a0000", // 2m+ Depth
        5, "#050000", // 5m+ Depth
        10, "#000000" // 10m+ Deep channels fade to pure black
      ]
    }),
    ...addLayerBands("DEPCNT-line", "DEPCNT", "line", {
      "line-color": "#440000", // Medium red depth contour lines
      "line-width": 1
    }),
    ...addLayerBands("DEPCNT-label", "DEPCNT", "symbol", {
      "text-color": "#660000" // Faint red text for depths
    }, {
      "text-field": ["get", "VALDCO"], // Print the exact depth value!
      "text-size": 10,
      "symbol-placement": "line", // Align the text along the curvy contour line
      "text-pitch-alignment": "map"
    }),

    // --- BUOYS & NAVIGATION AIDS ---
    ...addLayerBands("BOYLAT-icon", "BOYLAT", "symbol", {
      "text-color": "#ff0000"
    }, {
      "icon-image": [
        "match",
        ["get", "COLOUR"],
        "3", "boy-port",      // S-57 Colour 3 = Red
        "4", "boy-starboard", // S-57 Colour 4 = Green
        "boy-safe-water"      // Fallback
      ],
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"], // Display the Buoy's Name!
      "text-offset": [0, 1.2],
      "text-size": 10
    }),
    ...addLayerBands("BOYSPP-icon", "BOYSPP", "symbol", { "text-color": "#ff0000" }, {
      "icon-image": "boy-safe-water", 
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 1.2],
      "text-size": 10
    }),
    ...addLayerBands("BOYISD-icon", "BOYISD", "symbol", { "text-color": "#ff0000" }, {
      "icon-image": "boy-isolated-danger", 
      "icon-size": 0.5,
      "icon-allow-overlap": true,
      "text-field": ["get", "OBJNAM"],
      "text-offset": [0, 1.2],
      "text-size": 10
    }),
    ...addLayerBands("LIGHTS-icon", "LIGHTS", "symbol", {}, {
      "icon-image": "light-flare",
      "icon-size": 0.5,
      "icon-allow-overlap": true
    })
  ]
});
