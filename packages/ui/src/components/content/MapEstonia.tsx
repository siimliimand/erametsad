'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import './MapEstonia.css';

export interface MapPin {
  lat: number;
  lng: number;
  label?: string;
  onClick?: () => void;
}

export interface MapEstoniaProps {
  pins?: MapPin[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

const defaultCenter: [number, number] = [58.6, 25.0];
const defaultZoom = 7;

// Simplified prototype county outlines (15 Estonian maakond, public-domain
// low-poly coordinates, [lat, lng] order for Leaflet). Drawn under the
// pins so the map reads as an Estonia map even before the WMS tiles load.
interface CountyOutline {
  name: string;
  ring: [number, number][];
}

const ESTONIA_COUNTY_OUTLINES: CountyOutline[] = [
  { name: 'Harjumaa', ring: [[59.05, 24.05], [59.25, 24.2], [59.42, 24.55], [59.5, 24.9], [59.45, 25.25], [59.3, 25.5], [59.12, 25.45], [59.02, 25.15], [59.0, 24.7], [59.02, 24.3], [59.05, 24.05]] },
  { name: 'Hiiumaa', ring: [[58.83, 22.4], [58.98, 22.6], [59.08, 22.85], [58.98, 23.1], [58.82, 23.05], [58.68, 22.85], [58.72, 22.6], [58.83, 22.4]] },
  { name: 'Ida-Virumaa', ring: [[59.32, 27.45], [59.45, 27.8], [59.4, 28.15], [59.2, 28.2], [59.0, 27.95], [58.85, 27.55], [58.98, 27.1], [59.2, 26.95], [59.35, 27.1], [59.32, 27.45]] },
  { name: 'Jõgevamaa', ring: [[58.9, 26.25], [59.1, 26.5], [59.2, 26.85], [59.0, 27.05], [58.8, 27.0], [58.6, 26.75], [58.55, 26.45], [58.7, 26.2], [58.9, 26.25]] },
  { name: 'Järvamaa', ring: [[58.75, 25.3], [59.0, 25.3], [59.2, 25.6], [59.1, 25.95], [58.9, 26.15], [58.7, 25.95], [58.6, 25.65], [58.65, 25.4], [58.75, 25.3]] },
  { name: 'Läänemaa', ring: [[58.9, 23.5], [59.12, 23.5], [59.28, 23.75], [59.22, 24.05], [59.05, 24.2], [58.85, 24.3], [58.7, 24.05], [58.72, 23.75], [58.9, 23.5]] },
  { name: 'Lääne-Virumaa', ring: [[59.35, 25.45], [59.5, 25.75], [59.45, 26.1], [59.3, 26.4], [59.1, 26.4], [58.95, 26.2], [58.95, 25.85], [59.12, 25.55], [59.35, 25.45]] },
  { name: 'Pärnumaa', ring: [[58.35, 24.4], [58.55, 23.95], [58.8, 23.75], [59.0, 24.05], [59.05, 24.4], [58.9, 24.7], [58.75, 24.9], [58.55, 25.05], [58.3, 24.95], [58.25, 24.65], [58.35, 24.4]] },
  { name: 'Põlvamaa', ring: [[58.2, 26.95], [58.4, 27.1], [58.6, 27.35], [58.5, 27.7], [58.3, 27.85], [58.1, 27.65], [58.0, 27.3], [58.1, 27.05], [58.2, 26.95]] },
  { name: 'Raplamaa', ring: [[58.7, 24.45], [58.95, 24.5], [59.1, 24.8], [59.05, 25.2], [58.85, 25.4], [58.65, 25.3], [58.55, 25.0], [58.6, 24.7], [58.7, 24.45]] },
  { name: 'Saaremaa', ring: [[58.6, 22.85], [58.5, 23.15], [58.35, 23.4], [58.15, 23.35], [58.05, 23.05], [58.15, 22.7], [58.35, 22.4], [58.55, 22.55], [58.6, 22.85]] },
  { name: 'Tartumaa', ring: [[58.5, 26.35], [58.7, 26.3], [58.9, 26.4], [59.05, 26.6], [58.95, 26.85], [58.75, 27.0], [58.5, 26.95], [58.3, 26.75], [58.35, 26.5], [58.5, 26.35]] },
  { name: 'Valgamaa', ring: [[57.9, 25.8], [58.1, 25.9], [58.2, 26.15], [58.1, 26.45], [57.9, 26.5], [57.75, 26.3], [57.75, 26.0], [57.9, 25.8]] },
  { name: 'Viljandimaa', ring: [[58.05, 25.3], [58.25, 25.3], [58.45, 25.45], [58.55, 25.75], [58.45, 26.05], [58.25, 26.25], [58.05, 26.2], [57.9, 25.95], [57.9, 25.65], [58.0, 25.4], [58.05, 25.3]] },
  { name: 'Võrumaa', ring: [[57.8, 26.5], [58.0, 26.55], [58.25, 26.85], [58.2, 27.25], [58.05, 27.6], [57.85, 27.55], [57.7, 27.2], [57.65, 26.85], [57.8, 26.5]] },
];

const COUNTY_OUTLINE_STYLE: L.PolylineOptions = {
  color: '#2E6B4F',
  weight: 1,
  opacity: 0.5,
  fillColor: '#2E6B4F',
  fillOpacity: 0.04,
  interactive: false,
};

function fixLeafletIcon(L: typeof import('leaflet')) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export function MapEstonia({ pins = [], center = defaultCenter, zoom = defaultZoom, className = '' }: MapEstoniaProps): ReactElement {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      try {
        const L = (await import('leaflet')).default;

        if (!mounted || !mapRef.current) return;

        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        fixLeafletIcon(L);

        const map = L.map(mapRef.current, { center, zoom, zoomControl: true });
        mapInstance.current = map;

        const wmsUrl = 'https://kaart.maaamet.ee/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=ortho&STYLES=&FORMAT=image/png&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox}';

        const tileLayer = L.tileLayer(wmsUrl, {
          attribution: '&copy; <a href="https://www.maaamet.ee">Maa-amet</a>',
          maxZoom: 18,
        });

        tileLayer.addTo(map);
        tileLayer.on('tileerror', () => {
          if (!mapInstance.current) return;
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
          }).addTo(map);
        });

        // County outlines live in the overlay pane, below the marker pane,
        // so they always render under the pins.
        L.layerGroup(
          ESTONIA_COUNTY_OUTLINES.map((county) => L.polygon(county.ring, COUNTY_OUTLINE_STYLE)),
        ).addTo(map);

        markersLayer.current = L.layerGroup().addTo(map);

        pins.forEach((pin) => {
          const marker = L.marker([pin.lat, pin.lng]);
          if (pin.label) marker.bindPopup(pin.label);
          if (pin.onClick) marker.on('click', pin.onClick);
          markersLayer.current?.addLayer(marker);
        });
      } catch {
        if (mounted) setLoadError(true);
      }
    }

    initMap();
    return () => { mounted = false; mapInstance.current?.remove(); };
  }, []);

  useEffect(() => {
    mapInstance.current?.setView(center, zoom);
  }, [center[0], center[1], zoom]);

  useEffect(() => {
    if (!markersLayer.current) return;

    markersLayer.current.clearLayers();

    import('leaflet').then((mod) => {
      const L = mod.default;
      pins.forEach((pin) => {
        const marker = L.marker([pin.lat, pin.lng]);
        if (pin.label) marker.bindPopup(pin.label);
        if (pin.onClick) marker.on('click', pin.onClick);
        markersLayer.current?.addLayer(marker);
      });
    });
  }, [pins]);

  if (loadError) {
    return (
      <div className={`map-estonia ${className}`}>
        <div className="map-estonia__fallback">
          Kaart ei laadinud. Proovi lehte värskendada.
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={`map-estonia ${className}`} />;
}