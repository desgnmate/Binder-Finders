"use client";
import { useEffect, useState } from "react";
import { Save, ArrowLeft, Copy, Upload } from "lucide-react";
import { saveCard, uploadImage } from "../../app/admin/actions";
import { type CMSCard, cardSchema } from "../../lib/cms/types";
import { useRouter } from "next/navigation";
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
export function CardEditor({
  card,
  onClose,
}: {
  card: CMSCard | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState<CMSCard>(card || empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
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
  function change<K extends keyof CMSCard>(key: K, v: CMSCard[K]) {
    setDirty(true);
    setValue((old) => ({ ...old, [key]: v }));
  }
  function close() {
    if (!dirty || window.confirm("Discard your unsaved changes?")) onClose();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = cardSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
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
      onClose();
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
  return (
    <>
      <div className="cms-title">
        <div>
          <button className="cms-btn" onClick={close}>
            <ArrowLeft size={16} /> Back to cards
          </button>
          <h1 style={{ marginTop: 18 }}>
            {value.updatedAt ? "Edit listing" : "New listing"}
          </h1>
          <p>One physical card, its scans, and its condition.</p>
        </div>
        {value.updatedAt && (
          <button
            className="cms-btn"
            disabled={busy}
            onClick={() => {
              setValue({
                ...value,
                id: "",
                publication: "draft",
                availability: "available",
                updatedAt: null,
                featuredOrder: null,
              });
              setDirty(true);
            }}
          >
            <Copy size={16} /> Duplicate as draft
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="cms-notice cms-error">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="cms-editor">
        <div>
          <fieldset disabled={busy} className="cms-panel">
            <h2>Card details</h2>
            <div className="cms-grid">
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
                  disabled={Boolean(value.updatedAt)}
                  onChange={(e) => change("id", e.target.value)}
                />
                <small>
                  Unique lowercase ID, e.g. charizard-base1-copy2. Existing
                  links keep this ID.
                </small>
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
                Set
                <input
                  value={value.set}
                  required
                  maxLength={120}
                  onChange={(e) => change("set", e.target.value)}
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
                Card number
                <input
                  value={value.number}
                  required
                  maxLength={40}
                  onChange={(e) => change("number", e.target.value)}
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
                  {[
                    "Common",
                    "Uncommon",
                    "Rare",
                    "Rare Holo",
                    "Ultra Rare",
                    "Secret Rare",
                    "Shining Holo",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="cms-field">
                Condition / grade
                <select
                  value={value.condition}
                  onChange={(e) =>
                    change("condition", e.target.value as CMSCard["condition"])
                  }
                >
                  {["RAW NM", "RAW LP", "PSA 8", "PSA 9", "PSA 10"].map((v) => (
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
                  {[
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
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="cms-field">
                Price
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  step="0.01"
                  value={value.price}
                  required
                  onChange={(e) => change("price", Number(e.target.value))}
                />
              </label>
              <label className="cms-field cms-wide">
                Condition notes
                <textarea
                  value={value.description}
                  maxLength={3000}
                  onChange={(e) => change("description", e.target.value)}
                />
                <small>
                  Record scratches, wear, grading details, or other
                  listing-specific information.
                </small>
              </label>
            </div>
          </fieldset>
          <fieldset disabled={busy} className="cms-panel">
            <h2>Scans & photos</h2>
            <p className="cms-muted">
              Upload JPEG, PNG or WebP files up to 8 MB. Use scans of this exact
              card. Unsaved uploads remain private.
            </p>
            {(["imageUrl", "backImageUrl"] as const).map((side) => (
              <div key={side} style={{ marginTop: 18 }}>
                <label className="cms-field">
                  {side === "imageUrl" ? "Front scan" : "Back scan (optional)"}
                  <input
                    value={value[side]}
                    onChange={(e) => change(side, e.target.value)}
                    placeholder="Upload below or enter an HTTPS image URL"
                  />
                </label>
                <div className="cms-image-row">
                  {value[side] ? (
                    <img
                      src={value[side]}
                      alt={
                        side === "imageUrl"
                          ? "Front scan preview"
                          : "Back scan preview"
                      }
                    />
                  ) : (
                    <Upload size={26} />
                  )}
                  <input
                    aria-label={`Upload ${side === "imageUrl" ? "front" : "back"} scan`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      void upload(e.target.files?.[0], side);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="cms-separator" />
            <label className="cms-field">
              Additional photos ({value.additionalImages.length}/10)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={value.additionalImages.length >= 10}
                onChange={(e) => {
                  void upload(e.target.files?.[0], "additionalImages");
                  e.target.value = "";
                }}
              />
            </label>
            {value.additionalImages.map((url, i) => (
              <div className="cms-image-row" key={url}>
                <img src={url} alt={`Additional photo ${i + 1}`} />
                <button
                  type="button"
                  className="cms-btn"
                  onClick={() =>
                    change(
                      "additionalImages",
                      value.additionalImages.filter((_, n) => n !== i),
                    )
                  }
                >
                  Remove photo {i + 1}
                </button>
              </div>
            ))}
          </fieldset>
          <fieldset disabled={busy} className="cms-panel">
            <h2>Publishing & availability</h2>
            <div className="cms-grid">
              <label className="cms-field">
                Publication
                <select
                  value={value.publication}
                  onChange={(e) =>
                    change(
                      "publication",
                      e.target.value as CMSCard["publication"],
                    )
                  }
                >
                  {["draft", "published", "archived"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <small>
                  Drafts and archived cards are hidden from the store.
                </small>
              </label>
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
                  {[
                    "available",
                    "unavailable",
                    "sold",
                    ...(value.availability === "reserved" ? ["reserved"] : []),
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <small>
                  Reserved cards are managed through their hold requests.
                </small>
              </label>
              <label className="cms-field">
                Hero carousel position
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={value.featuredOrder ?? ""}
                  onChange={(e) =>
                    change(
                      "featuredOrder",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
                <small>
                  Leave blank to exclude. Smaller numbers appear first.
                </small>
              </label>
            </div>
          </fieldset>
          <div className="cms-actions">
            <button className="cms-btn cms-btn-primary" disabled={busy}>
              <Save size={17} />
              {busy ? "Saving…" : "Save listing"}
            </button>
            <button
              type="button"
              className="cms-btn"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>
        <aside className="cms-preview">
          <span className="cms-badge">Listing preview · unsaved</span>
          {value.imageUrl && (
            <img src={value.imageUrl} alt={value.name || "Card preview"} />
          )}
          <h2>{value.name || "Your card name"}</h2>
          <p>
            {value.set || "Set"} · {value.number || "Number"}
          </p>
          <p>
            {value.condition} · {value.rarity}
          </p>
          <strong style={{ fontSize: 28 }}>
            {value.price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </strong>
          <p>
            <span className="cms-badge" data-status={value.publication}>
              {value.publication}
            </span>{" "}
            <span className="cms-badge" data-status={value.availability}>
              {value.availability}
            </span>
          </p>
          {value.backImageUrl && (
            <>
              <p>Back scan</p>
              <img src={value.backImageUrl} alt="Back scan" />
            </>
          )}
          <p className="cms-muted">{value.description}</p>
        </aside>
      </form>
    </>
  );
}
