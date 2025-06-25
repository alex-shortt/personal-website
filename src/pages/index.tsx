"use client";

import Head from "next/head";
import { Inter } from "@next/font/google";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/logic/cn";
import { createPortal } from "react-dom";
import posthog from "posthog-js";

const inter = Inter({ subsets: ["latin"] });

type TYPE = "faith" | "art" | "startup" | "learn" | "work";
const COLOR: { [key in TYPE]: string } = {
  faith: "#9871d8",
  art: "#00eeff",
  startup: "#fb6518",
  learn: "#75ce1c",
  work: "#ff007b",
};

export const dynamic = "force-dynamic";

// code to cause a cache bust
const cacheBust = new Date().getTime();

const START = new Date("2000-03-28");
const END = () => new Date(); // now
const SCALE = 1400; // px
const PADDING_X = 20; // px
const WIDTH = 11; // px

const NUM_COLUMNS = 4;

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

const entryId = (e: Entry) => e.name.toLowerCase().replaceAll(" ", "-");

const entries: Entry[] = [
  {
    name: "GTAV Portal Gun Mod",
    link: "https://www.gta5-mods.com/scripts/portal-gun-net",
    type: "art",
    desc: "This was a triumph. I'm making a note here: HUGE SUCCESS.",
    index: 2,
    date: "2015-07-05",
  },
  {
    name: "AWGE",
    desc: "Creative Agency for A$AP Rocky, A$AP Ferg, and more",
    link: "https://www.awge.com",
    type: "work",
    index: 3,
    date: "2017-08-07",
  },
  {
    name: "Metaplug",
    type: "startup",
    link: "https://www.getinstadata.com/",
    desc: "Instagram data scraper and marketing agency",
    index: 1,
    start: "2017-11-01",
    end: "2020-08-01",
  },
  {
    name: "First Personal Website",
    link: "http://first-personal-site.s3-website-us-west-1.amazonaws.com/",
    type: "art",
    index: 2,
    date: "2018-06-26",
  },
  {
    name: "UC Santa Barbara",
    desc: "Computer Science Major, Philosophy Minor. Did not finish.",
    type: "learn",
    link: "https://www.ucsb.edu/",
    index: 0,
    start: "2018-08-10",
    end: "2021-04-29",
  },
  {
    name: "SASH",
    desc: "Singer, Songwriter",
    link: "http://smile.sashsite.com.s3-website-us-west-1.amazonaws.com/",
    type: "work",
    index: 3,
    date: "2019-08-25",
  },
  {
    name: "Mini Weapons & Co.",
    desc: "Built and sold mini weapons of mass destruction to classmates",
    type: "startup",
    index: 1,
    start: "2011-01-30",
    end: "2011-04-25",
  },
  // {
  //   name: "Foundation",
  //   link: "https://assets.mediated.world/site/foundation/inbed.mp4",
  //   desc: "",
  //   type: "art",
  //   index: 3,
  //   date: "2019-12-07",
  // },
  {
    name: "mediated.world Trailer",
    desc: "A depiction of entering mediated.world for the first time",
    link: "https://trailer.mediated.world",
    type: "art",
    index: 2,
    date: "2019-12-12",
  },
  {
    name: "Latent Explorer",
    desc: "GAN trained on images of the beach",
    link: "https://assets.mediated.world/site/latent-explorer/wide-video.mp4",
    type: "art",
    index: 2,
    date: "2020-04-07",
  },
  {
    name: "Jermaine Fowler",
    desc: "Actor, Comedian, Producer, Writer",
    link: "http://jermaine-fowler-site.s3-website-us-west-1.amazonaws.com/",
    type: "work",
    index: 3,
    date: "2020-05-20",
  },
  {
    name: "Muse",
    desc: "Website builder for 3D Worlds",
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
    name: "Follow Jesus",
    type: "faith",
    index: 0,
    // https://github.com/alex-shortt/basis-language/blob/4ee579bf099c3d4ffc921d9aa29e8da659812e95/3_stories/personals/personal%20purpose%20hierarchy.md
    start: "2023-06-04",
    end: undefined,
  },
  {
    name: "Export Mama",
    link: "https://www.exportmama.com/",
    desc: "Platform for sourcing Vietnamese Apparel",
    type: "startup",
    index: 1,
    start: "2023-08-24",
    end: "2024-01-14",
  },
  {
    name: "The Creature Finds Its Voice",
    link: "https://muse-world-creatureworld.vercel.app/",
    desc: "3D World for Creature World",
    type: "art",
    index: 2,
    date: "2021-12-22",
  },
  {
    name: "Logic Map",
    link: "https://www.logicmap.com/",
    desc: "Platform for pursuing Truth",
    type: "art",
    index: 2,
    start: "2024-01-15",
    end: "2024-10-14",
  },
  {
    name: "Swift Systems",
    link: "https://www.swiftsystems.ai/",
    desc: "ERP for Aerospace / Defense Manufacturing",
    type: "startup",
    index: 1,
    start: "2024-10-14",
    end: "2025-05-28",
  },
  {
    name: "Revenge x Storm",
    link: "https://www.revengexstorm.com/",
    desc: "Shoe brand created by Ian Connor",
    type: "work",
    index: 3,
    date: "2016-12-01",
  },
  {
    name: "[Mix 001] It's Always Been You",
    link: "https://soundcloud.com/alex_shortt/mix-001",
    type: "art",
    index: 2,
    date: "2017-03-13",
  },
  {
    name: "[Mix 002] I Want To Be Like You",
    link: "https://soundcloud.com/alex_shortt/mix-002",
    type: "art",
    index: 2,
    date: "2017-11-04",
  },
  {
    name: "[Mix 003] I Want It To Just Be Me And You",
    link: "https://soundcloud.com/alex_shortt/mix-003",
    type: "art",
    index: 2,
    date: "2019-03-03",
  },
  {
    name: "[Mix 004] I Want to Find You",
    link: "https://soundcloud.com/alex_shortt/mix-004",
    type: "art",
    index: 2,
    date: "2022-04-04",
  },
];

export default function Home() {
  return (
    <>
      <Head>
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
            <h4 className="text-lg font-semibold">Restore beauty and order</h4>
            <div className="flex gap-2">
              <a
                className="text-gray-500"
                href="https://twitter.com/_alexshortt"
                onClick={() => posthog.capture("twitter")}
              >
                Twitter
              </a>
              <a
                className="text-gray-500"
                href="https://github.com/alex-shortt"
                onClick={() => posthog.capture("github")}
              >
                Github
              </a>
              <a
                className="text-gray-500"
                href="https://www.are.na/alex-shortt/channels"
                onClick={() => posthog.capture("are.na")}
              >
                Are.na
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-y-1 gap-x-2">
            <div className="faith">faith</div>
            <div className="learn">learn</div>
            <div className="startup">startup</div>
            <div className="art">art</div>
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

const left = (index: number) => {
  const left = `(${WIDTH / 2}px + ${PADDING_X}px)`;
  const right = `(100% - ${WIDTH / 2}px - ${PADDING_X}px)`;
  const perc = index / (NUM_COLUMNS - 1);
  return `calc(${left} + (${right} - ${left}) * ${perc})`;
};

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
    posthog.capture(`click-${entryId(entry)}`);
  };

  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    setShowCard(true);
  }, []);

  if (!showCard) return null;

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
          end={entry.end ? new Date(entry.end) : undefined}
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
  (date.getTime() - START.getTime()) / (END().getTime() - START.getTime());
const getDateRangeY = (start: Date, end: Date) => {
  const height =
    (end.getTime() - start.getTime()) / (END().getTime() - START.getTime());
  const midy =
    (start.getTime() - START.getTime()) / (END().getTime() - START.getTime()) -
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
        "absolute left-0 -translate-x-1/2 translate-y-1/2 rounded-full",
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
  end: Date | undefined;
  index: number;
  type: TYPE;
  className?: string;
  onClick?: () => void;
}) {
  const { height, midy } = getDateRangeY(start, end || new Date());
  const ypx = midy * SCALE;
  const heightpx = height * SCALE;
  return (
    <div
      onClick={onClick}
      className={cn(
        `absolute left-0 -translate-x-1/2 -translate-y-1/2 w-2 rounded-b-full`,
        end !== undefined && "rounded-t-full",
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
  for (let year = START.getFullYear(); year <= END().getFullYear(); year++) {
    dates.push(new Date(`${year}-01-01 00:00:01`));
  }

  return (
    <>
      {dates.map((date, i) => {
        const y =
          (date.getTime() - START.getTime()) /
          (END().getTime() - START.getTime());
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
                posthog.capture(`visit-${entryId(entry)}`);
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
  for (let year = START.getFullYear(); year <= END().getFullYear(); year++) {
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
          (END().getTime() - START.getTime());
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
