import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Maximize2,
  Minimize2,
  Loader2,
  Navigation,
  Layers,
  CheckCircle2,
  Radio,
  Sparkles
} from 'lucide-react';
import {
  ClimateDataset,
  EpwStationSearchResult,
  loadEnergyPlusStationCatalog,
  findNearestEpwStations,
  haversineKm
} from '../utils/epwEngine';

interface EpwInteractiveMapProps {
  currentClimate: ClimateDataset;
  onSelectStation: (station: EpwStationSearchResult) => Promise<void>;
  loadingStationId: string | null;
  focusedStation?: EpwStationSearchResult | null;
}

type TileStyleId = 'esri_street' | 'esri_topo' | 'esri_sat' | 'osm' | 'vector_only';

const TILE_LAYERS: Record<
  Exclude<TileStyleId, 'vector_only'>,
  {
    name: string;
    proxyUrl: string;
    directUrl: string;
    attribution: string;
  }
> = {
  esri_street: {
    name: 'Esri World Street (No API Key)',
    proxyUrl: '/map-esri/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    directUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap'
  },
  esri_topo: {
    name: 'Esri World Topographic (Terrain)',
    proxyUrl: '/map-esri/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    directUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, USGS, NOAA, OpenStreetMap'
  },
  esri_sat: {
    name: 'Esri Satellite Imagery',
    proxyUrl: '/map-esri/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    directUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  },
  osm: {
    name: 'OpenStreetMap Standard',
    proxyUrl: '/map-osm/{z}/{x}/{y}.png',
    directUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  }
};

export const EpwInteractiveMap: React.FC<EpwInteractiveMapProps> = ({
  currentClimate,
  onSelectStation,
  loadingStationId,
  focusedStation
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vectorBaseLayerRef = useRef<L.LayerGroup | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const activeMarkerRef = useRef<L.LayerGroup | null>(null);
  const clickedMarkerRef = useRef<L.LayerGroup | null>(null);
  const selectedHighlightRef = useRef<L.LayerGroup | null>(null);
  const worldGeoJsonCacheRef = useRef<any | null>(null);

  const [catalog, setCatalog] = useState<EpwStationSearchResult[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<(EpwStationSearchResult & { distanceKm?: number }) | null>(null);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearestStations, setNearestStations] = useState<Array<EpwStationSearchResult & { distanceKm: number }>>([]);
  const [tileStyle, setTileStyle] = useState<TileStyleId>('esri_topo');
  const [expanded, setExpanded] = useState(false);

  // 1. Load 3,000+ NREL EnergyPlus stations on mount
  useEffect(() => {
    let mounted = true;
    setCatalogLoading(true);
    loadEnergyPlusStationCatalog().then((list) => {
      if (!mounted) return;
      setCatalog(list);
      setCatalogLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Helper to attach tile layer with automatic proxy -> direct URL fallback
  const applyTileLayer = (map: L.Map, style: TileStyleId) => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (style === 'vector_only') {
      return;
    }

    const cfg = TILE_LAYERS[style];
    let switchedToDirect = false;

    const tl = L.tileLayer(cfg.proxyUrl, {
      attribution: cfg.attribution,
      maxZoom: 18
    });

    tl.on('tileerror', () => {
      if (!switchedToDirect && mapInstanceRef.current) {
        switchedToDirect = true;
        tl.setUrl(cfg.directUrl);
      }
    });

    tl.addTo(map);
    tileLayerRef.current = tl;
  };

  // Helper to render local Vector World Countries + Lat/Lon Graticule
  const renderVectorWorldBase = async (style: TileStyleId) => {
    const vLayer = vectorBaseLayerRef.current;
    if (!vLayer) return;
    vLayer.clearLayers();

    const isVectorOnly = style === 'vector_only';

    // Draw latitude / longitude graticule lines
    const graticuleColor = isVectorOnly ? '#334155' : 'rgba(100,116,139,0.22)';
    for (let lat = -60; lat <= 80; lat += 20) {
      L.polyline(
        [
          [lat, -180],
          [lat, 180]
        ],
        { color: graticuleColor, weight: 0.7, dashArray: '3 3', interactive: false }
      ).addTo(vLayer);
    }
    for (let lon = -160; lon <= 160; lon += 20) {
      L.polyline(
        [
          [-80, lon],
          [85, lon]
        ],
        { color: graticuleColor, weight: 0.7, dashArray: '3 3', interactive: false }
      ).addTo(vLayer);
    }

    try {
      if (!worldGeoJsonCacheRef.current) {
        const res = await fetch('/world-countries.geojson');
        if (res.ok) {
          worldGeoJsonCacheRef.current = await res.json();
        }
      }
      if (worldGeoJsonCacheRef.current) {
        L.geoJSON(worldGeoJsonCacheRef.current, {
          interactive: false,
          style: () =>
            isVectorOnly
              ? {
                  fillColor: '#1e293b',
                  fillOpacity: 0.92,
                  color: '#38bdf8',
                  weight: 1.1,
                  opacity: 0.75
                }
              : {
                  fillColor: '#cbd5e1',
                  fillOpacity: 0.05,
                  color: '#64748b',
                  weight: 0.7,
                  opacity: 0.35
                }
        }).addTo(vLayer);
      }
    } catch {
      // Ignore if vector overlay fails
    }
  };

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentClimate.lat, currentClimate.lon],
      zoom: 6,
      preferCanvas: true,
      zoomControl: true
    });

    vectorBaseLayerRef.current = L.layerGroup().addTo(map);
    applyTileLayer(map, tileStyle);
    renderVectorWorldBase(tileStyle);

    stationsLayerRef.current = L.layerGroup().addTo(map);
    selectedHighlightRef.current = L.layerGroup().addTo(map);
    activeMarkerRef.current = L.layerGroup().addTo(map);
    clickedMarkerRef.current = L.layerGroup().addTo(map);

    // Map click handler: drop site pin and find nearest EPW stations
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat: +lat.toFixed(4), lon: +lng.toFixed(4) });
      const nearest = await findNearestEpwStations(lat, lng, 5);
      setNearestStations(nearest);
      if (nearest.length > 0) {
        setSelectedStation(nearest[0]);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 3. Switch tile layer style when tileStyle changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    applyTileLayer(map, tileStyle);
    renderVectorWorldBase(tileStyle);
  }, [tileStyle]);

  // 4. Invalidate map size when expanded/collapsed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [expanded]);

  // 5. Render all 3,000+ official EnergyPlus weather station markers on Canvas
  useEffect(() => {
    const layer = stationsLayerRef.current;
    if (!layer || catalog.length === 0) return;

    layer.clearLayers();
    const canvasRenderer = L.canvas({ padding: 0.5 });

    catalog.forEach((st) => {
      const marker = L.circleMarker([st.lat, st.lon], {
        renderer: canvasRenderer,
        radius: 5,
        fillColor: '#f59e0b',
        color: '#78350f',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      marker.bindTooltip(
        `<div style="font-size:11px;font-weight:700;">${st.city} (${st.country})</div><div style="font-size:10px;color:#475569;">${st.title}<br/>Lat ${st.lat.toFixed(2)}°, Lon ${st.lon.toFixed(2)}° • Click to select</div>`,
        { direction: 'top', offset: [0, -4] }
      );

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        const refLat = clickedCoords ? clickedCoords.lat : currentClimate.lat;
        const refLon = clickedCoords ? clickedCoords.lon : currentClimate.lon;
        const dist = +haversineKm(refLat, refLon, st.lat, st.lon).toFixed(1);
        setSelectedStation({ ...st, distanceKm: dist });
      });

      marker.addTo(layer);
    });
  }, [catalog, currentClimate.lat, currentClimate.lon, clickedCoords]);

  // 6. Highlight currently selected station & draw distance vector line
  useEffect(() => {
    const hLayer = selectedHighlightRef.current;
    if (!hLayer) return;
    hLayer.clearLayers();
    if (!selectedStation) return;

    const refLat = clickedCoords ? clickedCoords.lat : currentClimate.lat;
    const refLon = clickedCoords ? clickedCoords.lon : currentClimate.lon;

    // Dashed distance line between reference site and selected EPW station
    L.polyline(
      [
        [refLat, refLon],
        [selectedStation.lat, selectedStation.lon]
      ],
      {
        color: '#f59e0b',
        weight: 2,
        dashArray: '4 4',
        opacity: 0.9
      }
    ).addTo(hLayer);

    // Highlight halo around selected station
    L.circleMarker([selectedStation.lat, selectedStation.lon], {
      radius: 11,
      fillColor: '#fbbf24',
      color: '#ffffff',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 0.35
    }).addTo(hLayer);
  }, [selectedStation, clickedCoords, currentClimate.lat, currentClimate.lon]);

  // 7. When parent search focuses a station, fly to it and compute nearest EPW stations
  useEffect(() => {
    if (!focusedStation || !mapInstanceRef.current) return;
    const dist = +haversineKm(
      currentClimate.lat,
      currentClimate.lon,
      focusedStation.lat,
      focusedStation.lon
    ).toFixed(1);
    setSelectedStation({ ...focusedStation, distanceKm: dist });
    mapInstanceRef.current.flyTo([focusedStation.lat, focusedStation.lon], 8, {
      duration: 0.7
    });
    findNearestEpwStations(focusedStation.lat, focusedStation.lon, 5).then((nearest) => {
      setNearestStations(nearest);
    });
  }, [focusedStation]);

  // 8. Update Active Climate Station Marker & flyTo when currentClimate changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const activeLayer = activeMarkerRef.current;
    if (!map || !activeLayer) return;

    activeLayer.clearLayers();

    // Outer pulsing halo
    L.circleMarker([currentClimate.lat, currentClimate.lon], {
      radius: 14,
      fillColor: '#14b8a6',
      color: '#0d9488',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.25
    }).addTo(activeLayer);

    // Inner bullseye
    const centerPin = L.circleMarker([currentClimate.lat, currentClimate.lon], {
      radius: 6,
      fillColor: '#0f766e',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(activeLayer);

    centerPin.bindTooltip(
      `<div style="font-size:11px;font-weight:700;color:#0f766e;">★ Active Station: ${currentClimate.name}</div><div style="font-size:10px;">${currentClimate.lat.toFixed(2)}°N, ${currentClimate.lon.toFixed(2)}°E • Köppen ${currentClimate.koppen}</div>`,
      { permanent: false, direction: 'top' }
    );

    map.flyTo([currentClimate.lat, currentClimate.lon], Math.max(map.getZoom(), 6), {
      duration: 0.8
    });

    // Update nearest stations list around active station
    findNearestEpwStations(currentClimate.lat, currentClimate.lon, 5).then((nearest) => {
      setNearestStations(nearest);
    });
  }, [currentClimate.id, currentClimate.lat, currentClimate.lon, currentClimate.name, currentClimate.koppen]);

  // 9. Render clicked arbitrary map coordinate pin
  useEffect(() => {
    const clickedLayer = clickedMarkerRef.current;
    if (!clickedLayer) return;
    clickedLayer.clearLayers();
    if (!clickedCoords) return;

    L.circleMarker([clickedCoords.lat, clickedCoords.lon], {
      radius: 7,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    })
      .bindTooltip(
        `<div style="font-size:11px;font-weight:700;color:#1d4ed8;">Selected Map Pin</div><div style="font-size:10px;">Lat ${clickedCoords.lat}°, Lon ${clickedCoords.lon}°</div>`,
        { permanent: false, direction: 'top' }
      )
      .addTo(clickedLayer);
  }, [clickedCoords]);

  return (
    <div
      className={
        expanded
          ? 'fixed inset-4 z-50 bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl p-4 flex flex-col gap-3'
          : 'bg-slate-800/90 rounded-xl border border-slate-700 p-2.5 space-y-2.5'
      }
    >
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-bold text-teal-300">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            Interactive EPW Weather Station Map
          </span>
          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
            {catalogLoading ? 'Loading NREL GeoJSON...' : `${catalog.length.toLocaleString()} Official EPW Stations`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Map Layer Style Selector (All Keyless Free Providers + Local Vector) */}
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
            <Layers className="w-3 h-3 text-slate-400" />
            <select
              value={tileStyle}
              onChange={(e) => setTileStyle(e.target.value as TileStyleId)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="esri_topo" className="bg-slate-900">Esri Topographic (No Key)</option>
              <option value="esri_street" className="bg-slate-900">Esri World Street (No Key)</option>
              <option value="esri_sat" className="bg-slate-900">Esri Satellite Imagery</option>
              <option value="osm" className="bg-slate-900">OpenStreetMap (Proxied)</option>
              <option value="vector_only" className="bg-slate-900">Offline Vector Blueprint</option>
            </select>
          </div>

          {/* Recenter on Active Station */}
          <button
            type="button"
            onClick={() => {
              mapInstanceRef.current?.flyTo([currentClimate.lat, currentClimate.lon], 7, { duration: 0.6 });
            }}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-semibold flex items-center gap-1"
            title="Center map on currently active station"
          >
            <Navigation className="w-3 h-3 text-teal-400" />
            Center
          </button>

          {/* Toggle Fullscreen Modal */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold flex items-center gap-1"
          >
            {expanded ? (
              <>
                <Minimize2 className="w-3 h-3" />
                Close Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                Expand Map
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Map Container + Side/Bottom Inspector */}
      <div className={expanded ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0' : 'space-y-2'}>
        {/* Leaflet Canvas Container */}
        <div
          className={`${
            expanded
              ? 'lg:col-span-8 h-full min-h-[380px] rounded-xl'
              : 'w-full h-60 rounded-lg'
          } overflow-hidden border border-slate-600 relative ${
            tileStyle === 'vector_only' ? 'bg-slate-950' : 'bg-slate-200'
          }`}
        >
          <div
            ref={mapContainerRef}
            className="w-full h-full z-10"
            style={{ background: tileStyle === 'vector_only' ? '#090d16' : '#e2e8f0' }}
          />

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-2 left-2 z-20 bg-slate-900/90 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-lg border border-slate-700 text-[10px] flex flex-wrap items-center gap-3 pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 border border-white inline-block" />
              Active: {currentClimate.name.split(',')[0]} ({currentClimate.lat.toFixed(2)}°N, {currentClimate.lon.toFixed(2)}°E)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Official EnergyPlus Station (.epw)
            </span>
            <span className="text-slate-400 hidden sm:inline">Click any orange dot or map location</span>
          </div>
        </div>

        {/* Station Inspector & Nearest Stations List */}
        <div className={expanded ? 'lg:col-span-4 flex flex-col gap-3 overflow-y-auto pr-1' : 'space-y-2'}>
          {/* Currently Selected Station on Map */}
          {selectedStation && (
            <div className="bg-slate-900 p-2.5 rounded-lg border border-amber-500/50 flex items-center justify-between gap-2 text-xs">
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-bold text-amber-300 truncate">
                    {selectedStation.city}, {selectedStation.country}
                  </span>
                  {selectedStation.distanceKm !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      {selectedStation.distanceKm} km
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {selectedStation.title} • Lat {selectedStation.lat.toFixed(2)}°, Lon {selectedStation.lon.toFixed(2)}°
                </div>
              </div>

              <button
                type="button"
                disabled={loadingStationId === selectedStation.id}
                onClick={() => onSelectStation(selectedStation)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 flex items-center gap-1 transition"
              >
                {loadingStationId === selectedStation.id ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Use Station
                  </>
                )}
              </button>
            </div>
          )}

          {/* Custom Clicked Coordinate ERA5 TMY Synthesizer */}
          {clickedCoords && (
            <div className="bg-slate-900/90 p-2 rounded-lg border border-sky-500/40 flex items-center justify-between gap-2 text-xs">
              <div className="truncate">
                <div className="font-semibold text-sky-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Clicked Site: {clickedCoords.lat}°N, {clickedCoords.lon}°E
                </div>
                <div className="text-[10px] text-slate-400">
                  Pick a nearby station below or synthesize exact local ERA5 TMY
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onSelectStation({
                    id: `om_pin_${clickedCoords.lat}_${clickedCoords.lon}`,
                    title: `Custom Pin (${clickedCoords.lat}°N, ${clickedCoords.lon}°E)`,
                    city: `Site ${clickedCoords.lat.toFixed(2)}N ${clickedCoords.lon.toFixed(2)}E`,
                    country: 'ERA5',
                    lat: clickedCoords.lat,
                    lon: clickedCoords.lon,
                    epwUrl: '',
                    source: 'open-meteo'
                  })
                }
                className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold shrink-0"
              >
                Synthesize Exact Pin
              </button>
            </div>
          )}

          {/* Nearest Official EPW Stations Radar List */}
          {nearestStations.length > 0 && (
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                <span>
                  Nearest Official EPW Stations {clickedCoords ? 'to Clicked Pin' : 'to Active Site'}
                </span>
                <span>Distance</span>
              </div>
              <div className="divide-y divide-slate-800 max-h-36 overflow-y-auto">
                {nearestStations.map((st) => (
                  <div
                    key={st.id}
                    className="py-1.5 flex items-center justify-between gap-2 text-[11px] hover:bg-slate-800/60 px-1 rounded cursor-pointer"
                    onClick={() => {
                      setSelectedStation(st);
                      mapInstanceRef.current?.flyTo([st.lat, st.lon], 8, { duration: 0.5 });
                    }}
                  >
                    <div className="truncate">
                      <span className="font-semibold text-slate-200">{st.city}</span>{' '}
                      <span className="text-[10px] text-slate-400">({st.country})</span>
                      <span className="block text-[9px] text-slate-500 truncate">{st.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-teal-300">{st.distanceKm} km</span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectStation(st);
                        }}
                        className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
