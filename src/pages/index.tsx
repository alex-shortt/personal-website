import Head from "next/head";
import { Inter } from "@next/font/google";
import styles from "@/styles/Home.module.css";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <Head>
        <title>Alex Shortt</title>
        <meta name="description" content="hello" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container + " " + inter.className}>
          <h1>Alex Shortt</h1>
          <br />
          <h4>
            Currently working on{" "}
            <a href="https://www.exportmama.com">Export Mama</a>
          </h4>
          <br />
          <br />
          <div>
            <span className="art">art</span>&nbsp;&nbsp;&nbsp;
            <span className="startup">startup</span>&nbsp;&nbsp;&nbsp;
            <span className="learn">learn</span>&nbsp;&nbsp;&nbsp;
            <span className="work">work</span>
          </div>
          <br />
          <h4>Timeline</h4>
          <a href="https://www.exportmama.com" className="startup">
            Export Mama, 2023
          </a>
          <a href="https://logicmap.com" className="art">
            Logic Map, 2023
          </a>
          <a
            href="https://www.ycombinator.com/companies/muse"
            className="learn"
          >
            Y Combinator S21, 2021
          </a>
          <a href="https://www.muse.place" className="startup">
            Muse, 2020-2023
          </a>
          <a
            href="http://jermaine-fowler-site.s3-website-us-west-1.amazonaws.com"
            className="work"
          >
            Jermaine Fowler Website, 2020
          </a>
          <a
            href="https://assets.mediated.world/site/latent-explorer/wide-video.mp4"
            className="art"
          >
            Latent Explorer, 2020
          </a>
          <a
            href="http://smile.sashsite.com.s3-website-us-west-1.amazonaws.com/"
            className="work"
          >
            Sash Website, 2019
          </a>
          <a
            href="https://assets.mediated.world/site/foundation/inbed.mp4"
            className="art"
          >
            Foundation, 2019
          </a>
          <a href="https://trailer.mediated.world" className="art">
            mediated.world Trailer, 2019
          </a>
          <p className="learn">UC Santa Barbara, 2018-2021</p>
          <a
            href="http://first-personal-site.s3-website-us-west-1.amazonaws.com/"
            className="work"
          >
            Personal Website, 2018
          </a>
          <a href="https://www.getinstadata.com/" className="startup">
            Metaplug, 2017-2020
          </a>
          <a href="https://www.awge.com" className="work">
            AWGE Website, 2017
          </a>
          <a
            href="https://www.gta5-mods.com/scripts/portal-gun-net"
            className="art"
          >
            GTAV Portal Gun Mod, 2015
          </a>
          <br />
          <h4>Links</h4>
          <a href="https://twitter.com/_alexshortt">Twitter</a>
          <a href="https://github.com/alex-shortt">Github</a>
        </div>
      </main>
    </>
  );
}
