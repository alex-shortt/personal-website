import Head from "next/head";
import dynamic from "next/dynamic";
import Link from "next/link";

const CloudStudy = dynamic(() => import("@/components/cloud/CloudStudy"), {
  ssr: false,
});

export default function CloudLab() {
  return (
    <>
      <Head>
        <title>Cloud comparison</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main style={{ position: "fixed", inset: 0 }}>
        <CloudStudy lab />
        <header
          style={{
            position: "absolute",
            top: 20,
            left: 24,
            font: "12px/1.6 monospace",
            color: "#71717a",
            pointerEvents: "none",
          }}
        >
          <div>Cloud comparison · frozen motion</div>
          <Link href="/" style={{ pointerEvents: "auto" }}>
            Return to studio
          </Link>
        </header>
      </main>
    </>
  );
}

export function getStaticProps() {
  return process.env.NODE_ENV === "production"
    ? { notFound: true }
    : { props: {} };
}
