import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About — Churrito's Chocolates",
  description:
    "The wholly true and not-at-all-embellished life story of Churrito Burrito Dorito Mu, Pomeranian founder of Churrito's Chocolates and Nobel Paws laureate.",
};

const timeline = [
  {
    year: "2019",
    title: "A star is born (small, very fluffy)",
    body:
      "Churrito Burrito Dorito Mu enters the world weighing slightly less than a single chocolate truffle. Vets describe him as \"alarmingly photogenic.\"",
  },
  {
    year: "2021",
    title: "First taste of destiny",
    body:
      "After a fateful encounter with a fallen cocoa nib, Churrito refuses all kibble until presented with single-origin chocolate. A legend, and a very particular palate, are born.",
  },
  {
    year: "2024",
    title: "Founds Churrito's Chocolates",
    body:
      "Armed with a tiny chef's hat and an unshakeable vision, Churrito establishes the company, personally sniff-approving every bean shipment.",
  },
  {
    year: "2025",
    title: "The Nobel Paws Prize",
    body:
      "Awarded the prestigious Nobel Paws Prize for \"outstanding contributions to the science of joy,\" Churrito accepts the medal with three polite tail wags.",
  },
];

const awards = [
  "Nobel Paws Prize for Outstanding Contributions to Joy",
  "Honorary Doctorate in Cocoa Sciences, University of Treats",
  "World's Best Boy (lifetime achievement, undefeated)",
  "Golden Snout Award for Excellence in Sniffing",
  "Michelin Paw (one paw, awarded for the office snack drawer)",
  "Time Magazine's \"Fluffiest Person of the Year\" (rules were bent)",
];

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-accent/30 p-8 shadow-md ring-1 ring-black/[0.04] dark:from-card dark:via-card dark:to-primary/10 dark:ring-white/[0.06] sm:p-10">
        <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary dark:border-primary/30 dark:bg-primary/15">
              Founder &amp; Chief Chocolatier
            </p>
            <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.35rem] md:leading-tight">
              Meet Churrito Burrito Dorito Mu
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Pomeranian. Visionary. Nobel Paws laureate. The fluffy heart behind every bar and
              truffle at Churrito&apos;s Chocolates. He cannot legally taste chocolate, so he
              supervises with his nose — and his standards are impossibly high.
            </p>
          </div>
          <Image
            src="/churrito-hero.png"
            alt="Churrito the Pomeranian in a chocolatier's hat and apron, holding a chocolate bar and a truffle"
            width={360}
            height={360}
            priority
            className="w-52 shrink-0 drop-shadow-xl sm:w-64 md:w-80"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Early life</h2>
        <p className="max-w-3xl leading-relaxed text-muted-foreground">
          Born into a humble litter and raised on the gentle hum of a kitchen radio, Churrito
          showed an early gift for two things: looking unbearably cute, and identifying the exact
          cupboard where the good snacks were hidden. Family lore holds that his first word was a
          confident bark that, with some imagination, sounded a great deal like &quot;cocoa.&quot;
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Founding the company</h2>
        <p className="max-w-3xl leading-relaxed text-muted-foreground">
          Frustrated by the sorry state of chocolate available at his local park, Churrito did what
          any determined Pomeranian would do: he founded a chocolate company. He insisted on
          single-origin beans, ethical sourcing, and a strict &quot;every batch gets a sniff&quot;
          quality policy that survives to this day. The little chef&apos;s hat was non-negotiable.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">A storied life, by year</h2>
        <ol className="flex flex-col gap-4">
          {timeline.map((item) => (
            <li
              key={item.year}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:gap-5"
            >
              <span className="shrink-0 font-heading text-lg font-semibold text-primary">
                {item.year}
              </span>
              <div>
                <h3 className="font-semibold tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-1 leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Accomplishments &amp; awards</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {awards.map((award) => (
            <li
              key={award}
              className="rounded-xl border border-border/70 bg-card p-4 leading-relaxed text-muted-foreground shadow-sm"
            >
              {award}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/30 p-8 dark:bg-muted/15">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Churrito&apos;s philosophy</h2>
        <blockquote className="max-w-3xl border-l-2 border-primary/40 pl-4 text-lg italic leading-relaxed text-foreground">
          &quot;Make every bar like someone you love is about to taste it. Then make it a little
          better, because they deserve it.&quot;
        </blockquote>
        <p className="max-w-3xl leading-relaxed text-muted-foreground">
          To this day, Churrito naps beside the roasting drum, dreams in shades of cocoa, and
          believes — with his whole fluffy heart — that good chocolate is just kindness you can
          unwrap.
        </p>
      </section>
    </div>
  );
}
