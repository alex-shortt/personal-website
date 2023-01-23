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
        <div className={styles.container}>
          <h1 className={inter.className}>Alex Shortt</h1>
          <br />
          <br />
          <h4 className={inter.className}>
            Currently working on <a href="https://www.muse.place">Muse</a>
          </h4>
          <br />
          <br />
          <h4 className={inter.className}>organizations</h4>
          <a
            href="https://www.ycombinator.com/companies/muse"
            className={inter.className}
          >
            Y Combinator, S21
          </a>
          <p className={inter.className}>UC Santa Barbara, for a while</p>
          <h4 className={inter.className}>websites</h4>
          <a
            href="http://jermaine-fowler-site.s3-website-us-west-1.amazonaws.com"
            className={inter.className}
          >
            Jermaine Fowler, 2020
          </a>
          <a
            href="http://smile.sashsite.com.s3-website-us-west-1.amazonaws.com/"
            className={inter.className}
          >
            Sash, 2019
          </a>
          <a
            href="http://first-personal-site.s3-website-us-west-1.amazonaws.com/"
            className={inter.className}
          >
            First personal site, 2018
          </a>
          <a href="https://www.awge.com" className={inter.className}>
            AWGE, 2017
          </a>
          <h4 className={inter.className}>art</h4>
          <a
            href="https://assets.mediated.world/site/latent-explorer/wide-video.mp4"
            className={inter.className}
          >
            Latent Explorer, 2020
          </a>
          <a href="https://trailer.mediated.world" className={inter.className}>
            mediated.world Trailer, 2019
          </a>
          <a
            href="https://assets.mediated.world/site/foundation/inbed.mp4"
            className={inter.className}
          >
            Foundation, 2019
          </a>
          <h4 className={inter.className}>links</h4>
          <a href="https://muse.place/alex" className={inter.className}>
            Muse
          </a>
          <a href="https://twitter.com/_alexshortt" className={inter.className}>
            Twitter
          </a>
          <a href="https://github.com/alex-shortt" className={inter.className}>
            Github
          </a>
        </div>
      </main>
    </>
  );
}
