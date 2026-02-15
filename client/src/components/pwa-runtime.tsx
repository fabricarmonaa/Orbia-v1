import { useEffect } from "react";
import { useLocation } from "wouter";
import { registerSW } from "virtual:pwa-register";

function manifestForPath(path: string) {
  if (path.startsWith("/delivery")) return "/manifest-delivery.json";
  if (path.startsWith("/owner") || path.startsWith("/super")) return "/manifest-owner.json";
  return "/manifest-tenant.json";
}

function themeForPath(path: string) {
  if (path.startsWith("/delivery")) return "#0f172a";
  if (path.startsWith("/owner") || path.startsWith("/super")) return "#111827";
  return "#0f172a";
}

export function PwaRuntime() {
  const [location] = useLocation();

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onRegisterError(error: unknown) {
        if (process.env.NODE_ENV !== "production") {
          console.error("SW registration error", error);
        }
      },
    });

    return () => {
      void updateSW(false);
    };
  }, []);

  useEffect(() => {
    const manifestHref = manifestForPath(location || window.location.pathname);
    const themeColor = themeForPath(location || window.location.pathname);

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestHref;

    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = themeColor;

    let appleTouch = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleTouch) {
      appleTouch = document.createElement("link");
      appleTouch.rel = "apple-touch-icon";
      document.head.appendChild(appleTouch);
    }
    appleTouch.href = "/uploads/dummy/orbia_logo.png";
  }, [location]);

  return null;
}
