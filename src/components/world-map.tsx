"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Layer,
  Map as MapGL,
  Marker,
  NavigationControl,
  Source,
  type MapEvent,
  type MapRef,
  type MapStyleDataEvent,
} from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { flagEmoji } from "@/lib/format";
import type { TripBoundary } from "@/lib/nominatim";
import { scoreColor } from "@/lib/ratings";

// Тайли й шрифти мапи вантажить не головний потік, а Web Worker. Сам
// MapLibre шукає його поруч зі своїм бандлом — а після збірки бандл
// лежить у /_next/static/chunks/, де воркера немає. Next відповідає
// HTML-сторінкою 404, воркер не стартує, і замість мапи лишається
// однотонний фон стилю (пін і кнопки при цьому працюють — вони в DOM).
//
// Копію воркера кладе в public/maplibre скрипт scripts/copy-maplibre-worker.mjs
// на етапі postinstall. Виклик має відпрацювати до створення мапи, тому
// стоїть на рівні модуля, а не в ефекті.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Безкоштовні векторні стилі CARTO — без ключів, без реєстрації, без карток.
const STYLE_LIGHT =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type MapTrip = {
  id: string;
  title: string;
  place_name: string;
  country_code: string | null;
  lat: number;
  lng: number;
  score: number | null;
  boundary: TripBoundary | null;
};

type Props = {
  trips: MapTrip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Колір заливки для місць, які ще ніхто не оцінив. */
const UNRATED_COLOR = "#78716c";

function subscribeToScheme(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export default function WorldMap({ trips, selectedId, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null);

  // Стиль мапи слідує за темою системи: підміняється не колір, а
  // джерело тайлів. useSyncExternalStore — саме той інструмент для
  // читання зовнішнього стану браузера: значення відоме вже на
  // першому рендері, тож мапа не встигає блимнути світлою.
  const dark = useSyncExternalStore(
    subscribeToScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );

  const bounds = useMemo(() => {
    if (trips.length === 0) return null;
    const lats = trips.map((t) => t.lat);
    const lngs = trips.map((t) => t.lng);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [trips]);

  // Одна подорож не має bounding box, тому єдиний пін просто центруємо.
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    if (trips.length === 1) {
      map.easeTo({ center: [trips[0].lng, trips[0].lat], zoom: 5 });
      return;
    }
    map.fitBounds(bounds, { padding: 80, duration: 700, maxZoom: 7 });
  }, [bounds, trips]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) fitAll();
  }, [ready, fitAll]);

  // Заливка має лягти ПІД підписи мапи, інакше назви міст ховаються
  // під нею. Id першого символьного шару беремо зі стилю: у CARTO їх
  // кілька десятків, і зашивати конкретну назву було б крихко.
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>();

  const syncLabelLayer = useCallback((event: MapEvent | MapStyleDataEvent) => {
    try {
      const layers = event.target.getStyle()?.layers ?? [];
      const label = layers.find(
        (layer: { type: string; id: string }) => layer.type === "symbol",
      );
      setLabelLayerId(label?.id);
    } catch {
      // Стиль ще не догрузився — спробуємо на наступній події.
    }
  }, []);

  // Полігони міст одним джерелом: колір і підсвітка їдуть властивостями
  // фіч, тому перемальовування вибраної подорожі не чіпає інші.
  const boundaries = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: trips
        .filter((t) => t.boundary !== null)
        .map((t) => ({
          type: "Feature" as const,
          id: t.id,
          properties: {
            color: t.score !== null ? scoreColor(t.score) : UNRATED_COLOR,
            selected: t.id === selectedId,
          },
          geometry: t.boundary as TripBoundary,
        })),
    }),
    [trips, selectedId],
  );

  // Клік по піну підлітає до нього, не змінюючи масштаб різко.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip) return;
    map.easeTo({
      center: [trip.lng, trip.lat],
      zoom: Math.max(map.getZoom(), 5),
      duration: 600,
    });
  }, [selectedId, trips]);

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        mapStyle={dark ? STYLE_DARK : STYLE_LIGHT}
        initialViewState={{ longitude: 15, latitude: 30, zoom: 1.4 }}
        minZoom={1}
        maxZoom={14}
        onLoad={(event) => {
          syncLabelLayer(event);
          setReady(true);
        }}
        onStyleData={syncLabelLayer}
        onClick={() => onSelect(null)}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {boundaries.features.length > 0 && (
          <Source id="visited-places" type="geojson" data={boundaries}>
            <Layer
              id="visited-fill"
              type="fill"
              beforeId={labelLayerId}
              paint={{
                "fill-color": ["get", "color"],
                "fill-opacity": ["case", ["get", "selected"], 0.45, 0.22],
              }}
            />
            <Layer
              id="visited-outline"
              type="line"
              beforeId={labelLayerId}
              paint={{
                "line-color": ["get", "color"],
                "line-width": ["case", ["get", "selected"], 2.5, 1.2],
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}

        {trips.map((trip) => {
          const active = trip.id === selectedId;
          return (
            <Marker
              key={trip.id}
              longitude={trip.lng}
              latitude={trip.lat}
              anchor="bottom"
              onClick={(e) => {
                // Без цього клік «протікає» на мапу і одразу скидає вибір.
                e.originalEvent.stopPropagation();
                onSelect(active ? null : trip.id);
              }}
            >
              <button
                type="button"
                aria-label={`${trip.title}, ${trip.place_name}`}
                className={`group flex flex-col items-center transition-transform duration-200 ${
                  active ? "scale-115 z-10" : "hover:scale-110"
                }`}
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-lg shadow-lg ring-2 transition-colors"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--surface)",
                    boxShadow: active
                      ? "0 6px 18px rgb(0 0 0 / 0.35)"
                      : "0 3px 10px rgb(0 0 0 / 0.25)",
                    ["--tw-ring-color" as string]: active
                      ? "var(--accent)"
                      : trip.score !== null
                        ? scoreColor(trip.score)
                        : "var(--border)",
                  }}
                >
                  {flagEmoji(trip.country_code)}
                </span>
                <span
                  className="-mt-0.5 h-2 w-2 rotate-45"
                  style={{
                    background: active
                      ? "var(--accent)"
                      : trip.score !== null
                        ? scoreColor(trip.score)
                        : "var(--border)",
                  }}
                />
              </button>
            </Marker>
          );
        })}
      </MapGL>

      {trips.length > 0 && (
        <button
          type="button"
          onClick={fitAll}
          className="absolute bottom-8 right-2.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium shadow-md hover:bg-surface-2 transition-colors"
        >
          Увесь світ
        </button>
      )}
    </div>
  );
}
