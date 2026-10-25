"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useConfirm } from "./ConfirmDialog";
import type { StoreSettings } from "../../lib/cms/types";
import { inviteAdmin, setAdmin } from "../../app/admin/actions";
import { SaveBar } from "./SaveBar";

type Run = (
  action: () => Promise<{ ok: boolean; error?: string }>,
  success: string,
) => Promise<boolean>;
type ContentKey = keyof StoreSettings["content"];
type Admin = {
  user_id: string;
  email: string;
  role: "owner" | "editor";
  active: boolean;
};

// Limits mirror contentSchema so editors see them before saving.
const contentSections: {
  title: string;
  description: string;
  fields: [ContentKey, string, number, "text" | "long" | "email"][];
}[] = [
  {
    title: "Homepage hero",
    description: "The headline, subtitle and button at the top of the homepage.",
    fields: [
      ["heroLine1", "Headline · line 1", 22, "text"],
      ["heroLine2", "Headline · line 2", 22, "text"],
      ["heroSubtitle", "Subtitle", 180, "long"],
      ["heroCta", "Button text", 24, "text"],
    ],
  },
  {
    title: "About section",
    description: "Introduces the store further down the homepage.",
    fields: [
      ["aboutTitle", "Title", 90, "text"],
      ["aboutBody", "Description", 600, "long"],
    ],
  },
  {
    title: "Footer",
    description: "Shown at the bottom of every storefront page.",
    fields: [
      ["footerTitle", "Title", 50, "text"],
      ["footerDescription", "Introduction", 240, "long"],
      ["storeDescription", "Store description", 600, "long"],
      ["contactEmail", "Contact email", 200, "email"],
      ["location", "Location", 100, "text"],
    ],
  },
];

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="cms-panel cms-settings-section">
      <div>
        <h2>{title}</h2>
        <p className="cms-muted">{description}</p>
      </div>
      <div className="cms-grid">{children}</div>
    </section>
  );
}

function FormSaveBar({
  dirty,
  busy,
  label,
  onDiscard,
}: {
  dirty: boolean;
  busy: boolean;
  label: string;
  onDiscard: () => void;
}) {
  return (
    <SaveBar
      dirty={dirty}
      message={dirty ? "You have unsaved changes" : "All changes saved"}
    >
      {dirty && (
        <button
          type="button"
          className="cms-btn"
          disabled={busy}
          onClick={onDiscard}
        >
          Discard
        </button>
      )}
      <button className="cms-btn cms-btn-primary" disabled={busy || !dirty}>
        {busy ? "Saving…" : label}
      </button>
    </SaveBar>
  );
}

export function AdminContentForm({
  draft,
  dirty,
  busy,
  onChange,
  onDiscard,
  onSave,
}: {
  draft: StoreSettings;
  dirty: boolean;
  busy: boolean;
  onChange: (settings: StoreSettings) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className="cms-settings"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <fieldset disabled={busy}>
        {contentSections.map((section) => (
          <SettingsSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            {section.fields.map(([key, label, max, kind]) => {
              const value = draft.content[key];
              const update = (next: string) =>
                onChange({
                  ...draft,
                  content: { ...draft.content, [key]: next },
                });
              return (
                <label
                  key={key}
                  className={`cms-field ${kind === "long" ? "cms-wide" : ""}`}
                >
                  <span className="cms-field-label">
                    {label}
                    {kind !== "email" && (
                      <small
                        aria-hidden="true"
                        data-near-limit={value.length > max * 0.9}
                      >
                        {value.length}/{max}
                      </small>
                    )}
                  </span>
                  {kind === "long" ? (
                    <textarea
                      required
                      maxLength={max}
                      value={value}
                      onChange={(e) => update(e.target.value)}
                    />
                  ) : (
                    <input
                      type={kind === "email" ? "email" : "text"}
                      required
                      maxLength={max}
                      value={value}
                      onChange={(e) => update(e.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </SettingsSection>
        ))}
      </fieldset>
      <FormSaveBar
        dirty={dirty}
        busy={busy}
        label="Save content"
        onDiscard={onDiscard}
      />
    </form>
  );
}

export function AdminSettingsForm({
  draft,
  dirty,
  busy,
  canEdit,
  stripeReady,
  onChange,
  onDiscard,
  onSave,
}: {
  draft: StoreSettings;
  dirty: boolean;
  busy: boolean;
  canEdit: boolean;
  stripeReady: boolean;
  onChange: (settings: StoreSettings) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className="cms-settings"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {!canEdit && (
        <div className="cms-banner" role="note">
          <Lock size={18} />
          <span>
            Only store owners can change these settings. Ask an owner if
            something needs updating.
          </span>
        </div>
      )}
      <fieldset disabled={busy || !canEdit}>
        <SettingsSection
          title="Currency"
          description="The currency every listing price is shown in."
        >
          <label className="cms-field">
            Store currency
            <select
              value={draft.currency}
              onChange={(e) =>
                onChange({
                  ...draft,
                  currency: e.target.value as StoreSettings["currency"],
                })
              }
            >
              <option value="">Choose currency</option>
              {["AUD", "USD", "PHP", "GBP", "EUR", "CAD", "NZD", "JPY"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
            <small>
              Existing numeric prices are not converted. Confirm their intended
              currency before saving.
            </small>
          </label>
        </SettingsSection>
        <SettingsSection
          title="Hold requests"
          description="Customers submit a request; an administrator confirms it and reserves the cards."
        >
          <label className="cms-switch cms-wide">
            <span>
              Accept hold requests
              <small>Turn off to pause new requests from the storefront.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={draft.holdsEnabled}
              onChange={(e) =>
                onChange({ ...draft, holdsEnabled: e.target.checked })
              }
            />
          </label>
          <label className="cms-field">
            Unpaid hold duration (hours)
            <input
              type="number"
              min={1}
              max={720}
              value={draft.holdDurationHours}
              onChange={(e) =>
                onChange({
                  ...draft,
                  holdDurationHours: Number(e.target.value),
                })
              }
            />
            <small>
              Newly accepted unpaid holds expire after this period. Existing
              holds are unchanged.
            </small>
          </label>
        </SettingsSection>
        <SettingsSection
          title="Payments"
          description="Online card payment for accepted requests."
        >
          <div
            className="cms-wide cms-integration-status"
            data-status={stripeReady ? "ready" : "unavailable"}
          >
            <strong>
              Stripe payments: {stripeReady ? "configured" : "foundation only"}
            </strong>
            <span>
              {stripeReady
                ? "Accepted customers can open secure card checkout."
                : "Add the server-only Stripe keys and webhook secret before enabling online payment."}
            </span>
          </div>
        </SettingsSection>
      </fieldset>
      {canEdit && (
        <FormSaveBar
          dirty={dirty}
          busy={busy}
          label="Save settings"
          onDiscard={onDiscard}
        />
      )}
    </form>
  );
}

export function AdminAccess({
  admins,
  userId,
  busy,
  run,
}: {
  admins: Admin[];
  userId: string;
  busy: boolean;
  run: Run;
}) {
  const [invite, setInvite] = useState("");
  const [existingId, setExistingId] = useState("");
  const [existingEmail, setExistingEmail] = useState("");
  const confirm = useConfirm();
  return (
    <SettingsSection
      title="Administrators"
      description="Owners manage access and store settings. Editors manage cards, content, and requests."
    >
      <ul className="cms-admin-list cms-wide">
        {admins.map((a) => (
          <li key={a.user_id}>
            <span
              className="cms-avatar"
              data-tone={a.user_id === userId ? undefined : "soft"}
              aria-hidden="true"
            >
              {a.email.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>
                {a.email}
                {a.user_id === userId && <small> (you)</small>}
              </strong>
              <small>
                <span className="cms-badge" data-status={a.role}>
                  {a.role}
                </span>{" "}
                <span
                  className="cms-badge"
                  data-status={a.active ? "active" : "disabled"}
                >
                  {a.active ? "Active" : "Disabled"}
                </span>
              </small>
            </div>
            {a.user_id !== userId && (
              <div className="cms-actions">
                <button
                  disabled={busy}
                  className="cms-btn"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Make ${a.email} ${a.role === "owner" ? "an editor" : "an owner"}?`,
                        body:
                          a.role === "owner"
                            ? "They'll keep managing cards, content and requests, but lose access to store settings and administrators."
                            : "Owners can change store settings and manage every administrator, including you.",
                        confirmLabel: `Make ${a.role === "owner" ? "editor" : "owner"}`,
                        tone: "dark",
                        icon: "lock",
                      })
                    )
                      void run(
                        () =>
                          setAdmin({
                            userId: a.user_id,
                            email: a.email,
                            role: a.role === "owner" ? "editor" : "owner",
                            active: a.active,
                          }),
                        "Access updated.",
                      );
                  }}
                >
                  Make {a.role === "owner" ? "editor" : "owner"}
                </button>
                <button
                  disabled={busy}
                  className="cms-btn cms-btn-danger"
                  onClick={async () => {
                    if (
                      await confirm(
                        a.active
                          ? {
                              title: `Disable access for ${a.email}?`,
                              body: "They'll lose access to the admin until you enable them again.",
                              confirmLabel: "Disable access",
                              tone: "danger",
                            }
                          : {
                              title: `Enable access for ${a.email}?`,
                              body: `They'll be able to sign in as ${a.role === "owner" ? "an owner" : "an editor"} again.`,
                              confirmLabel: "Enable access",
                              icon: "lock",
                            },
                      )
                    )
                      void run(
                        () =>
                          setAdmin({
                            userId: a.user_id,
                            email: a.email,
                            role: a.role,
                            active: !a.active,
                          }),
                        "Access updated.",
                      );
                  }}
                >
                  {a.active ? "Disable" : "Enable"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className="cms-inline-form cms-wide"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () => inviteAdmin(invite),
              "Invitation sent with editor access.",
            )
          )
            setInvite("");
        }}
      >
        <label className="cms-field">
          Invite an editor
          <input
            type="email"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            required
            placeholder="name@example.com"
          />
        </label>
        <button className="cms-btn" disabled={busy}>
          Send invitation
        </button>
      </form>
      <details className="cms-wide">
        <summary>Add an existing Supabase account</summary>
        <form
          className="cms-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                setAdmin({
                  userId: existingId,
                  email: existingEmail,
                  role: "editor",
                  active: true,
                }),
              "Editor access granted.",
            );
          }}
        >
          <label className="cms-field">
            Existing user ID
            <input
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              required
            />
          </label>
          <label className="cms-field">
            Email
            <input
              type="email"
              value={existingEmail}
              onChange={(e) => setExistingEmail(e.target.value)}
              required
            />
          </label>
          <div className="cms-wide">
            <button className="cms-btn" disabled={busy}>
              Grant editor access
            </button>
          </div>
        </form>
      </details>
    </SettingsSection>
  );
}
