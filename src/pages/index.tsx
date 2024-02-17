import Head from "next/head";
import { Inter } from "@next/font/google";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/logic/cn";
import { createPortal } from "react-dom";

const inter = Inter({ subsets: ["latin"] });

type TYPE = "faith" | "art" | "startup" | "learn" | "work";
const COLOR: { [key in TYPE]: string } = {
  faith: "#9871d8",
  art: "#00eeff",
  startup: "#fb6518",
  learn: "#75ce1c",
  work: "#ff007b",
};

const START = new Date("2015-01-02");
const END = new Date(); // now
const SCALE = 900; // px
const WIDTH = 12; // px
const SPACE = 11; // %
const MARGIN = 12; // px, for the dates

type Entry = {
  name: string;
  type: TYPE;
  index: number;
  link?: string;
  desc?: string;
} & (
  | { date: string; start?: undefined; end?: undefined }
  | { date?: undefined; start: string; end: string | undefined }
);

const entries: Entry[] = [
  {
    name: "GTAV Portal Gun Mod",
    link: "https://www.gta5-mods.com/scripts/portal-gun-net",
    type: "art",
    index: 3,
    date: "2015-07-05",
  },
  {
    name: "awge.com",
    link: "https://www.awge.com",
    type: "work",
    index: 4,
    date: "2017-08-07",
  },
  {
    name: "Metaplug",
    type: "startup",
    link: "https://www.getinstadata.com/",
    index: 1,
    start: "2017-11-01",
    end: "2020-08-01",
  },
  {
    name: "First Personal Website",
    link: "http://first-personal-site.s3-website-us-west-1.amazonaws.com/",
    type: "art",
    index: 3,
    date: "2018-06-26",
  },
  {
    name: "UC Santa Barbara",
    type: "learn",
    link: "https://www.ucsb.edu/",
    index: 0,
    start: "2018-08-10",
    end: "2021-04-29",
  },
  {
    name: "Sash - Smile Website",
    link: "http://smile.sashsite.com.s3-website-us-west-1.amazonaws.com/",
    type: "work",
    index: 4,
    date: "2019-08-25",
  },
  {
    name: "Foundation",
    link: "https://assets.mediated.world/site/foundation/inbed.mp4",
    type: "art",
    index: 3,
    date: "2019-12-07",
  },
  {
    name: "mediated.world Trailer",
    link: "https://trailer.mediated.world",
    type: "art",
    index: 2,
    date: "2019-12-12",
  },
  {
    name: "Latent Explorer",
    link: "https://assets.mediated.world/site/latent-explorer/wide-video.mp4",
    type: "art",
    index: 2,
    date: "2020-04-07",
  },
  {
    name: "Jermaine Fowler Website",
    link: "http://jermaine-fowler-site.s3-website-us-west-1.amazonaws.com/",
    type: "work",
    index: 4,
    date: "2020-05-20",
  },
  {
    name: "Muse",
    desc: "Squarespace for 3D Worlds",
    type: "startup",
    link: "https://www.muse.place",
    index: 1,
    start: "2020-08-01",
    end: "2023-07-01",
  },
  {
    name: "Y Combinator S21",
    link: "https://www.ycombinator.com/",
    type: "learn",
    index: 0,
    start: "2021-07-01",
    end: "2021-09-01",
  },
  {
    name: "Follow Jesus Christ",
    type: "faith",
    index: 0,
    // https://github.com/alex-shortt/basis-language/blob/4ee579bf099c3d4ffc921d9aa29e8da659812e95/3_stories/personals/personal%20purpose%20hierarchy.md
    start: "2023-06-04",
    end: undefined,
  },
  {
    name: "Export Mama",
    link: "https://www.exportmama.com/",
    type: "startup",
    index: 1,
    start: "2023-08-24",
    end: "2024-01-14",
  },
  {
    name: "Logic Map",
    link: "https://www.logicmap.com/",
    type: "art",
    index: 2,
    start: "2024-01-15",
    end: undefined,
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <script>
          {`!function (t, e) {
            var o, n, p, r;
            e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
              function g(t, e) {
                var o = e.split(".");
                2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () {
                  t.push([e].concat(Array.prototype.slice.call(arguments, 0)))
                }
              }

              (p = t.createElement("script")).type = "text/javascript", p.async = !0, p.src = s.api_host + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
              var u = e;
              for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) {
                var e = "posthog";
                return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e
              }, u.people.toString = function () {
                return u.toString(1) + ".people (stub)"
              }, o = "capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "), n = 0; n < o.length; n++) g(u, o[n]);
              e._i.push([i, s, a])
            }, e.__SV = 1)
          }(document, window.posthog || []);
            posthog.init('phc_P5H8es69BaGFLoTwhgtGhixyXn5m4KFJiIYw4BZB33v',{api_host:'https://app.posthog.com'})`}
        </script>
        <title>Alexander Shortt</title>
        <meta name="description" content="hello" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="w-full h-full overflow-hidden overflow-y-auto">
        <div
          className={
            "w-full max-w-md px-4 py-8 sm:py-12 md:py-20 mx-auto my-auto" +
            " " +
            inter.className
          }
        >
          <h1 className="text-3xl font-bold">Alexander Shortt</h1>
          <div className="my-8">
            <h4 className="text-lg font-semibold">
              Currently working on{" "}
              <a href="https://www.logicmap.com" className="text-gray-500">
                Logic Map
              </a>
            </h4>
            <div className="flex gap-2">
              <a
                className="text-gray-500"
                href="https://twitter.com/_alexshortt"
              >
                Twitter
              </a>
              <a
                className="text-gray-500"
                href="https://github.com/alex-shortt"
              >
                Github
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-y-1 gap-x-2">
            <div className="faith">faith</div>
            <div className="art">art</div>
            <div className="startup">startup</div>
            <div className="learn">learn</div>
            <div className="work">freelance</div>
          </div>
          <br />
          <div
            className="w-full relative flex mb-16 "
            style={{ height: `${SCALE}px` }}
          >
            <div className="w-14 relative">
              <Dates />
            </div>
            <div className="flex-1 relative">
              <Lines />
              <hr className="border-dashed" />
              {entries.map((entry) => (
                <Entry key={entry.name} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

const left = (index: number) =>
  `calc(${index} * (${SPACE}% * 2) + ${MARGIN}px)`;

function Entry({ entry }: { entry: Entry }) {
  const [active, setActive] = useState(false);

  const switchAllow = useRef(true);
  useEffect(() => {
    const onClick = () => {
      if (switchAllow.current) {
        setActive(false);
      } else {
        switchAllow.current = true;
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const className = cn(
    `transition-all hover:ring-2 ring-offset-1 cursor-pointer ring-[${
      COLOR[entry.type]
    }]`,
    active && `ring-4 hover:ring-4`
  );

  const onClick = () => {
    switchAllow.current = false;
    setActive((active) => !active);
  };

  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    setShowCard(true);
  }, []);

  return (
    <>
      {entry.date ? (
        <Point
          date={new Date(entry.date)}
          index={entry.index}
          type={entry.type}
          className={className}
          onClick={onClick}
        />
      ) : entry.start ? (
        <Line
          start={new Date(entry.start)}
          end={entry.end ? new Date(entry.end) : new Date()}
          type={entry.type}
          index={entry.index}
          onClick={onClick}
          className={className}
        />
      ) : null}
      <Card entry={entry} active={active} />
    </>
  );
}

const getDateY = (date: Date) =>
  (date.getTime() - START.getTime()) / (END.getTime() - START.getTime());
const getDateRangeY = (start: Date, end: Date) => {
  const height =
    (end.getTime() - start.getTime()) / (END.getTime() - START.getTime());
  const midy =
    (start.getTime() - START.getTime()) / (END.getTime() - START.getTime()) -
    height / 2;
  return { height, midy };
};

function Point({
  date,
  index,
  type,
  className,
  onClick,
}: {
  date: Date;
  index: number;
  type: TYPE;
  className?: string;
  onClick?: () => void;
}) {
  const y = getDateY(date);
  const ypx = y * SCALE;
  return (
    <div
      onClick={onClick}
      className={cn(
        "absolute left-0 -translate-x-1/2 -translate-y-1/2 rounded-full",
        className
      )}
      style={{
        bottom: `calc(${ypx}px)`,
        width: `${WIDTH}px`,
        height: `${WIDTH}px`,
        left: left(index),
        backgroundColor: COLOR[type],
      }}
    />
  );
}

function Line({
  start,
  end,
  index,
  type,
  className,
  onClick,
}: {
  start: Date;
  end: Date;
  index: number;
  type: TYPE;
  className?: string;
  onClick?: () => void;
}) {
  const { height, midy } = getDateRangeY(start, end);
  const ypx = midy * SCALE;
  const heightpx = height * SCALE;
  return (
    <div
      onClick={onClick}
      className={cn(
        `absolute left-0 -translate-x-1/2 -translate-y-1/2 w-2 rounded-full`,
        className
      )}
      style={{
        bottom: `calc(${ypx}px)`,
        height: `${heightpx}px`,
        width: `${WIDTH}px`,
        left: left(index),
        backgroundColor: COLOR[type],
      }}
    />
  );
}

function Lines() {
  // mark the first of every year
  const dates = [];
  for (let year = START.getFullYear(); year <= END.getFullYear(); year++) {
    dates.push(new Date(`${year}-01-01 00:00:01`));
  }

  return (
    <>
      {dates.map((date, i) => {
        const y =
          (date.getTime() - START.getTime()) /
          (END.getTime() - START.getTime());
        const ypx = y * SCALE;
        return (
          <hr
            key={i}
            className="absolute left-0 text-xs text-gray-600 translate-y-1/2 z-0 w-full"
            style={{ bottom: `calc(${ypx}px)` }}
          />
        );
      })}
    </>
  );
}

const getCardY = (start: Date, end: Date) => {
  // halfway between start and end
  const startY = getDateY(start);
  const endY = getDateY(end);
  return startY + (endY - startY) / 2;
};

function Card({ entry, active }: { entry: Entry; active: boolean }) {
  const y = entry.date
    ? getDateY(new Date(entry.date))
    : getCardY(
        new Date(entry.start!),
        entry.end ? new Date(entry.end) : new Date()
      );

  const ypx = y * SCALE;

  const children = (
    <>
      <div className="bg-white border-gray-600 border rounded-md p-2 px-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-lg font-semibold">{entry.name}</div>
          {entry.desc && <div className="text-sm">{entry.desc}</div>}
        </div>
        {entry.link && (
          <div>
            <button
              className="px-4 py-2 bg-gray-600 rounded-md text-[#fcfcfc] cursor-pointer hover:bg-gray-600/80 transition-all"
              onClick={() => {
                window.open(entry.link, "_blank");
              }}
            >
              Visit
            </button>
          </div>
        )}
      </div>
    </>
  );

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    setShowCard(true);
  }, []);

  return (
    <>
      {/* this one used on mobile */}
      {showCard &&
        createPortal(
          <div
            className={cn(
              "sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md p-4 scale-0 transition-transform z-10",
              active && "scale-100"
            )}
            onClick={onClick}
          >
            {children}
          </div>,
          document.body
        )}

      {/* this one used when you have the space */}
      <div
        className={cn(
          "hidden sm:block absolute bottom-1/2 translate-y-1/2 left-[calc(50%+14rem)] translate-x-0 w-full max-w-md p-4 scale-0 transition-transform z-10",
          active && "scale-100"
        )}
        onClick={onClick}
        style={{
          bottom: `calc(${ypx}px)`,
          // width: `${WIDTH}px`,
          left: left(entry.index),
        }}
      >
        {children}
      </div>
    </>
  );
}

function Dates() {
  // mark the first of every year
  const dates = [];
  for (let year = START.getFullYear(); year <= END.getFullYear(); year++) {
    dates.push(new Date(`${year}-01-01 00:00:01`));
  }

  // write the years as text positioned on the left
  return (
    <div
      className="absolute left-0 -bottom-0.5 bg-[#fcfcfc]"
      style={{ width: "2.5rem", height: "calc(100% + 30px)" }}
    >
      {dates.map((date, i) => {
        const y =
          (date.getTime() - START.getTime()) /
          (END.getTime() - START.getTime());
        const ypx = y * SCALE;
        return (
          <div
            key={i}
            className="absolute left-0 text-xs text-gray-600 translate-y-1/2"
            style={{ bottom: `calc(${ypx}px)` }}
          >
            {date.getFullYear()}
          </div>
        );
      })}
    </div>
  );
}
