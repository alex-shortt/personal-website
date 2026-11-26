import { loadStudioFont } from "@/styles/studioFonts";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { inter } from "@/styles/fonts";
import styles from "./Home.module.css";

const CloudStudy = dynamic(() => import("@/components/cloud/CloudStudy"), {
  ssr: false,
});

export default function Home() {
  const [fontFamily, setFontFamily] = useState(inter.style.fontFamily);
  const [fontReady, setFontReady] = useState(false);
  const [fontError, setFontError] = useState("");
  const fontRequest = useRef(0);
  const onFontChange = useCallback((id: string) => {
    const request = ++fontRequest.current;
    void loadStudioFont(id)
      .then((family) => {
        if (request !== fontRequest.current) return;
        setFontFamily(family);
        setFontError("");
        setFontReady(true);
      })
      .catch(() => {
        if (request !== fontRequest.current) return;
        setFontError(
          "That font could not load. Showing the previous typeface.",
        );
        setFontReady(true);
      });
  }, []);
  const studioAnchor = useRef<HTMLDivElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  useEffect(() => {
    if (!sceneReady || !fontReady) return;
    let cancelled = false;
    let firstFrame = 0,
      secondFrame = 0;
    // Wait for the actual face and a painted scene, not an arbitrary timer.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (!cancelled) setRevealed(true);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [sceneReady, fontReady]);
  return (
    <>
      <Head>
        <title>Alexander Shortt</title>
        <meta
          name="description"
          content="A study of a cloud in cyan and pink light."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="preload"
          href="/cloud/shape-profile.png"
          as="fetch"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/cloud/density-64.png"
          as="fetch"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/cloud/jitter-32.bin"
          as="fetch"
          crossOrigin="anonymous"
        />
      </Head>
      <main
        className={`${styles.page} ${inter.className}`}
        aria-busy={!revealed}
        data-home-ready={revealed}
      >
        <div
          className={styles.layout}
          inert={!revealed}
          style={{ opacity: revealed ? 1 : 0 }}
        >
          <div
            className={styles.canvasLayer}
            role="group"
            aria-label="A cyan and pink cloud suspended between two studio lights, above a seamless off-white floor."
          >
            <CloudStudy
              onSceneReady={onSceneReady}
              onFontChange={onFontChange}
              framingElement={studioAnchor}
            />
          </div>
          <div ref={studioAnchor} className={styles.scene} aria-hidden="true" />
          <section
            className={styles.copy}
            aria-label="Introduction"
            style={{ fontFamily }}
          >
            <h1 className={styles.name}>Alexander Shortt</h1>
            <p>
              I’ve built worlds for artists, tools for police, companies of my
              own.{" "}
              <a className={styles.inlineLink} href="https://worldlabs.ai">
                World Labs
              </a>
              .{" "}
              <a className={styles.inlineLink} href="https://muse.place">
                Muse
              </a>
              .{" "}
              <a className={styles.inlineLink} href="https://awge.com">
                A$AP Rocky
              </a>
              . Now{" "}
              <a className={styles.inlineLink} href="https://abelpolice.com">
                Abel
              </a>
              .
            </p>
            <p>I work to restore order using enchantment.</p>
            {fontError && <p role="status">{fontError}</p>}
            <footer className={styles.footer}>
              <nav className={styles.links} aria-label="Elsewhere">
                <a href="https://twitter.com/_alexshortt">twitter</a>
                <a href="https://github.com/alex-shortt">github</a>
                <a href="https://www.are.na/alexander-shortt">are.na</a>
              </nav>
            </footer>
          </section>
        </div>
        <div
          className={styles.loadingCover}
          role="status"
          aria-label="Loading scene"
          aria-hidden={revealed}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            background: "#fff",
            opacity: revealed ? 0 : 1,
            pointerEvents: revealed ? "none" : "auto",
          }}
        />
      </main>
    </>
  );
}
