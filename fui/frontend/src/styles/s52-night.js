export const getNightStyle = (mapServerUrl) => ({
  version: 8,
  name: "Cassette Futurism - Night",
  metadata: {},
  sources: {
    "s57-tiles": {
      type: "vector",
      // MapLibre will fetch the TileJSON metadata from this URL,
      // which tells it where the actual /{z}/{x}/{y}.pbf files are.
      url: `${mapServerUrl}/v-cen-b` 
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#000000" // Pitch black water
      }
    },
    {
      id: "LNDARE-fill",
      type: "fill",
      source: "s57-tiles",
      "source-layer": "LNDARE", // Binds directly to the S-57 Land Area layer
      paint: {
        "fill-color": "#1a0000",
        "fill-outline-color": "#330000"
      }
    },
    {
      id: "COALNE-line",
      type: "line",
      source: "s57-tiles",
      "source-layer": "COALNE", // Binds to the S-57 Coastline layer
      paint: {
        "line-color": "#ff0000",
        "line-width": 1.5
      }
    },
    {
     id: "SLCONS-line",
     type: "line",
     source: "s57-tiles",
     "source-layer": "SLCONS", // Binds to man-made shorelines, canals, and piers
     paint: {
       "line-color": "#ff0000",
       "line-width": 1.5
     }
   },
    {
      id: "DEPARE-line",
      type: "line",
      source: "s57-tiles",
      "source-layer": "DEPARE", // Binds to S-57 Depth Areas (contours)
      paint: {
        "line-color": "#330000",
        "line-width": 0.5,
        "line-dasharray": [2, 4]
      }
    }
  ]
});
