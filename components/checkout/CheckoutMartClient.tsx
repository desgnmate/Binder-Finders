"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ShoppingBag,
  Trash2,
  ChevronRight,
  Mail,
  User,
  MapPin,
} from "lucide-react";
import { formatPrice, shortCondition } from "../../lib/data";
import { useBag } from "../bag/BagContext";
import { useCatalog } from "../CatalogProvider";
import { isCardAvailable } from "../../lib/data";
import { useRouter } from "next/navigation";

/**
 * CheckoutMartClient — Pokédex-style checkout.
 *
 * Implements the Pokémon FireRed/LeafGreen screen layout:
 *   - Left Panel:
 *     - Top: "Money" style box showing the Total Hold Value ($ AU dollars).
 *     - Bottom: Dialogue style box containing the Hold Request Form and "Request Hold" button.
 *   - Right Panel:
 *     - Dark Pokédex style bezel and Game Boy screen containing scrollable card listings, with hover active indicators.
 */
export function CheckoutMartClient({
  initialCardId,
  customer,
}: {
  initialCardId?: string;
  customer: { email: string; name: string } | null;
}) {
  const { hydrated, items, count, total, removeCard, clearBag, addCard, hasCard } =
    useBag();
  const [submitted, setSubmitted] = useState(false);
  const {settings}=useCatalog();
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [reference,setReference]=useState('');
  const [website,setWebsite]=useState('');
  const requestKey=useRef('');
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const seededRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!hydrated || seededRef.current) return;
    seededRef.current = true;
    if (
      initialCardId &&
      count === 0 &&
      !hasCard(initialCardId)
    ) {
      addCard(initialCardId);
    }
  }, [hydrated, initialCardId, count, addCard, hasCard]);

  useEffect(() => {
    if (!hydrated || !customer) return;
    setContactName((current) => current || customer.name);
    setContactEmail((current) => current || customer.email);
  }, [hydrated, customer]);

  const canContinue = count > 0 && items.every(isCardAvailable) && settings.holdsEnabled && !busy;
  const canSubmit = canContinue && !!contactName.trim() && !!contactEmail.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!customer) {
      router.push(`/account/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    setBusy(true);setError('');
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    try{
      const response=await fetch('/api/holds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:contactName,email:contactEmail,note:pickupNote,cardIds:items.map(c=>c.id),prices:Object.fromEntries(items.map(c=>[c.id,Math.round(c.price*100)])),requestKey:requestKey.current,website})});
      const result=await response.json();
      if(!response.ok){setError(result.error||'Unable to save your request. Please try again.');router.refresh();return;}
      setReference(result.reference);setSubmitted(true);clearBag();
    }catch{setError('Connection interrupted. Your bag is safe; please try again.');}finally{setBusy(false);}
  };

  const handleScroll = (direction: "up" | "down") => {
    if (listRef.current) {
      const scrollAmount = direction === "up" ? -120 : 120;
      listRef.current.scrollBy({ top: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <main
      data-checkout-layout="true"
      className="pokeball-cursor flex min-h-screen lg:h-screen flex-col overflow-y-auto lg:overflow-hidden bg-[#3194EE] p-2 sm:p-3 text-ink-black md:p-5"
    >
      {/* Redesigned Premium Header Bar */}
      <header className="shrink-0 rounded-[24px] border-4 border-ink-black bg-cream p-4 shadow-[4px_4px_0_rgba(26,26,26,1)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ink-black bg-white px-4 py-2 font-body text-xs font-black text-ink-black shadow-[2px_2px_0_rgba(26,26,26,1)] transition-all hover:-translate-y-0.5 hover:bg-brand-yellow hover:shadow-[3px_3px_0_rgba(26,26,26,1)] active:translate-y-0 active:shadow-[1px_1px_0_rgba(26,26,26,1)]"
            >
              <ArrowLeft size={16} aria-hidden="true" className="stroke-[2.5]" />
              <span>Back to Shop</span>
            </Link>
            <div className="h-6 w-[2px] bg-ink-black/15 hidden md:block" />
            <h1 className="font-body text-sm sm:text-lg md:text-xl font-black uppercase tracking-wide text-ink-black hidden md:flex items-center gap-2">
              <span>Pokémart Hold Counter</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border-2 border-ink-black bg-brand-yellow px-4 py-2 font-body text-xs font-black text-ink-black shadow-[2px_2px_0_rgba(26,26,26,1)]">
              <ShoppingBag size={14} aria-hidden="true" className="stroke-[2.5]" />
              <span>{count} {count === 1 ? "Item" : "Items"} in bag</span>
            </div>
          </div>
        </div>
      </header>

      {submitted ? (
        <ConfirmationPanel contactEmail={contactEmail} reference={reference} />
      ) : count === 0 ? (
        <EmptyBagPanel />
      ) : (
        /* Red Pokédex / Console device body */
        <div className="mt-2 flex flex-1 flex-col overflow-hidden rounded-[28px] border-4 border-ink-black bg-[#E94141] p-3 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] md:mt-3 md:p-5">
          {/* Device header lights */}
          <div className="mb-3 flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 rounded-full border-[3px] border-ink-black bg-[#8DEBFF] shadow-[inset_0_0_0_3px_rgba(255,255,255,0.75)] md:h-11 md:w-11" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-yellow" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-blue" />
            <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-black bg-brand-pink" />
          </div>

          {/* Remove overflow-hidden from grid to allow shadows to render fully without clipping! */}
          <div className="grid min-h-0 flex-1 gap-3 sm:gap-4 lg:grid-cols-[0.45fr_0.55fr]">
            {/* Left Column: Order Summary & Form (Pokémart style) */}
            <div className="flex min-h-0 flex-col gap-4">

              {/* Redesigned Hold Total Receipt Card */}
              <div className="rounded-[24px] border-4 border-ink-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-200">
                {/* Decorative retro stripe on the left */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-brand-yellow border-r-2 border-ink-black" />
                <div className="pl-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-body text-xs font-black uppercase tracking-wider text-ink-black/40">
                      Hold Total
                    </span>
                    <div
                      data-checkout-total="true"
                      className="font-body text-3xl md:text-4xl font-black leading-none text-ink-black tracking-tight"
                    >
                      {formatPrice(total, settings.currency ? `${settings.currency} ` : "")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-lg border-2 border-ink-black bg-[#ffd6e0] px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-wider text-ink-black shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                      Hold: Free
                    </span>
                    <span className="font-body text-[9px] font-bold text-ink-black/40">
                      No deposit required
                    </span>
                  </div>
                </div>
              </div>

              {/* Redesigned Checkout Form Container (Separates scrollbar from border to prevent clipping!) */}
              <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border-4 border-ink-black bg-[#fffef9] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] overflow-hidden px-3 py-2">
                <form
                  onSubmit={handleSubmit}
                  className="flex-1 overflow-y-auto pl-4 py-4 pr-3.5 space-y-4 custom-form-scrollbar"
                >
                  <div className="border-b-2 border-dashed border-ink-black/10 pb-4 mb-2">
                    <h2 className="font-body text-base font-black text-ink-black uppercase tracking-wider">
                      Reservation Details
                    </h2>
                    <p className="font-body text-xs text-ink-black/50 mt-1">
                      Request these cards. The store will confirm availability before reserving them.
                    </p>
                  </div>

                  {/* Contact Name Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="checkout-name"
                      className="inline-flex items-center gap-1.5 font-body text-xs font-black uppercase tracking-wide text-ink-black/70"
                    >
                      <User size={13} className="stroke-[2.5]" aria-hidden="true" />
                      Contact Name
                    </label>
                    <div className="relative">
                      <input
                        id="checkout-name"
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Red Ketchum"
                        className="w-full rounded-xl border-2 border-ink-black bg-white px-4 py-3 font-body text-sm font-semibold text-ink-black shadow-[2px_2px_0_0_rgba(26,26,26,1)] focus:outline-none focus:bg-brand-yellow/5 focus:shadow-[3px_3px_0_0_rgba(26,26,26,1)] transition-all placeholder:text-ink-black/30"
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="checkout-email"
                      className="inline-flex items-center gap-1.5 font-body text-xs font-black uppercase tracking-wide text-ink-black/70"
                    >
                      <Mail size={13} className="stroke-[2.5]" aria-hidden="true" />
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        id="checkout-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="you@kanto.com"
                        className="w-full rounded-xl border-2 border-ink-black bg-white px-4 py-3 font-body text-sm font-semibold text-ink-black shadow-[2px_2px_0_0_rgba(26,26,26,1)] focus:outline-none focus:bg-brand-yellow/5 focus:shadow-[3px_3px_0_0_rgba(26,26,26,1)] transition-all placeholder:text-ink-black/30"
                      />
                    </div>
                  </div>

                  {/* Pickup Note Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="checkout-pickup"
                      className="inline-flex items-center gap-1.5 font-body text-xs font-black uppercase tracking-wide text-ink-black/70"
                    >
                      <MapPin size={13} className="stroke-[2.5]" aria-hidden="true" />
                      Pickup Note <span className="text-[10px] text-ink-black/40 font-normal lowercase">(optional)</span>
                    </label>
                    <textarea
                      id="checkout-pickup"
                      value={pickupNote}
                      onChange={(e) => setPickupNote(e.target.value)}
                      placeholder="Meetup preferences, bundle requests, or custom options..."
                      rows={3}
                      className="w-full rounded-xl border-2 border-ink-black bg-white px-4 py-2.5 font-body text-sm font-semibold text-ink-black shadow-[2px_2px_0_0_rgba(26,26,26,1)] focus:outline-none focus:bg-brand-yellow/5 focus:shadow-[3px_3px_0_0_rgba(26,26,26,1)] transition-all placeholder:text-ink-black/30 resize-none animate-none"
                    />
                  </div>

                  <div className="pt-4 mt-auto">
                    <div aria-hidden="true" style={{position:'absolute',left:'-10000px'}}><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
                    {!settings.holdsEnabled&&<p role="status" className="mb-3 text-sm">Online hold requests are not currently available. <a className="underline" href={`mailto:${settings.content.contactEmail}`}>Contact the store</a> to arrange a purchase.</p>}
                    {customer ? <p className="mb-3 text-xs text-ink-black/55">Your request will be saved to your account so you can follow its status later.</p> : <p className="mb-3 text-xs text-ink-black/55">Sign in is required to request a hold. Your bag will stay saved while you sign in.</p>}
                    {items.some(c=>!isCardAvailable(c))&&<p role="alert" className="mb-3 text-sm text-red-700">A card in your bag is no longer available. Remove it before requesting a hold.</p>}
                    {error&&<p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
                    <button
                      type={customer ? "submit" : "button"}
                      onClick={customer ? undefined : () => router.push(`/account/login?next=${encodeURIComponent("/checkout")}`)}
                      disabled={customer ? !canSubmit : !canContinue}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink-black bg-brand-yellow py-3.5 px-6 font-body text-base font-black text-ink-black shadow-[4px_4px_0_0_rgba(26,26,26,1)] enabled:hover:-translate-y-0.5 enabled:hover:shadow-[5px_5px_0_0_rgba(26,26,26,1)] enabled:active:translate-y-[2px] enabled:active:shadow-[2px_2px_0_0_rgba(26,26,26,1)] disabled:opacity-40 transition-all duration-150"
                    >
                      <ShoppingBag size={18} className="stroke-[2.5]" aria-hidden="true" />
                      {busy?'Sending…':customer?'Request Hold':'Sign in to request a hold'}
                      <ChevronRight size={18} className="stroke-[2.5]" aria-hidden="true" />
                    </button>
                    {!(customer ? canSubmit : canContinue) && (
                      <div className="mt-2 text-center font-body text-[10px] font-bold text-ink-black/40">
                        In Bag: {count} {count === 1 ? "card" : "cards"}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Pokédex-Style Screen & Items */}
            <div className="flex h-[340px] lg:h-auto min-h-0 flex-col rounded-[24px] border-4 border-ink-black bg-[#242424] p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-4">
              <div
                data-pokedex-screen-overlay="true"
                className="gameboy-screen gameboy-screen--cart flex min-h-0 flex-1 flex-col rounded-[18px] border-4 border-ink-black bg-[#0a120a] p-2.5 md:p-3 overflow-hidden"
              >
                {/* Up scroll arrow */}
                <button
                  type="button"
                  onClick={() => handleScroll("up")}
                  className="mx-auto flex items-center justify-center py-1 hover:scale-110 active:scale-95 transition-transform"
                  aria-label="Scroll list up"
                >
                  <svg
                    width="20"
                    height="12"
                    viewBox="0 0 24 16"
                    fill="none"
                    className="text-[#D05A28] fill-current"
                  >
                    <path d="M12 0L24 16H0L12 0Z" />
                  </svg>
                </button>

                {/* Scrollable list with visible scrollbar */}
                <ul
                  ref={listRef}
                  className="flex-1 overflow-y-auto py-2 pr-2 snap-y scroll-smooth custom-screen-scrollbar"
                >
                  {items.map((card) => (
                    <li
                      key={card.id}
                      data-checkout-item="true"
                      className="group relative flex items-center justify-between rounded-xl border-2 border-transparent bg-transparent p-3 mb-2 hover:border-[#E94141] hover:bg-[#E94141]/5 transition-all snap-start"
                    >
                      {/* Item indicator arrow (shows on hover) */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Link href={`/shop?card=${encodeURIComponent(card.id)}`} aria-label={`Inspect ${card.name}`} className="shrink-0 rounded-lg bg-white p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-yellow">
                          <img src={card.imageUrl} alt={`${card.name} card`} width={64} height={90} loading="lazy" referrerPolicy="no-referrer" className="h-20 w-14 rounded object-contain sm:h-24 sm:w-16" />
                        </Link>
                        <span className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#D05A28] flex items-center justify-center">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            className="fill-current"
                          >
                            <path d="M0 0L12 6L0 12V0Z" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <span className="block font-body text-sm font-bold text-white group-hover:text-brand-yellow md:text-base">{card.name}</span>
                          <span className="mt-1 block text-[10px] text-white/60">{card.number}</span>
                          <span className="mt-1 inline-block rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-retro text-[6px] text-white/80">{shortCondition(card.condition)}</span>
                        </div>
                      </div>

                      {/* Price tag + Remove */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-retro text-[9px] font-bold text-white group-hover:text-brand-yellow">
                          {formatPrice(card.price, settings.currency ? `${settings.currency} ` : "")}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCard(card.id)}
                          aria-label={`Remove ${card.name} from bag`}
                          className="rounded-lg border border-white/20 bg-white/5 p-1.5 text-white/70 hover:bg-[#E94141] hover:text-white hover:border-[#E94141] transition-colors"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Down scroll arrow */}
                <button
                  type="button"
                  onClick={() => handleScroll("down")}
                  className="mx-auto flex items-center justify-center py-1 hover:scale-110 active:scale-95 transition-transform rotate-180"
                  aria-label="Scroll list down"
                >
                  <svg
                    width="20"
                    height="12"
                    viewBox="0 0 24 16"
                    fill="none"
                    className="text-[#D05A28] fill-current"
                  >
                    <path d="M12 0L24 16H0L12 0Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


function ConfirmationPanel({ contactEmail,reference }: { contactEmail: string;reference:string }) {
  return (
    <div className="mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-[28px] border-4 border-ink-black bg-[#E94141] p-3 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] md:mt-3 md:p-5">
      <div className="w-full max-w-md rounded-[22px] border-[3px] border-ink-black bg-[#DFFFE8] p-5 text-center shadow-[inset_0_0_0_3px_rgba(255,255,255,0.5)] md:p-8">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] border-[3px] border-ink-black bg-brand-yellow shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] md:h-16 md:w-16">
          <Check size={26} aria-hidden="true" />
        </div>
        <h1 className="font-headline text-2xl font-bold leading-none text-ink-black md:text-4xl">
          Hold received!
        </h1>
        <p className="mx-auto mt-2 max-w-sm font-body text-xs leading-relaxed text-ink-black/65 md:text-sm">
          Your request has been saved. The store will contact <strong>{contactEmail}</strong> to confirm availability and arrange payment. Cards are not reserved until confirmed.
        </p>
        <p className="mt-3 text-sm font-bold">Reference: {reference.slice(0,8).toUpperCase()}</p>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink-black bg-brand-yellow px-4 py-2.5 font-retro text-[9px] text-ink-black shadow-[3px_3px_0_rgba(26,26,26,1)]"
          >
            Continue shopping
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink-black bg-white px-4 py-2.5 font-retro text-[9px] text-ink-black shadow-[3px_3px_0_rgba(26,26,26,1)]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Dialog-style empty bag panel
function EmptyBagPanel() {
  return (
    <div className="mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-[28px] border-4 border-ink-black bg-[#E94141] p-3 shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] md:mt-3 md:p-5">
      <div className="w-full max-w-md rounded-[22px] border-[3px] border-ink-black bg-[#DFFFE8] p-5 text-center shadow-[inset_0_0_0_3px_rgba(255,255,255,0.5)] md:p-8">
        <div className="mb-3 text-5xl">🎒</div>
        <h1 className="font-headline text-2xl font-bold leading-none text-ink-black md:text-4xl">
          Your bag is empty
        </h1>
        <p className="mx-auto mt-2 max-w-sm font-body text-xs text-ink-black/65 md:text-sm">
          Pick a card from the binder, then come back here to request a hold.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/#binder"
            className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink-black bg-brand-yellow px-4 py-2.5 font-retro text-[9px] text-ink-black shadow-[3px_3px_0_rgba(26,26,26,1)]"
          >
            Browse the binder
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink-black bg-white px-4 py-2.5 font-retro text-[9px] text-ink-black shadow-[3px_3px_0_rgba(26,26,26,1)]"
          >
            Shop cards
          </Link>
        </div>
      </div>
    </div>
  );
}
