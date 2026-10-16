import { useEffect, useRef, useState } from "react";
let library: Promise<any> | undefined;
function loadMapbox() {
  return (library ??= new Promise((resolve, reject) => {
    const w = window as any;
    if (w.mapboxgl) {
      resolve(w.mapboxgl);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js";
    script.onload = () => resolve(w.mapboxgl);
    script.onerror = () => reject(new Error("Map unavailable."));
    document.head.append(script);
  }));
}
export function DeliveryMap({ order, pickup }: { order: any; pickup: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [error, setError] = useState("");
  const token = import.meta.env["VITE_MAPBOX_TOKEN"];
  useEffect(() => {
    if (!token || !ref.current) return;
    let map: any;
    let stopped = false;
    const controller = new AbortController();
    setEta(null);
    void loadMapbox()
      .then(async (gl) => {
        if (stopped) return;
        map = new gl.Map({
          container: ref.current,
          accessToken: token,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [order.longitude, order.latitude],
          zoom: 12,
        });
        map.addControl(new gl.NavigationControl());
        const bounds = new gl.LngLatBounds();
        const points = [
          {
            label: "Delivery address",
            color: "#16803c",
            latitude: order.latitude,
            longitude: order.longitude,
          },
          ...(pickup ? [{ ...pickup, label: "Pickup", color: "#ff8a00" }] : []),
          ...(order.location ? [{ ...order.location, label: "Rider", color: "#1967d2" }] : []),
        ];
        points.forEach((p) => {
          new gl.Marker({ color: p.color })
            .setLngLat([p.longitude, p.latitude])
            .setPopup(new gl.Popup().setText(p.label))
            .addTo(map);
          bounds.extend([p.longitude, p.latitude]);
        });
        map.fitBounds(bounds, { padding: 55, maxZoom: 14 });
        if (order.location) {
          try {
            const r = await fetch(
              `https://api.mapbox.com/directions/v5/mapbox/driving/${order.location.longitude},${order.location.latitude};${order.longitude},${order.latitude}?geometries=geojson&access_token=${encodeURIComponent(token)}`,
              { signal: controller.signal },
            );
            const d = await r.json();
            if (!r.ok || !d.routes?.[0]) throw new Error("Route unavailable.");
            const route = d.routes[0];
            if (stopped) return;
            setEta(Math.ceil(route.duration / 60));
            const add = () => {
              if (stopped) return;
              map.addSource("route", {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: route.geometry },
              });
              map.addLayer({
                id: "route",
                type: "line",
                source: "route",
                paint: { "line-color": "#16803c", "line-width": 5 },
              });
            };
            if (map.isStyleLoaded()) add();
            else map.once("load", add);
          } catch (e) {
            if (!stopped) setError("Route estimate unavailable.");
          }
        }
        map.on("error", () => {
          if (!stopped) setError("Map could not load. Delivery updates remain available.");
        });
      })
      .catch(() => setError("Map unavailable."));
    return () => {
      stopped = true;
      controller.abort();
      map?.remove();
    };
  }, [token, order.id, order.location?.created_at, pickup?.latitude, pickup?.longitude]);
  if (!token)
    return (
      <p className="rounded-md bg-muted p-4 text-sm">
        Map tracking is unavailable.{" "}
        {order.location
          ? `Last rider update: ${order.location.created_at} UTC.`
          : "No live rider location has been received."}
      </p>
    );
  return (
    <div>
      <div ref={ref} className="h-80 w-full overflow-hidden rounded-md" aria-label="Delivery map" />
      {eta !== null && (
        <p className="mt-2 text-sm">
          Estimated driving time: {eta} minutes from the last location update.
        </p>
      )}
      {error && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
