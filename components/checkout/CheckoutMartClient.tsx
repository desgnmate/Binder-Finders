"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ShoppingBag, Trash2 } from "lucide-react";
import { formatPrice } from "../../lib/data";
import { useBag } from "../bag/BagContext";
import { useCatalog } from "../CatalogProvider";
import { isCardAvailable } from "../../lib/data";
import { useRouter } from "next/navigation";
import { TYPE_COLORS, box, btn, btnDark, btnWhite, chip, headline, input, px, wrap } from "../site/ui";
import { AU_STATES, addressLines, deliverySchema, type Delivery as DeliveryDetails } from "../../lib/delivery";

const DELIVERY = {
  post: { label: "Tracked post", detail: "Australia-wide with tracking. We confirm postage when we accept your hold." },
  pickup: { label: "Pick up in Melbourne", detail: "Free. We arrange a time with you after you pay." },
} as const;
type Delivery = keyof typeof DELIVERY;

/**
 * The note the store sees: the delivery choice (and address) first, then
 * anything the customer wrote. The address is also saved on its own; it's in
 * the note too so the store's new-request email shows it.
 */
export function holdNote(delivery: Delivery, note: string, details?: DeliveryDetails | null) {
  const extra = note.trim();
  const address = details?.method === "post" ? addressLines(details) : [];
  const phone = details?.phone ? [`Phone: ${details.phone}`] : [];
  const header = [`Delivery: ${DELIVERY[delivery].label}`, ...address, ...phone].join("\n");
  return `${header}${extra ? `\n\n${extra}` : ""}`;
}

const EMPTY_ADDRESS = { recipient: "", phone: "", line1: "", line2: "", suburb: "", state: "", postcode: "" };

/**
 * Bag and hold request. Customers review their cards, add their details and
 * delivery choice, and send a hold request. Nothing is charged here.
 */
export function CheckoutMartClient({
  initialCardId,
  customer,
}: {
  initialCardId?: string;
  customer: { email: string; name: string } | null;
}) {
  const { hydrated, items, count, total, removeCard, clearBag, addCard, hasCard } = useBag();
  const [submitted, setSubmitted] = useState(false);
  const { settings } = useCatalog();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [website, setWebsite] = useState("");
  const requestKey = useRef("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [pickupNote, setPickupNote] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("post");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const setAddressField = (key: keyof typeof EMPTY_ADDRESS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddress((current) => ({ ...current, [key]: e.target.value }));
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState<{ items: typeof items; total: number; delivery: Delivery } | null>(null);
  const seededRef = useRef(false);
  const hours = settings.holdDurationHours || 48;
  const money = (n: number) => formatPrice(n, settings.currency ? `${settings.currency} ` : "");

  useEffect(() => {
    if (!hydrated || seededRef.current) return;
    seededRef.current = true;
    if (initialCardId && count === 0 && !hasCard(initialCardId)) {
      addCard(initialCardId);
    }
  }, [hydrated, initialCardId, count, addCard, hasCard]);

  useEffect(() => {
    if (!hydrated || !customer) return;
    setContactName((current) => current || customer.name);
    // Hold emails always go to the signed-in account's address.
    setContactEmail(customer.email);
  }, [hydrated, customer]);

  // A retry reuses the request key only for the exact same request. Once the
  // bag or contact details change, the next submit is a new request, so a
  // lost response can never make the server replay an older bag.
  const deliveryCheck = deliverySchema.safeParse(
    delivery === "post"
      ? { method: "post", ...address, recipient: address.recipient.trim() || contactName }
      : { method: "pickup", phone: address.phone },
  );
  const deliveryDetails = deliveryCheck.success ? deliveryCheck.data : null;
  const note = holdNote(delivery, pickupNote, deliveryDetails);
  const requestSignature = JSON.stringify([items.map((c) => c.id), contactName, contactEmail, note]);
  useEffect(() => {
    requestKey.current = "";
  }, [requestSignature]);

  const canContinue = count > 0 && items.every(isCardAvailable) && settings.holdsEnabled && !busy;
  const canSubmit = canContinue && !!contactName.trim() && !!contactEmail.trim() && !!deliveryDetails && agreed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!customer) {
      router.push(`/account/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    setBusy(true);
    setError("");
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          note,
          delivery: deliveryDetails,
          cardIds: items.map((c) => c.id),
          prices: Object.fromEntries(items.map((c) => [c.id, Math.round(c.price * 100)])),
          requestKey: requestKey.current,
          website,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Unable to save your request. Please try again.");
        router.refresh();
        return;
      }
      setSent({ items, total, delivery });
      setReference(result.reference);
      setSubmitted(true);
      clearBag();
    } catch {
      setError("Connection interrupted. Your bag is safe; please try again.");
    } finally {
      setBusy(false);
    }
  };

  const bagLabel = `${count} ${count === 1 ? "Item" : "Items"} in bag`;

  return (
    <main data-checkout-layout="true" className="flex-1 pb-[72px] pt-10">
      <div className={`${wrap} flex flex-col gap-7`}>
        {submitted && sent ? (
          <ConfirmationPanel
            contactEmail={contactEmail}
            reference={reference}
            sent={sent}
            hours={hours}
            money={money}
          />
        ) : (
          <>
            <div data-motion="hero" className="flex flex-col gap-3">
              <Link href="/shop" className="self-start text-[15px] font-semibold text-ink-black">← Keep browsing</Link>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h1 className={`${headline} m-0 text-[40px] leading-[1.05] md:text-[52px]`}>Your bag</h1>
                <span className={`${chip} min-h-[32px] text-sm`} aria-live="polite">{bagLabel}</span>
              </div>
              <p className="m-0 max-w-[640px] text-[17px] leading-normal">
                Send a hold request and we&apos;ll check your cards. Nothing is charged now — you pay once we accept.
              </p>
            </div>

            {count === 0 ? (
              <EmptyBagPanel />
            ) : (
              <>
                <ol className="m-0 hidden list-none flex-wrap items-center gap-3 p-0 md:flex" aria-label="How it works">
                  {["Request a hold", "We accept", `Pay within ${hours} h`, "Shipped or picked up"].map((step, i) => (
                    <li key={step} className="flex items-center gap-3">
                      {i > 0 && <span aria-hidden="true" className="h-[3px] w-12 bg-ink-black lg:w-20" />}
                      <span className="flex items-center gap-2.5 text-sm font-semibold">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-ink-black font-retro text-[10px] ${i === 0 ? "bg-brand-yellow" : "bg-white"}`}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>

                <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-8">
                  <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
                    <section aria-labelledby="bag-cards" className={`${box} flex flex-col gap-3.5 p-5`}>
                      <h2 id="bag-cards" className={`${headline} m-0 text-[22px]`}>
                        {count} {count === 1 ? "card" : "cards"}
                      </h2>
                      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                        {items.map((card) => (
                          <li
                            key={card.id}
                            data-checkout-item="true"
                            className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-ink-black bg-cream p-3"
                          >
                            <Link
                              href={`/cards/${encodeURIComponent(card.id)}`}
                              aria-label={`View ${card.name}`}
                              className="block w-[72px] shrink-0 overflow-hidden rounded-[10px] border-[3px] border-ink-black"
                              style={{ background: TYPE_COLORS[card.type] || "#f1efe6" }}
                            >
                              <img
                                src={card.imageUrl}
                                alt={`${card.name} card`}
                                width={72}
                                height={100}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="aspect-[63/88] w-full object-cover"
                              />
                            </Link>
                            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                              <Link href={`/cards/${encodeURIComponent(card.id)}`} className="text-lg font-bold text-ink-black no-underline">
                                {card.name}
                              </Link>
                              <span className="text-sm text-ink-black/75">
                                {card.set} · {card.number} · {card.condition}
                              </span>
                              {isCardAvailable(card) ? (
                                <span className={`${chip} self-start !bg-[#9fdc8a]`}>Available</span>
                              ) : (
                                <span className={`${chip} self-start !border-red-700 !bg-red-50 !text-red-800`}>No longer available</span>
                              )}
                            </div>
                            <b className="text-lg">{money(card.price)}</b>
                            <button
                              type="button"
                              onClick={() => removeCard(card.id)}
                              aria-label={`Remove ${card.name} from bag`}
                              className={`${btnWhite} !px-3.5`}
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section aria-labelledby="hold-details" className={`${box} flex flex-col gap-[18px] p-6`}>
                      <h2 id="hold-details" className={`${headline} m-0 text-[22px]`}>Your details</h2>
                      <div className="flex flex-wrap gap-3.5">
                        <label htmlFor="checkout-name" className="flex flex-[1_1_240px] flex-col gap-1.5 text-[15px] font-semibold">
                          Name
                          <input
                            id="checkout-name"
                            type="text"
                            required
                            autoComplete="name"
                            maxLength={120}
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            className={input}
                          />
                        </label>
                        <div className="flex flex-[1_1_240px] flex-col gap-1.5">
                        <label htmlFor="checkout-email" className="flex flex-col gap-1.5 text-[15px] font-semibold">
                          Email
                          <input
                            id="checkout-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={contactEmail}
                            readOnly={!!customer}
                            aria-describedby={customer ? "checkout-email-help" : undefined}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className={input}
                          />
                        </label>
                          {customer && (
                            <span id="checkout-email-help" className="text-[13px]">
                              Updates go to your account address.
                            </span>
                          )}
                        </div>
                      </div>
                      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
                        <legend className="mb-2 p-0 text-[15px] font-semibold">How do you want the cards?</legend>
                        {(Object.keys(DELIVERY) as Delivery[]).map((key) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl border-[3px] border-ink-black bg-white px-4 py-3.5 has-[:checked]:bg-pastel-yellow has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-blue/40"
                          >
                            <input
                              type="radio"
                              name="delivery"
                              value={key}
                              checked={delivery === key}
                              onChange={() => setDelivery(key)}
                              className="mt-0.5 h-5 w-5 accent-ink-black"
                            />
                            <span className="flex flex-col gap-0.5">
                              <b>{DELIVERY[key].label}</b>
                              <span className="text-sm">{DELIVERY[key].detail}</span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      {delivery === "post" ? (
                        <fieldset data-checkout-address className="m-0 flex flex-col gap-3 border-0 p-0">
                          <legend className="mb-2 p-0 text-[15px] font-semibold">Where should we post them?</legend>
                          <div className="flex flex-wrap gap-3.5">
                            <label className="flex flex-[1_1_240px] flex-col gap-1.5 text-[15px] font-semibold">
                              <span>
                                Recipient <span className="text-[13px] font-normal">Leave blank if it&apos;s you</span>
                              </span>
                              <input type="text" autoComplete="shipping name" maxLength={120} value={address.recipient} placeholder={contactName} onChange={setAddressField("recipient")} className={input} />
                            </label>
                            <label className="flex flex-[1_1_240px] flex-col gap-1.5 text-[15px] font-semibold">
                              <span>
                                Phone <span className="text-[13px] font-normal">Optional, for the courier</span>
                              </span>
                              <input type="tel" autoComplete="shipping tel" maxLength={40} value={address.phone} onChange={setAddressField("phone")} className={input} />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
                            Street address
                            <input type="text" required autoComplete="shipping address-line1" maxLength={200} value={address.line1} onChange={setAddressField("line1")} className={input} />
                          </label>
                          <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
                            <span>
                              Apartment, unit or PO box <span className="text-[13px] font-normal">Optional</span>
                            </span>
                            <input type="text" autoComplete="shipping address-line2" maxLength={200} value={address.line2} onChange={setAddressField("line2")} className={input} />
                          </label>
                          <div className="flex flex-wrap gap-3.5">
                            <label className="flex flex-[2_1_200px] flex-col gap-1.5 text-[15px] font-semibold">
                              Suburb
                              <input type="text" required autoComplete="shipping address-level2" maxLength={100} value={address.suburb} onChange={setAddressField("suburb")} className={input} />
                            </label>
                            <label className="flex flex-[1_1_110px] flex-col gap-1.5 text-[15px] font-semibold">
                              State
                              <select required autoComplete="shipping address-level1" value={address.state} onChange={setAddressField("state")} className={input}>
                                <option value="">Choose</option>
                                {AU_STATES.map((state) => (
                                  <option key={state} value={state}>
                                    {state}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-[1_1_110px] flex-col gap-1.5 text-[15px] font-semibold">
                              Postcode
                              <input type="text" required inputMode="numeric" pattern="[0-9]{4}" autoComplete="shipping postal-code" maxLength={4} value={address.postcode} onChange={setAddressField("postcode")} className={input} />
                            </label>
                          </div>
                          <span className="text-[13px]">We post within Australia only.</span>
                        </fieldset>
                      ) : (
                        <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
                          <span>
                            Phone <span className="text-[13px] font-normal">Optional, to arrange the pickup</span>
                          </span>
                          <input type="tel" autoComplete="tel" maxLength={40} value={address.phone} onChange={setAddressField("phone")} className={input} />
                        </label>
                      )}
                      <label htmlFor="checkout-pickup" className="flex flex-col gap-1.5 text-[15px] font-semibold">
                        <span>
                          Note for the store{" "}
                          <span className="text-[13px] font-normal">Optional — e.g. ask for corner photos or a bundle price</span>
                        </span>
                        <textarea
                          id="checkout-pickup"
                          value={pickupNote}
                          maxLength={1200}
                          onChange={(e) => setPickupNote(e.target.value)}
                          rows={3}
                          className={`${input} min-h-[96px] resize-y py-3`}
                        />
                      </label>
                      <label className="flex items-start gap-2.5 text-sm leading-normal">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="mt-0.5 h-5 w-5 shrink-0 accent-ink-black"
                        />
                        <span>
                          I agree to the <Link href="/terms" className="font-semibold text-ink-black">terms of sale</Link> and
                          have read the <Link href="/shipping-returns" className="font-semibold text-ink-black">returns policy</Link>.
                        </span>
                      </label>
                      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
                        <label>
                          Website
                          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                        </label>
                      </div>
                    </section>
                  </div>

                  <aside aria-labelledby="summary" className={`${box} flex flex-[1_1_320px] flex-col gap-4 !bg-brand-yellow p-6 md:max-w-[420px]`}>
                    <h2 id="summary" className={`${headline} m-0 text-[22px]`}>Summary</h2>
                    <div className="flex flex-col gap-2.5 text-base">
                      <div className="flex justify-between gap-3">
                        <span>Cards ({count})</span>
                        <b>{money(total)}</b>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>{delivery === "pickup" ? "Pickup" : "Postage"}</span>
                        <b>{delivery === "pickup" ? "Free" : "Confirmed by email"}</b>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-t-[3px] border-ink-black pt-3">
                        <span className="font-semibold">Cards total</span>
                        <span data-checkout-total="true" className={`${headline} whitespace-nowrap text-[22px] md:text-[24px]`}>
                          {money(total)}
                        </span>
                      </div>
                      <span className="text-[13px]">Nothing is charged until we accept your request.</span>
                    </div>
                    {!settings.holdsEnabled && (
                      <p role="status" className="m-0 text-sm">
                        Online hold requests are not currently available.{" "}
                        <a className="font-semibold text-ink-black underline" href={`mailto:${settings.content.contactEmail}`}>
                          Contact the store
                        </a>{" "}
                        to arrange a purchase.
                      </p>
                    )}
                    {items.some((c) => !isCardAvailable(c)) && (
                      <p role="alert" className="m-0 text-sm font-semibold text-red-800">
                        A card in your bag is no longer available. Remove it before requesting a hold.
                      </p>
                    )}
                    {error && (
                      <p role="alert" className="m-0 rounded-xl border-2 border-red-700 bg-white px-3 py-2 text-sm text-red-800">
                        {error}
                      </p>
                    )}
                    {customer ? (
                      <button type="submit" disabled={!canSubmit} className={`${btnDark} min-h-[56px] text-[17px]`}>
                        <ShoppingBag size={18} aria-hidden="true" />
                        {busy ? "Sending…" : "Request Hold"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push(`/account/login?next=${encodeURIComponent("/checkout")}`)}
                        disabled={!canContinue}
                        className={`${btnDark} min-h-[56px] text-[17px]`}
                      >
                        Sign in to request a hold
                      </button>
                    )}
                    {customer && canContinue && !deliveryDetails && (
                      <span className="text-center text-[13px]">
                        {delivery === "post" ? "Add your delivery address to send your request." : "Check your phone number."}
                      </span>
                    )}
                    {customer && canContinue && deliveryDetails && !agreed && (
                      <span className="text-center text-[13px]">Tick the terms box to send your request.</span>
                    )}
                    <div className="flex flex-col gap-2 rounded-[14px] border-2 border-ink-black bg-white p-3.5 text-sm leading-normal">
                      <b>What happens next</b>
                      <span>
                        {customer
                          ? `We check your cards and email you. Once we accept, they're reserved and you have ${hours} hours to pay with Stripe.`
                          : "Sign in to send your request. Your bag stays saved while you do."}
                      </span>
                    </div>
                  </aside>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ConfirmationPanel({
  contactEmail,
  reference,
  sent,
  hours,
  money,
}: {
  contactEmail: string;
  reference: string;
  sent: { items: { id: string; name: string; condition: string; price: number; imageUrl: string; type: string }[]; total: number; delivery: Delivery };
  hours: number;
  money: (n: number) => string;
}) {
  const steps = [
    { title: "Request sent", body: "Just now", done: true },
    { title: "We check the cards and accept", body: "You'll get an email with a secure payment link." },
    { title: `Pay within ${hours} hours`, body: "Your cards are reserved for you while you pay." },
    { title: sent.delivery === "pickup" ? "Ready for pickup" : "Posted to you", body: "We email you when it's on the way or ready." },
  ];
  return (
    <div className="flex flex-wrap items-center gap-10 py-4">
      <section className="flex min-w-0 flex-[1_1_520px] flex-col gap-[22px]">
        <span className={`${chip} min-h-[34px] self-start !bg-[#9fdc8a] text-sm`}>Request #{reference.slice(0, 8).toUpperCase()} received</span>
        <h1 className={`${headline} m-0 text-[40px] leading-[1.05] md:text-[56px]`}>Hold received!</h1>
        <p className="m-0 max-w-[560px] text-[19px] leading-normal">
          We&apos;ve emailed a copy of your request to <b>{contactEmail}</b>. Nothing has been charged.
        </p>
        <ol className={`${box} m-0 flex list-none flex-col gap-[18px] p-6`}>
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-ink-black font-retro text-[11px] ${step.done ? "bg-[#9fdc8a]" : "bg-white"}`}
                aria-hidden="true"
              >
                {step.done ? <Check size={18} /> : i + 1}
              </span>
              <div>
                <b>{step.title}</b>
                <br />
                <span className="text-[15px]">{step.body}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href={reference ? `/account/orders/${reference}` : "/account/orders"} className={`${btnDark} min-h-[52px]`}>Track this request</Link>
          <Link href="/shop" className={`${btnWhite} min-h-[52px]`}>Keep browsing</Link>
        </div>
        <p className="m-0 text-sm">
          Didn&apos;t get the email? Check spam, or <Link href="/contact?topic=order" className="font-semibold text-ink-black">contact us</Link> with your request number.
        </p>
      </section>
      <aside aria-label="Cards in your request" className="flex flex-[1_1_380px] flex-col gap-[18px] rounded-[28px] border-[3px] border-ink-black bg-ink-black p-6 text-white shadow-[6px_6px_0_#1a1a1a] md:max-w-[460px]">
        <span className={`${px} text-brand-yellow`}>In your request</span>
        <div className="flex justify-center gap-[18px]">
          {sent.items.slice(0, 2).map((card, i) => (
            <img
              key={card.id}
              src={card.imageUrl}
              alt={card.name}
              referrerPolicy="no-referrer"
              className={`aspect-[63/88] w-[130px] rounded-xl border-[3px] border-white object-cover sm:w-[150px] ${i === 0 ? "-rotate-6" : "rotate-[5deg]"}`}
              style={{ background: TYPE_COLORS[card.type] || "#f1efe6" }}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2.5 text-base">
          {sent.items.map((card) => (
            <div key={card.id} className="flex justify-between gap-3">
              <span>{card.name} · {card.condition}</span>
              <b>{money(card.price)}</b>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t-2 border-white pt-2.5">
            <span>Cards total</span>
            <b>{money(sent.total)}</b>
          </div>
          <div className="flex justify-between gap-3 text-[#d9d9d9]">
            <span>Delivery</span>
            <span>{DELIVERY[sent.delivery].label}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyBagPanel() {
  return (
    <div className={`${box} flex flex-col items-start gap-4 p-8`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border-[3px] border-ink-black bg-brand-yellow">
        <ShoppingBag size={24} aria-hidden="true" />
      </span>
      <h2 className={`${headline} m-0 text-[28px]`}>Your bag is empty</h2>
      <p className="m-0 max-w-[480px] text-[17px]">Pick a card from the shop or the binder, then come back here to request a hold.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/shop" className={btn}>Shop cards</Link>
        <Link href="/#binder" className={btnWhite}>Browse the binder</Link>
      </div>
    </div>
  );
}
