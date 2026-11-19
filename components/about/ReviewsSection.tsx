"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCatalog } from "../CatalogProvider";

export function ReviewsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const {
    settings: { content },
  } = useCatalog();

  const savedReviews = [
    { quote: content.review1Quote, name: content.review1Name },
    { quote: content.review2Quote, name: content.review2Name },
    { quote: content.review3Quote, name: content.review3Name },
  ].filter((review) => review.quote.trim() && review.name.trim());

  const reviews =
    savedReviews.length > 0
      ? savedReviews
      : process.env.NODE_ENV === "development"
        ? [
            { quote: "Preview review text for layout testing only.", name: "Preview collector 1" },
            { quote: "Another sample testimonial to check spacing and card balance.", name: "Preview collector 2" },
            { quote: "Temporary local content. This will not appear in production.", name: "Preview collector 3" },
          ]
        : [];

  if (reviews.length === 0) return null;

  return (
    <section
      id="reviews"
      data-reviews-section="true"
      className="pokeball-cursor px-4 pb-16 md:px-8 md:pb-24"
    >
      <div className="mx-auto max-w-7xl rounded-[28px] border-[3px] border-ink-black bg-cream bg-[radial-gradient(#e5dfcd_1.5px,transparent_1.5px)] [background-size:24px_24px] p-5 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] md:p-8 lg:p-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="font-retro text-[8px] uppercase tracking-[0.2em] text-ink-black/45">
              Collector notes
            </span>
            <h2 className="mt-2 font-headline text-3xl font-black leading-tight text-ink-black sm:text-4xl md:text-5xl">
              {content.reviewsTitle}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {reviews.length > 1 && (
              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  aria-label="Show previous review"
                  disabled={atStart}
                  onClick={() => {
                    const track = trackRef.current;
                    if (!track) return;

                    track.scrollBy({
                      left: -Math.max(track.clientWidth * 0.82, 260),
                      behavior: "smooth",
                    });
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink-black bg-brand-yellow text-ink-black shadow-[2px_2px_0_0_rgba(26,26,26,1)] transition-all disabled:cursor-default disabled:opacity-30 disabled:shadow-none"
                >
                  <ArrowLeft size={19} strokeWidth={3} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  aria-label="Show next review"
                  disabled={atEnd}
                  onClick={() => {
                    const track = trackRef.current;
                    if (!track) return;

                    track.scrollBy({
                      left: Math.max(track.clientWidth * 0.82, 260),
                      behavior: "smooth",
                    });
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink-black bg-brand-yellow text-ink-black shadow-[2px_2px_0_0_rgba(26,26,26,1)] transition-all disabled:cursor-default disabled:opacity-30 disabled:shadow-none"
                >
                  <ArrowRight size={19} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            )}

            <img
              src="/sprites/gen3/175.png"
              alt=""
              aria-hidden="true"
              className="hidden h-16 w-16 object-contain [image-rendering:pixelated] md:block"
              width={64}
              height={64}
            />
          </div>
        </div>

        <div className="relative">
          <div
            ref={trackRef}
            onScroll={(event) => {
              const track = event.currentTarget;
              const remaining = track.scrollWidth - track.clientWidth - track.scrollLeft;

              setAtStart(track.scrollLeft <= 8);
              setAtEnd(remaining <= 8);
            }}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0 md:pr-0"
          >
          {reviews.map((review, index) => (
            <article
              key={`${review.name}-${index}`}
              className="relative flex min-h-[190px] w-[82%] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border-[3px] border-ink-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:min-h-[220px] md:w-auto md:shrink md:p-6"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(49,148,238,0.05)_1px,transparent_1px)] bg-[size:100%_28px]"
              />

              <div className="relative z-10">
                <div className="mb-4 font-headline text-4xl leading-none text-brand-pink">
                  “
                </div>
                <p className="font-body text-sm leading-relaxed text-ink-black/85 md:text-base">
                  {review.quote}
                </p>
              </div>

              <div className="relative z-10 mt-6 border-t border-ink-black/10 pt-4">
                <p className="font-headline text-lg font-bold text-ink-black">
                  {review.name}
                </p>
                <p className="mt-1 font-retro text-[7px] uppercase tracking-wider text-ink-black/40">
                  Collector review
                </p>
              </div>
            </article>
          ))}
          </div>


        </div>
      </div>
    </section>
  );
}

