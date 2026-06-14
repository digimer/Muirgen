const addLayerBands = (baseId, sourceLayerPrefix, type, paint, availableLayers, layout = {}) => {
  // Band 1 (Overview): Zooms 0-6
  // Band 2 (General): Zooms 6-9
  // Band 3 (Coastal): Zooms 9-11
  // Band 4 (Approach): Zooms 11-13
  // Band 5 (Harbour): Zooms 13-15
  // Band 6 (Berthing): Zooms 15-22
  const minZooms = [0, 6, 9, 11, 13, 15];
  const maxZooms = [6, 9, 11, 13, 15, 22];

  return [1, 2, 3, 4, 5, 6]
    .filter(band => {
      // Only return the band if it actually exists in the tile server metadata
      if (availableLayers) {
        return availableLayers.includes(`${sourceLayerPrefix}-${band}`);
      }
      return true;
    })
    .map(band => ({
        id: `${baseId}-${band}`,
        type: type,
        source: "s57-tiles",
        "source-layer": `${sourceLayerPrefix}-${band}`,
        minzoom: minZooms[band - 1],
        maxzoom: maxZooms[band - 1],
        paint: paint,
        layout: layout
    }));
};

export const getNightStyle = (mapServerUrl, availableLayers) => ({
  version: 8,
  name: "Cassette Futurism - Night",
  metadata: {},
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
        "background-color": "#000000" // Pitch black water
      }
    },
    // OSM Terrestrial Basemap (Renders underneath marine charts)
    {
      id: "osm-land",
      type: "fill",
      source: "osm-basemap",
      "source-layer": "landcover",
      paint: { "fill-color": "#050000" } // Very faint dark red for terrestrial landmasses
    },
    {
      id: "osm-water",
      type: "fill",
      source: "osm-basemap",
      "source-layer": "water",
      paint: { "fill-color": "#000000" } // Pitch black for inland lakes/rivers
    },
    {
      id: "osm-transportation",
      type: "line",
      source: "osm-basemap",
      "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary"], // Only major highways to prevent UI clutter
      paint: { "line-color": "#2a0000", "line-width": 1 } 
    },
    {
      id: "osm-boundary",
      type: "line",
      source: "osm-basemap",
      "source-layer": "boundary",
      filter: ["==", "admin_level", 2], // Only country borders
      paint: { "line-color": "#550000", "line-width": 1.5, "line-dasharray": [2, 2] }
    },
    ...addLayerBands("LNDARE-fill", "LNDARE", "fill", {
      "fill-color": "#1a0000",
      "fill-outline-color": "#330000"
    }, availableLayers),
    ...addLayerBands("COALNE-line", "COALNE", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }, availableLayers),
    ...addLayerBands("SLCONS-line", "SLCONS", "line", {
      "line-color": "#ff0000",
      "line-width": 1.5
    }, availableLayers),
    ...addLayerBands("DEPARE-line", "DEPARE", "line", {
      "line-color": "#330000",
      "line-width": 0.5,
      "line-dasharray": [2, 4]
    }, availableLayers)
  ]
});
