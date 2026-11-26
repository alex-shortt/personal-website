import "@/styles/globals.css";
import { useEffect } from "react";
import { useRouter } from "next/router";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    // Let the scene download and compile before loading the existing analytics SDK.
    // This doesn't wrap/remount the page when analytics becomes available.
    const timer = window.setTimeout(
      () => {
        void import("@/logic/analytics").then(({ initializeAnalytics }) => {
          if (disposed) return;
          const posthog = initializeAnalytics();
          const capture = () => posthog.capture("$pageview");
          router.events.on("routeChangeComplete", capture);
          unsubscribe = () => router.events.off("routeChangeComplete", capture);
        });
      },
      router.pathname === "/timeline" ? 0 : 3000,
    );
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [router.events, router.pathname]);
  return <Component {...pageProps} />;
}
