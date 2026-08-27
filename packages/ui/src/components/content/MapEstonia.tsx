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