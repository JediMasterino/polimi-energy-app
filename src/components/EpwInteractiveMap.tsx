import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Sparkles,
  Search,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Download,
  Check,
  RefreshCw
} from 'lucide-react';
import {
  ClimateDataset,
  EpwStationSearchResult,
  OneBuildingPeriod,
  AVAILABLE_ONEBUILDING_PERIODS,
  getOneBuildingDownloadUrl,
  loadEnergyPlusStationCatalog,
  findNearestEpwStations,
  searchGlobalEpwStations,
  haversineKm
} from '../utils/epwEngine';

interface EpwInteractiveMapProps {
  currentClimate: ClimateDataset;
  onSelectStation: (station: EpwStationSearchResult, period?: OneBuildingPeriod) => Promise<void>;
  loadingStationId: string | null;
  focusedStation?: EpwStationSearchResult | null;
  oneBuildingPeriod: OneBuildingPeriod;
  onChangeOneBuildingPeriod: (period: OneBuildingPeriod) => void;
  sourceFilter: 'all' | 'onebuilding' | 'energyplus';
  onChangeSourceFilter: (filter: 'all' | 'onebuilding' | 'energyplus') => void;
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

function calcCompassBearing(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(brng / 45) % 8];
}

export const EpwInteractiveMap: React.FC<EpwInteractiveMapProps> = ({
  currentClimate,
  onSelectStation,
  loadingStationId,
  focusedStation,
  oneBuildingPeriod,
  onChangeOneBuildingPeriod,
  sourceFilter,
  onChangeSourceFilter
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vectorBaseLayerRef = useRef<L.LayerGroup | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const activeMarkerRef = useRef<L.LayerGroup | null>(null);
  const clickedMarkerRef = useRef<L.LayerGroup | null>(null);
  const selectedHighlightRef = useRef<L.LayerGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const worldGeoJsonCacheRef = useRef<any | null>(null);

  const [catalog, setCatalog] = useState<EpwStationSearchResult[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(0);
  const [selectedStation, setSelectedStation] = useState<(EpwStationSearchResult & { distanceKm?: number }) | null>(null);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearestStations, setNearestStations] = useState<Array<EpwStationSearchResult & { distanceKm: number }>>([]);
  const [tileStyle, setTileStyle] = useState<TileStyleId>('esri_topo');
  const [expanded, setExpanded] = useState(false);

  // Station-specific period selector (defaults to current global setting)
  const [stationActivePeriod, setStationActivePeriod] = useState<OneBuildingPeriod>(oneBuildingPeriod);

  useEffect(() => {
    setStationActivePeriod(oneBuildingPeriod);
  }, [oneBuildingPeriod, selectedStation?.id]);

  // Find co-located alternative weather datasets (e.g. DOE EnergyPlus IGDG vs OneBuilding TMYx)
  const coLocatedStations = React.useMemo(() => {
    if (!selectedStation || catalog.length === 0) return [];
    return catalog
      .filter(
        (s) =>
          s.id !== selectedStation.id &&
          ((selectedStation.wmo && s.wmo && s.wmo === selectedStation.wmo) ||
            haversineKm(selectedStation.lat, selectedStation.lon, s.lat, s.lon) < 25)
      )
      .slice(0, 4);
  }, [selectedStation, catalog]);

  // Find catalog station corresponding to current active climate
  const activeStationInCatalog = React.useMemo(() => {
    if (!catalog || catalog.length === 0) return null;
    if (currentClimate.wmo) {
      const byWmo = catalog.find((st) => st.wmo === currentClimate.wmo && st.source === 'onebuilding');
      if (byWmo) return byWmo;
    }
    return (
      catalog.find(
        (st) =>
          st.source === 'onebuilding' &&
          haversineKm(currentClimate.lat, currentClimate.lon, st.lat, st.lon) < 10
      ) || null
    );
  }, [catalog, currentClimate.wmo, currentClimate.lat, currentClimate.lon]);

  // In-map quick filter / search (especially useful in Fullscreen mode)
  const [mapQuery, setMapQuery] = useState('');
  const [mapSearching, setMapSearching] = useState(false);

  // 1. Load 23,227+ Combined Ladybug epwmap (Climate.OneBuilding.org + DOE EnergyPlus) catalog on mount
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

  // Viewport-culled Canvas renderer for all 23,227 stations (keeps 60 FPS at all zoom levels)
  const renderViewportStations = useCallback(() => {
    const map = mapInstanceRef.current;
    const layer = stationsLayerRef.current;
    if (!map || !layer || catalog.length === 0) return;

    layer.clearLayers();
    if (!canvasRendererRef.current) {
      canvasRendererRef.current = L.canvas({ padding: 0.35 });
    }
    const renderer = canvasRendererRef.current;

    const bounds = map.getBounds().pad(0.2);
    const zoom = map.getZoom();

    // Filter stations inside current map viewport bounds & matching sourceFilter
    const inBounds: EpwStationSearchResult[] = [];
    for (let i = 0; i < catalog.length; i++) {
      const st = catalog[i];
      if (sourceFilter !== 'all' && st.source !== sourceFilter) continue;
      if (bounds.contains([st.lat, st.lon])) {
        inBounds.push(st);
      }
    }

    // At global zoom-out, cap markers to 3,200 with stride sampling so canvas redraw is instantaneous;
    // at regional/country zoom (zoom >= 5 or <= 3,200 stations in view), show 100% of stations!
    const maxRender = zoom >= 6 ? 8000 : 3200;
    const stride = inBounds.length > maxRender ? Math.ceil(inBounds.length / maxRender) : 1;
    const radius = zoom >= 8 ? 5.5 : zoom >= 6 ? 4.5 : 3.5;

    let rendered = 0;
    const refLat = clickedCoords ? clickedCoords.lat : currentClimate.lat;
    const refLon = clickedCoords ? clickedCoords.lon : currentClimate.lon;

    for (let i = 0; i < inBounds.length; i += stride) {
      const st = inBounds[i];
      const isOneBuilding = st.source === 'onebuilding';
      const marker = L.circleMarker([st.lat, st.lon], {
        renderer,
        radius,
        fillColor: isOneBuilding ? '#0ea5e9' : '#f59e0b',
        color: isOneBuilding ? '#0369a1' : '#78350f',
        weight: 1,
        opacity: 0.92,
        fillOpacity: 0.85
      });

      const badgeLabel = isOneBuilding ? 'Climate.OneBuilding.org' : 'DOE / NREL EnergyPlus';
      const badgeColor = isOneBuilding ? '#0284c7' : '#d97706';

      marker.bindTooltip(
        `<div style="font-size:11px;font-weight:700;">${st.city} (${st.country})</div>` +
          `<div style="font-size:10px;color:${badgeColor};font-weight:600;">${badgeLabel} • ${st.datasetType || 'TMYx'}</div>` +
          `<div style="font-size:10px;color:#475569;">WMO ${st.wmo || '-'} • Lat ${st.lat.toFixed(2)}°, Lon ${st.lon.toFixed(2)}°</div>`,
        { direction: 'top', offset: [0, -4] }
      );

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        const dist = +haversineKm(refLat, refLon, st.lat, st.lon).toFixed(1);
        setSelectedStation({ ...st, distanceKm: dist });
      });

      marker.addTo(layer);
      rendered++;
    }

    setVisibleCount(inBounds.length);
  }, [catalog, sourceFilter, clickedCoords, currentClimate.lat, currentClimate.lon]);

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

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Attach map click & moveend/zoomend listeners
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat: +lat.toFixed(4), lon: +lng.toFixed(4) });
      const nearest = await findNearestEpwStations(lat, lng, 8, sourceFilter);
      setNearestStations(nearest);
      if (nearest.length > 0) {
        setSelectedStation(nearest[0]);
      }
    };

    map.on('click', handleMapClick);
    map.on('moveend', renderViewportStations);
    map.on('zoomend', renderViewportStations);

    renderViewportStations();

    return () => {
      map.off('click', handleMapClick);
      map.off('moveend', renderViewportStations);
      map.off('zoomend', renderViewportStations);
    };
  }, [renderViewportStations, sourceFilter]);

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
      renderViewportStations();
    }, 150);
    return () => clearTimeout(timer);
  }, [expanded, renderViewportStations]);

  // 5. Highlight currently selected station & draw distance vector line
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
        color: selectedStation.source === 'onebuilding' ? '#38bdf8' : '#f59e0b',
        weight: 2,
        dashArray: '4 4',
        opacity: 0.95
      }
    ).addTo(hLayer);

    // Highlight halo around selected station
    L.circleMarker([selectedStation.lat, selectedStation.lon], {
      radius: 11,
      fillColor: selectedStation.source === 'onebuilding' ? '#38bdf8' : '#fbbf24',
      color: '#ffffff',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 0.4
    }).addTo(hLayer);
  }, [selectedStation, clickedCoords, currentClimate.lat, currentClimate.lon]);

  // 6. When parent search focuses a station, fly to it and compute nearest EPW stations
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
    findNearestEpwStations(focusedStation.lat, focusedStation.lon, 8, sourceFilter).then((nearest) => {
      setNearestStations(nearest);
    });
  }, [focusedStation, sourceFilter]);

  // 7. Update Active Climate Station Marker & flyTo when currentClimate changes
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
    findNearestEpwStations(currentClimate.lat, currentClimate.lon, 8, sourceFilter).then((nearest) => {
      setNearestStations(nearest);
    });
  }, [currentClimate.id, currentClimate.lat, currentClimate.lon, currentClimate.name, currentClimate.koppen, sourceFilter]);

  // 8. Render clicked arbitrary map coordinate pin
  useEffect(() => {
    const clickedLayer = clickedMarkerRef.current;
    if (!clickedLayer) return;
    clickedLayer.clearLayers();
    if (!clickedCoords) return;

    L.circleMarker([clickedCoords.lat, clickedCoords.lon], {
      radius: 7,
      fillColor: '#ec4899',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    })
      .bindTooltip(
        `<div style="font-size:11px;font-weight:700;color:#be185d;">Selected Map Pin</div><div style="font-size:10px;">Lat ${clickedCoords.lat}°, Lon ${clickedCoords.lon}°</div>`,
        { permanent: false, direction: 'top' }
      )
      .addTo(clickedLayer);
  }, [clickedCoords]);

  const handleInMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mapQuery.trim().length < 2) return;
    setMapSearching(true);
    try {
      const res = await searchGlobalEpwStations(mapQuery, sourceFilter);
      if (res.length > 0) {
        const top = res[0];
        const dist = +haversineKm(currentClimate.lat, currentClimate.lon, top.lat, top.lon).toFixed(1);
        setSelectedStation({ ...top, distanceKm: dist });
        mapInstanceRef.current?.flyTo([top.lat, top.lon], 8, { duration: 0.7 });
        const nearest = await findNearestEpwStations(top.lat, top.lon, 8, sourceFilter);
        setNearestStations(nearest);
      }
    } finally {
      setMapSearching(false);
    }
  };

  const refLat = clickedCoords ? clickedCoords.lat : currentClimate.lat;
  const refLon = clickedCoords ? clickedCoords.lon : currentClimate.lon;
  const selectedBearing =
    selectedStation && selectedStation.distanceKm && selectedStation.distanceKm > 0.5
      ? calcCompassBearing(refLat, refLon, selectedStation.lat, selectedStation.lon)
      : null;

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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 font-bold text-teal-300" title="Interactive map powered by Ladybug Tools EPWMap catalog indexing Climate.OneBuilding.org and DOE EnergyPlus datasets">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            Ladybug EPWMap (OneBuilding + DOE)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-sky-300 border border-slate-700">
            {catalogLoading
              ? 'Loading 23,227 EPW Catalog...'
              : `${catalog.length.toLocaleString()} Stations (${visibleCount.toLocaleString()} in view)`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Quick Region Jump Pills */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-[10px]">
            <Compass className="w-3 h-3 text-teal-400 mr-0.5" />
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.flyTo([45.0, 11.0], 6, { duration: 0.6 })}
              className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom to Italy & Alpine region"
            >
              Italy (270+)
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.flyTo([50.0, 10.0], 4, { duration: 0.6 })}
              className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom to Europe"
            >
              Europe
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.flyTo([25.0, 10.0], 2, { duration: 0.6 })}
              className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Zoom to World view"
            >
              World
            </button>
          </div>

          {/* Map Layer Style Selector */}
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
            <Layers className="w-3 h-3 text-slate-400" />
            <select
              value={tileStyle}
              onChange={(e) => setTileStyle(e.target.value as TileStyleId)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="esri_topo" className="bg-slate-900">Esri Topographic</option>
              <option value="esri_street" className="bg-slate-900">Esri World Street</option>
              <option value="esri_sat" className="bg-slate-900">Esri Satellite</option>
              <option value="osm" className="bg-slate-900">OpenStreetMap</option>
              <option value="vector_only" className="bg-slate-900">Offline Vector</option>
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

      {/* Repository Filter + OneBuilding TMYx Period Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-[10px]">
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3 text-sky-400 mr-0.5" />
          <span className="text-slate-400 font-semibold">Source:</span>
          {(['all', 'onebuilding', 'energyplus'] as const).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onChangeSourceFilter(src)}
              className={`px-2 py-0.5 rounded font-semibold transition ${
                sourceFilter === src
                  ? src === 'onebuilding'
                    ? 'bg-sky-600 text-white'
                    : src === 'energyplus'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-teal-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {src === 'all'
                ? 'All (23.2k)'
                : src === 'onebuilding'
                ? 'OneBuilding.org (20.2k)'
                : 'DOE EnergyPlus (3.0k)'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-semibold">OneBuilding TMYx Baseline:</span>
          <select
            value={oneBuildingPeriod}
            onChange={(e) => {
              const p = e.target.value as OneBuildingPeriod;
              onChangeOneBuildingPeriod(p);
              setStationActivePeriod(p);
            }}
            className="bg-slate-800 text-sky-300 border border-slate-700 rounded px-1.5 py-0.5 font-semibold focus:outline-none cursor-pointer text-xs"
            title="Select TMYx historical baseline window when loading Climate.OneBuilding.org stations"
          >
            {AVAILABLE_ONEBUILDING_PERIODS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.badge})
              </option>
            ))}
          </select>
          {selectedStation && selectedStation.source === 'onebuilding' ? (
            <button
              type="button"
              disabled={loadingStationId === selectedStation.id}
              onClick={() => onSelectStation(selectedStation, stationActivePeriod)}
              className="px-2 py-0.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition shadow"
              title={`Load ${selectedStation.city} (${stationActivePeriod})`}
            >
              {loadingStationId === selectedStation.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Load for {selectedStation.city.split(' ')[0]} ({stationActivePeriod})
            </button>
          ) : activeStationInCatalog && currentClimate.period !== oneBuildingPeriod ? (
            <button
              type="button"
              disabled={loadingStationId === activeStationInCatalog.id}
              onClick={() => onSelectStation(activeStationInCatalog, oneBuildingPeriod)}
              className="px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition shadow"
              title={`Switch active site (${activeStationInCatalog.city}) to ${oneBuildingPeriod}`}
            >
              {loadingStationId === activeStationInCatalog.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Switch Active Site to {oneBuildingPeriod}
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Map Container + Side/Bottom Inspector */}
      <div className={expanded ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0' : 'space-y-2'}>
        {/* Leaflet Canvas Container */}
        <div
          className={`${
            expanded
              ? 'lg:col-span-8 h-full min-h-[380px] rounded-xl'
              : 'w-full h-72 rounded-lg'
          } overflow-hidden border border-slate-600 relative ${
            tileStyle === 'vector_only' ? 'bg-slate-950' : 'bg-slate-200'
          }`}
        >
          <div
            ref={mapContainerRef}
            className="w-full h-full z-10"
            style={{ background: tileStyle === 'vector_only' ? '#090d16' : '#e2e8f0' }}
          />

          {/* Floating In-Map Selected Station Callout (Top-Right Overlay) */}
          {selectedStation && (
            <div className="absolute top-2.5 right-2.5 z-20 w-80 max-w-[92vw] bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl border border-sky-500/80 shadow-2xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate">
                  <div className="text-xs font-extrabold text-sky-300 flex items-center gap-1.5 truncate">
                    <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    {selectedStation.city}, {selectedStation.country}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate" title={selectedStation.title}>
                    {selectedStation.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStation(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-xs shrink-0"
                  title="Close callout"
                >
                  ✕
                </button>
              </div>

              {/* Station Coordinates & Elevation Badge */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-800/70 px-2 py-1 rounded">
                <span>{selectedStation.lat.toFixed(2)}°N, {selectedStation.lon.toFixed(2)}°E</span>
                <span>WMO #{selectedStation.wmo || '-'}</span>
                {selectedStation.distanceKm !== undefined && (
                  <span className="text-teal-300 font-bold">{selectedStation.distanceKm} km {selectedBearing || ''}</span>
                )}
              </div>

              {/* Station Weather Files & Period Selector (OneBuilding Multi-Period Switcher) */}
              {selectedStation.source === 'onebuilding' && (
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-300 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-sky-400" />
                      Choose Weather File / Period:
                    </span>
                    <span className="text-sky-300 font-bold text-[9px] font-mono">{stationActivePeriod}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {AVAILABLE_ONEBUILDING_PERIODS.map((p) => {
                      const isSel = stationActivePeriod === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setStationActivePeriod(p.id);
                            onChangeOneBuildingPeriod(p.id);
                          }}
                          className={`px-2 py-1 rounded text-[10px] text-left truncate transition ${
                            isSel
                              ? 'bg-sky-500 text-slate-950 font-extrabold shadow'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                          title={p.description}
                        >
                          <span className="block truncate font-bold">{p.label}</span>
                          <span className={`text-[8px] block ${isSel ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                            {p.badge} ({p.years})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Download & Load Action Buttons */}
              <div className="pt-1 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={loadingStationId === selectedStation.id}
                    onClick={() => onSelectStation(selectedStation, stationActivePeriod)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow"
                  >
                    {loadingStationId === selectedStation.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading 8,760h EPW...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Load {selectedStation.source === 'onebuilding' ? stationActivePeriod : 'EPW'}
                      </>
                    )}
                  </button>
                  {selectedStation.epwUrl && (
                    <a
                      href={
                        selectedStation.source === 'onebuilding'
                          ? getOneBuildingDownloadUrl(selectedStation.epwUrl, stationActivePeriod)
                          : selectedStation.epwUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs flex items-center gap-1 border border-slate-700 transition"
                      title="Download raw .zip from Climate.OneBuilding.org"
                    >
                      <Download className="w-3 h-3" />
                      .zip
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-2 left-2 z-20 bg-slate-900/90 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-lg border border-slate-700 text-[10px] flex flex-wrap items-center gap-2.5 pointer-events-none">
            <span className="text-slate-400 font-semibold border-r border-slate-700 pr-2 hidden sm:inline">
              Ladybug Tools Catalog:
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 border border-white inline-block" />
              Active: {currentClimate.name.split(',')[0]} {currentClimate.period ? `(${currentClimate.period})` : ''}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              OneBuilding.org (20.2k)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              DOE EnergyPlus (3.0k)
            </span>
          </div>
        </div>

        {/* Station Inspector & Nearest Stations List */}
        <div className={expanded ? 'lg:col-span-4 flex flex-col gap-3 overflow-y-auto pr-1' : 'space-y-2'}>
          {/* Fullscreen Search Box */}
          {expanded && (
            <form onSubmit={handleInMapSearch} className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={mapQuery}
                  onChange={(e) => setMapQuery(e.target.value)}
                  placeholder="Find city or WMO across 23,227 stations..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-400"
                />
              </div>
              <button
                type="submit"
                disabled={mapSearching}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold"
              >
                {mapSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Locate'}
              </button>
            </form>
          )}

          {/* Station Weather Files & Available EPWs Explorer */}
          {selectedStation && (
            <div className="bg-slate-900/95 rounded-xl p-3 border border-sky-500/60 shadow-lg space-y-2 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Weather Files for {selectedStation.city}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">WMO #{selectedStation.wmo || '-'}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Choose from available baseline periods (including latest 2011–2025 release) or download the official ZIP archive:
              </p>

              {/* Multi-Period Weather File Rows for OneBuilding */}
              {selectedStation.source === 'onebuilding' && (
                <div className="space-y-1.5">
                  {AVAILABLE_ONEBUILDING_PERIODS.map((period) => {
                    const fileUrl = getOneBuildingDownloadUrl(selectedStation.epwUrl, period.id);
                    const fileName = fileUrl.split('/').pop() || '';
                    const isCurrent = stationActivePeriod === period.id;
                    const isLoadedActive =
                      currentClimate.period === period.id &&
                      Boolean(
                        (currentClimate.wmo && selectedStation.wmo && currentClimate.wmo === selectedStation.wmo) ||
                          currentClimate.name.includes(selectedStation.city.split(' ')[0])
                      );
                    return (
                      <div
                        key={period.id}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition ${
                          isLoadedActive
                            ? 'bg-teal-500/20 border-teal-400'
                            : isCurrent
                            ? 'bg-sky-500/20 border-sky-400'
                            : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-bold text-white flex items-center gap-1.5 truncate">
                            <span>{period.label}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-sky-950 text-sky-300 border border-sky-700">
                              {period.badge}
                            </span>
                            {isLoadedActive && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-teal-950 text-teal-300 border border-teal-600">
                                Active in BEM
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono truncate" title={fileName}>
                            {fileName}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sky-300 font-semibold text-[10px] flex items-center gap-1 transition"
                            title="Direct download .zip from OneBuilding"
                          >
                            <Download className="w-3 h-3" />
                            .zip
                          </a>
                          <button
                            type="button"
                            disabled={loadingStationId === selectedStation.id}
                            onClick={() => {
                              setStationActivePeriod(period.id);
                              onChangeOneBuildingPeriod(period.id);
                              onSelectStation(selectedStation, period.id);
                            }}
                            className={`px-2.5 py-1 rounded font-bold text-[10px] flex items-center gap-1 transition ${
                              isCurrent
                                ? 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                                : 'bg-teal-600 hover:bg-teal-500 text-white'
                            }`}
                          >
                            {loadingStationId === selectedStation.id && isCurrent ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Load
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alternative Co-located Datasets */}
              {coLocatedStations.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                    Alternative Datasets / Nearby Stations:
                  </span>
                  {coLocatedStations.map((alt) => (
                    <div
                      key={alt.id}
                      className="p-1.5 rounded bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-slate-200 block truncate">{alt.title}</span>
                        <span className="text-[10px] text-amber-400">
                          {alt.source === 'energyplus' ? 'DOE EnergyPlus' : alt.source} • {alt.datasetType || 'EPW'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectStation(alt)}
                        className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[10px] shrink-0"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Clicked Coordinate ERA5 TMY Synthesizer */}
          {clickedCoords && (
            <div className="bg-slate-900/90 p-2 rounded-lg border border-pink-500/40 flex items-center justify-between gap-2 text-xs">
              <div className="truncate">
                <div className="font-semibold text-pink-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Clicked Site: {clickedCoords.lat}°N, {clickedCoords.lon}°E
                </div>
                <div className="text-[10px] text-slate-400">
                  Pick a nearby OneBuilding / DOE station below or synthesize local ERA5
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
                className="px-2 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold shrink-0"
              >
                Synthesize Pin
              </button>
            </div>
          )}

          {/* Nearest Official EPW Stations Radar List */}
          {nearestStations.length > 0 && (
            <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                <span>
                  Nearest EPW Stations {clickedCoords ? 'to Clicked Pin' : 'to Active Site'}
                </span>
                <span>Distance</span>
              </div>
              <div className="divide-y divide-slate-800 max-h-44 overflow-y-auto">
                {nearestStations.map((st) => {
                  const isSelected = selectedStation?.id === st.id;
                  const isOB = st.source === 'onebuilding';
                  return (
                    <div
                      key={st.id}
                      className={`py-1.5 flex items-center justify-between gap-2 text-[11px] px-1.5 rounded cursor-pointer transition ${
                        isSelected ? 'bg-sky-500/20 border border-sky-500/40' : 'hover:bg-slate-800/60'
                      }`}
                      onClick={() => {
                        setSelectedStation(st);
                        mapInstanceRef.current?.flyTo([st.lat, st.lon], 8, { duration: 0.5 });
                      }}
                    >
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isOB ? 'bg-sky-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className="font-semibold text-slate-200 truncate">{st.city}</span>
                          <span className="text-[10px] text-slate-400">({st.country})</span>
                        </div>
                        <span className="block text-[9px] text-slate-400 truncate pl-3.5">
                          <span className={isOB ? 'text-sky-300' : 'text-amber-300'}>
                            {isOB ? 'OneBuilding' : 'DOE EnergyPlus'}
                          </span>{' '}
                          • {st.datasetType || 'TMYx'} • WMO {st.wmo || '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-teal-300">{st.distanceKm} km</span>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onSelectStation(st, stationActivePeriod);
                          }}
                          className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
