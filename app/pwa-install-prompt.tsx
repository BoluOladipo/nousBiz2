"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function getInstallInstructions() {
  const userAgent = navigator.userAgent;
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isAppleMobile) {
    return "In Safari, tap Share, then choose Add to Home Screen.";
  }
  if (/Edg\//.test(userAgent)) {
    return "Open the browser menu and choose Apps, then Install this site as an app.";
  }
  if (/Chrome|Chromium/.test(userAgent)) {
    return "Open the browser menu and choose Install app or Add to Home screen.";
  }
  return "Open your browser menu and look for Install app or Add to Home screen.";
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isAppInstalled()) return;

    const showPromptFrame = window.requestAnimationFrame(() => {
      if (
        window.sessionStorage.getItem("nousbiz-install-dismissed") !== "true"
      ) {
        setVisible(true);
      }
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.cancelAnimationFrame(showPromptFrame);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setInstructions(getInstallInstructions());
      setShowInstructions(true);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        dismissPrompt();
      }
    } catch (error) {
      console.error("Could not open the browser install prompt:", error);
      setInstallPrompt(null);
      setInstructions(getInstallInstructions());
      setShowInstructions(true);
    }
  }

  function dismissPrompt() {
    window.sessionStorage.setItem("nousbiz-install-dismissed", "true");
    setVisible(false);
    setShowInstructions(false);
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Install NousBiz"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:bottom-6 sm:right-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0c1936] text-white">
          <Download aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Install NousBiz</p>
          <p className="mt-1 text-sm text-slate-600">
            Add the app to your device for quick access.
          </p>
          {showInstructions && (
            <p className="mt-2 text-sm text-slate-700" role="status">
              {instructions}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void installApp()}
              className="rounded-lg bg-[#1E84E7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E66AA]"
            >
              Install app
            </button>
            {showInstructions && (
              <button
                type="button"
                onClick={dismissPrompt}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Got it
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dismissPrompt}
          aria-label="Dismiss install prompt"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
