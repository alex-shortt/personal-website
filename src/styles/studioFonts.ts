import {
  Instrument_Sans,
  Manrope,
  DM_Sans,
  Onest,
  Space_Grotesk,
  Work_Sans,
} from "next/font/google";
import { inter } from "./fonts";
const instrument = Instrument_Sans({ subsets: ["latin"], preload: false });
const manrope = Manrope({ subsets: ["latin"], preload: false });
const dm = DM_Sans({ subsets: ["latin"], preload: false });
const onest = Onest({ subsets: ["latin"], preload: false });
const space = Space_Grotesk({ subsets: ["latin"], preload: false });
const work = Work_Sans({ subsets: ["latin"], preload: false });
const families: Record<string, string> = {
  inter: inter.style.fontFamily,
  instrument: instrument.style.fontFamily,
  manrope: manrope.style.fontFamily,
  dm: dm.style.fontFamily,
  onest: onest.style.fontFamily,
  space: space.style.fontFamily,
  work: work.style.fontFamily,
  satoshi: '"Satoshi", sans-serif',
};
let satoshiLoading: Promise<void> | undefined;
export async function loadStudioFont(id: string) {
  if (id === "satoshi") {
    // Fontshare serves the official font; no restricted font binary is
    // redistributed through this repository. Requested only for this preview.
    satoshiLoading ??= new Promise<void>((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://api.fontshare.com/v2/css?f[]=satoshi@400,700&display=swap";
      link.onload = () => resolve();
      link.onerror = () => {
        link.remove();
        satoshiLoading = undefined;
        reject(new Error("Fontshare could not load Satoshi"));
      };
      document.head.appendChild(link);
    });
    await satoshiLoading;
  }
  const family = families[id] ?? families.inter;
  await Promise.all([
    document.fonts.load(`400 14px ${family}`),
    document.fonts.load(`700 24px ${family}`),
  ]);
  return family;
}
