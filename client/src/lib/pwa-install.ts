import { useCallback, useEffect, useMemo, useState } from "react";

type InstallOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
}

type PlatformHint = "installable" | "ios" | "unsupported";

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMatch = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(standaloneMatch || iosStandalone);
}

function detectIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isTouchMac = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  return isIOS || isTouchMac;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectInstalled());

  useEffect(() => {
    setIsInstalled(detectInstalled());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canInstall = !isInstalled && deferredPrompt !== null;

  const platformHint: PlatformHint = useMemo(() => {
    if (canInstall) return "installable";
    if (!isInstalled && detectIosLike()) return "ios";
    return "unsupported";
  }, [canInstall, isInstalled]);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt || isInstalled) return false;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (import.meta.env.DEV) {
      console.debug("[PWA install] userChoice", choice.outcome);
    }

    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      return true;
    }

    return false;
  }, [deferredPrompt, isInstalled]);

  return {
    canInstall,
    isInstalled,
    install,
    platformHint,
  };
}
