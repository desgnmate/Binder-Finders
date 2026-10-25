"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ChevronRight, Copy, Upload, X } from "lucide-react";
import { saveCard, uploadImage } from "../../app/admin/actions";
import { type CMSCard, cardSchema } from "../../lib/cms/types";
import { useRouter } from "next/navigation";
import { SaveBar } from "./SaveBar";
import { slugify } from "./presentation";
import { useConfirm } from "./ConfirmDialog";
const empty: CMSCard = {
  id: "",
  name: "",
  pokemonId: 1,
  set: "",
  year: 1999,
  number: "",
  rarity: "Common",
  condition: "RAW NM",
  type: "Grass",
  price: 0,
  imageUrl: "",
  backImageUrl: "",
  additionalImages: [],
  description: "",
  publication: "draft",
  availability: "available",
  featuredOrder: null,
  updatedAt: null,
};
const fieldLabels: Record<string, string> = {
  id: "Listing ID",
  name: "Listing name",
  pokemonId: "Pokédex number",
  set: "Set",
  year: "Year",
  number: "Card number",
  price: "Price",
  imageUrl: "Front scan",
  backImageUrl: "Back scan",
  description: "Condition notes",
};
const rarities = [
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Ultra Rare",
  "Secret Rare",
  "Shining Holo",
];
const conditions = ["RAW NM", "RAW LP", "PSA 8", "PSA 9", "PSA 10"];
const types = [
  "Fire",
  "Water",
  "Grass",
  "Lightning",
  "Psychic",
  "Metal",
  "Colorless",
  "Dark",
  "Dragon",
  "Fighting",
  "Ground",
  "Flying",
  "Ice",
  "Bug",
  "Rock",
  "Ghost",
  "Poison",
  "Normal",
  "Steel",
  "Fairy",
];
export function CardEditor({
  card,
  currency = "",
  onClose,
  onDuplicate,
}: {
  card: CMSCard | null;
  currency?: string;
  onClose: (saved?: boolean) => void;
  onDuplicate?: (card: CMSCard) => void;
}) {
  const [value, setValue] = useState<CMSCard>(card || empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [idTouched, setIdTouched] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const confirm = useConfirm();
  const isNew = !value.updatedAt;
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    // The save bar sits at the bottom; bring validation errors into view.
    if (error) errorRef.current?.scrollIntoView?.({ block: "center" });
  }, [error]);
  function change<K extends keyof CMSCard>(key: K, v: CMSCard[K]) {
    setDirty(true);
    setValue((old) => {
      const next = { ...old, [key]: v };
      // New listings get an ID from name, set and number until it is typed.
      if (!card && !idTouched && ["name", "set", "number"].includes(key))
        next.id = slugify(`${next.name} ${next.set} ${next.number}`, 100);
      return next;
    });
  }
  async function close() {
    if (
      !dirty ||
      (await confirm({
        title: "Leave without saving?",
        body: `Your changes to ${value.name || "this listing"} haven't been saved and will be lost.`,
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "danger",
        icon: "edit",
      }))
    )
      onClose();
  }
  async function duplicate() {
    if (!card || !onDuplicate) return;
    if (
      dirty &&
      !(await confirm({
        title: "Duplicate without saving?",
        body: "The copy starts from the last saved version. Your unsaved changes here will be lost.",
        confirmLabel: "Duplicate",
        cancelLabel: "Keep editing",
        tone: "dark",
        icon: "edit",
      }))
    )
      return;
    onDuplicate(card);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = cardSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => {
            const field = String(i.path[0] ?? "");
            return `${fieldLabels[field] || field}: ${i.message}`;
          })
          .join(" · "),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await saveCard(parsed.data);
      if (!result.ok) {
        setError(result.error || "Could not save");
        return;
      }
      setDirty(false);
      router.refresh();
      onClose(true);
    } catch {
      setError(
        "Connection interrupted. Reload to check whether the save completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    file: File | undefined,
    side: "imageUrl" | "backImageUrl" | "additionalImages",
  ) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await uploadImage(form);
      if (!result.ok || !result.url) {
        setError(result.error || "Upload failed");
        return;
      }
      if (side === "additionalImages")
        change(side, [...value.additionalImages, result.url]);
      else change(side, result.url);
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const displayPrice = value.price.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <>
      <div className="cms-editor-heading">
        <div>
          <nav className="cms-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <button type="button" onClick={() => void close()}>
                  Cards
                </button>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li aria-current="page">
                {isNew ? "New listing" : card?.name || "Edit listing"}
              </li>
            </ol>
          </nav>
          <h1>{isNew ? "New listing" : value.name || "Edit listing"}</h1>
          <p>One physical card, its scans, and its condition.</p>
        </div>
        {!isNew && onDuplicate && (
          <button
            type="button"
            className="cms-btn"
            disabled={busy}
            onClick={() => void duplicate()}
          >
            <Copy size={16} /> Duplicate as draft
          </button>
        )}
      </div>
      {error && (
        <div
          ref={errorRef}
          role="alert"
          className="cms-banner"
          data-tone="error"
        >
          <AlertCircle size={18} />
          <span>
            <strong>Couldn&apos;t save.</strong> {error}
          </span>
        </div>
      )}
      <form onSubmit={submit} className="cms-editor">
        <div className="cms-editor-main">
          <fieldset disabled={busy} className="cms-panel">
            <h2>Card details</h2>
            <div className="cms-auto-grid">
              <label className="cms-field">
                Listing name
                <input
                  value={value.name}
                  required
                  maxLength={120}
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <label className="cms-field">
                Listing ID
                <input
                  value={value.id}
                  required
                  pattern="[a-z0-9][a-z0-9-]*"
                  disabled={!isNew}
                  onChange={(e) => {
                    setIdTouched(true);
                    change("id", e.target.value);
                  }}
                />
                <small>
                  {isNew
                    ? "Filled in from the name, set and number. Edit it if this is a second copy."
                    : "Fixed once saved so existing links keep working."}
                </small>
              </label>
              <label className="cms-field">
                Set
                <input
                  value={value.set}
                  required
                  maxLength={120}
                  onChange={(e) => change("set", e.target.value)}
                />
              </label>
              <label className="cms-field">
                Card number
                <input
                  value={value.number}
                  required
                  maxLength={40}
                  onChange={(e) => change("number", e.target.value)}
                />
              </label>
              <label className="cms-field">
                Year
                <input
                  type="number"
                  value={value.year}
                  min={1996}
                  max={2100}
                  required
                  onChange={(e) => change("year", Number(e.target.value))}
                />
              </label>
              <label className="cms-field">
                Pokédex number
                <input
                  type="number"
                  min={1}
                  max={1025}
                  required
                  value={value.pokemonId}
                  onChange={(e) => change("pokemonId", Number(e.target.value))}
                />
              </label>
              <label className="cms-field">
                Rarity
                <select
                  value={value.rarity}
                  onChange={(e) =>
                    change("rarity", e.target.value as CMSCard["rarity"])
                  }
                >
                  {rarities.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="cms-field">
                Card type
                <select
                  value={value.type}
                  onChange={(e) =>
                    change("type", e.target.value as CMSCard["type"])
                  }
                >
                  {types.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Condition / grade</legend>
              <div className="cms-pills">
                {conditions.map((v) => (
                  <label key={v}>
                    <input
                      type="radio"
                      name="condition"
                      value={v}
                      checked={value.condition === v}
                      onChange={() =>
                        change("condition", v as CMSCard["condition"])
                      }
                    />
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="cms-field">
              Condition notes
              <textarea
                value={value.description}
                maxLength={3000}
                onChange={(e) => change("description", e.target.value)}
              />
              <small>
                Scratches, wear, grading details — anything specific to this
                copy.
              </small>
            </label>
          </fieldset>
          <fieldset disabled={busy} className="cms-panel">
            <div className="cms-section-heading">
              <h2>Scans &amp; photos</h2>
              <span className="cms-field-help">
                JPEG, PNG or WebP up to 8 MB · unsaved uploads stay private
              </span>
            </div>
            <div className="cms-scans">
              {(["imageUrl", "backImageUrl"] as const).map((side) => {
                const label = side === "imageUrl" ? "Front scan" : "Back scan";
                return (
                  <div
                    key={side}
                    className="cms-dropzone"
                    data-filled={Boolean(value[side])}
                  >
                    <span>
                      {label}
                      {side === "backImageUrl" && (
                        <span className="cms-field-help"> · optional</span>
                      )}
                    </span>
                    <div className="cms-dropzone-preview">
                      {value[side] ? (
                        <img src={value[side]} alt={`${label} preview`} />
                      ) : (
                        <span>
                          <Upload size={22} />
                          <br />
                          No {label.toLowerCase()} yet
                        </span>
                      )}
                    </div>
                    <div className="cms-actions">
                      <label className="cms-upload">
                        <Upload size={15} />
                        {value[side] ? "Replace" : "Upload"}
                        <input
                          aria-label={`Upload ${side === "imageUrl" ? "front" : "back"} scan`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            void upload(e.target.files?.[0], side);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {value[side] && (
                        <button
                          type="button"
                          className="cms-btn cms-btn-ghost"
                          onClick={() => change(side, "")}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <label className="cms-field">
                      <span className="cms-visually-hidden">
                        {label} image URL
                      </span>
                      <input
                        value={value[side]}
                        onChange={(e) => change(side, e.target.value)}
                        placeholder="…or paste an HTTPS image URL"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="cms-section-heading">
              <h3>
                Additional photos{" "}
                <span className="cms-field-help">
                  {value.additionalImages.length} of 10
                </span>
              </h3>
              <label className="cms-upload">
                <Upload size={15} />
                Add photo
                <input
                  type="file"
                  aria-label="Upload additional photo"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={value.additionalImages.length >= 10}
                  onChange={(e) => {
                    void upload(e.target.files?.[0], "additionalImages");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {value.additionalImages.length > 0 && (
              <div className="cms-photos">
                {value.additionalImages.map((url, i) => (
                  <div className="cms-photo" key={url}>
                    <img src={url} alt={`Additional photo ${i + 1}`} />
                    <button
                      type="button"
                      className="cms-icon-btn"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() =>
                        change(
                          "additionalImages",
                          value.additionalImages.filter((_, n) => n !== i),
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        </div>
        <aside className="cms-editor-side">
          <fieldset disabled={busy} className="cms-panel">
            <h2>Price &amp; status</h2>
            <label className="cms-field">
              Price{currency ? ` (${currency})` : ""}
              <span className="cms-price">
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  step="0.01"
                  value={value.price}
                  required
                  onChange={(e) => change("price", Number(e.target.value))}
                />
              </span>
              <small
                className={value.price < 0.5 ? "cms-field-warning" : undefined}
              >
                {value.price < 0.5
                  ? "Below the 0.50 minimum for card payments. A request for only this card can't be paid online."
                  : "Online card payments need an order total of at least 0.50."}
              </small>
            </label>
            <fieldset>
              <legend>Publication</legend>
              <div className="cms-segmented">
                {(["draft", "published", "archived"] as const).map((v) => (
                  <label key={v}>
                    <input
                      type="radio"
                      name="publication"
                      value={v}
                      checked={value.publication === v}
                      onChange={() => change("publication", v)}
                    />
                    {v}
                  </label>
                ))}
              </div>
              <small className="cms-field-help">
                Drafts and archived cards are hidden from the store.
              </small>
            </fieldset>
            <label className="cms-field">
              Availability
              <select
                value={value.availability}
                onChange={(e) =>
                  change(
                    "availability",
                    e.target.value as CMSCard["availability"],
                  )
                }
              >
                {value.availability === "reserved" && (
                  <option value="reserved">On hold (managed by request)</option>
                )}
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
                <option value="sold">Sold</option>
              </select>
            </label>
            <label className="cms-field">
              Homepage carousel position
              <input
                type="number"
                min={0}
                max={9999}
                placeholder="Not featured"
                value={value.featuredOrder ?? ""}
                onChange={(e) =>
                  change(
                    "featuredOrder",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
              <small>Leave blank to exclude. Smaller numbers appear first.</small>
            </label>
          </fieldset>
          <section className="cms-preview" aria-label="Storefront preview">
            <span className="cms-preview-tag">
              <i />
              Storefront preview
            </span>
            <div className="cms-preview-card">
              <span className="cms-thumb">
                {value.imageUrl ? (
                  <img src={value.imageUrl} alt={value.name || "Card preview"} />
                ) : (
                  "No scan"
                )}
              </span>
              <div>
                <strong>{value.name || "Your card name"}</strong>
                <small>
                  {value.set || "Set"} · {value.number || "Number"}
                </small>
                <small>
                  {value.condition} · {value.rarity}
                </small>
              </div>
            </div>
            <div className="cms-preview-price">
              <strong>
                {currency || "$"} {displayPrice}
              </strong>
              <span className="cms-badge" data-status={value.availability}>
                {value.availability === "reserved"
                  ? "On hold"
                  : value.publication === "published"
                    ? value.availability
                    : value.publication}
              </span>
            </div>
          </section>
        </aside>
        <SaveBar
          dirty={dirty}
          message={
            dirty
              ? "Unsaved changes"
              : isNew
                ? "Fill in the details, then save"
                : "No changes yet"
          }
        >
          <button
            type="button"
            className="cms-btn"
            disabled={busy}
            onClick={() => void close()}
          >
            Cancel
          </button>
          <button className="cms-btn cms-btn-primary" disabled={busy}>
            {busy ? <span className="cms-spinner" /> : <Check size={16} />}
            {busy ? "Saving…" : "Save listing"}
          </button>
        </SaveBar>
      </form>
    </>
  );
}
