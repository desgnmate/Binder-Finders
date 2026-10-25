"use client";
import { useState } from "react";
import { History } from "lucide-react";
import type { AuditEntry } from "../../lib/cms/types";
import { storeDate } from "./presentation";

const tables = [
  ["all", "All"],
  ["cards", "Cards"],
  ["hold_requests", "Requests"],
  ["collections", "Collections"],
  ["store_settings", "Settings"],
  ["admin_users", "Access"],
] as const;
const tableLabels: Record<string, string> = {
  cards: "Card",
  hold_requests: "Hold request",
  collections: "Collection",
  store_settings: "Store settings",
  admin_users: "Administrator",
};
const ignoredFields = new Set(["data", "created_at", "updated_at"]);

// Card rows keep most listing fields in a JSON `data` column; flatten it so
// the summary names the field that actually changed.
function flatten(row: Record<string, unknown> | null) {
  if (!row) return {};
  const data = row.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? { ...row, ...(data as Record<string, unknown>) }
    : row;
}

function describe(entry: AuditEntry) {
  const before = flatten(entry.old_data);
  const after = flatten(entry.new_data);
  const changed = entry.old_data
    ? Object.keys(after).filter(
        (key) =>
          !ignoredFields.has(key) &&
          JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
    : [];
  const subject =
    entry.table_name === "store_settings"
      ? ""
      : String(after.name ?? after.email ?? entry.record_id);
  return {
    title: `${tableLabels[entry.table_name] || entry.table_name} ${entry.old_data ? "updated" : "created"}`,
    subject,
    changed: changed.map((key) =>
      key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(),
    ),
  };
}

export function AdminActivity({
  audit,
  admins,
}: {
  audit: AuditEntry[];
  admins: { user_id: string; email: string }[];
}) {
  const [table, setTable] = useState("all");
  const visible = audit.filter((a) => table === "all" || a.table_name === table);
  return (
    <section className="cms-panel">
      <div className="cms-section-heading">
        <h2>Latest 100 changes</h2>
      </div>
      <div className="cms-filter-pills" aria-label="Filter activity">
        {tables.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={table === value}
            onClick={() => setTable(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="cms-empty">
          <History size={26} />
          <p>
            {audit.length
              ? "No changes of this type in the latest 100."
              : "No changes recorded yet. Saved updates to your store will appear here."}
          </p>
        </div>
      )}
      <ol className="cms-activity">
        {visible.map((a) => {
          const { title, subject, changed } = describe(a);
          return (
            <li key={a.id}>
              <div className="cms-activity-row">
                <div>
                  <strong>
                    {title}
                    {subject && <span> · {subject}</span>}
                  </strong>
                  {changed.length > 0 && (
                    <p className="cms-muted">
                      Changed {changed.slice(0, 5).join(", ")}
                      {changed.length > 5 ? ` +${changed.length - 5} more` : ""}
                    </p>
                  )}
                </div>
                <small>
                  {storeDate(a.created_at, true)}
                  <br />
                  {a.actor_id
                    ? admins.find((u) => u.user_id === a.actor_id)?.email ||
                      `User ${a.actor_id.slice(0, 8)}`
                    : "System"}
                </small>
              </div>
              <details>
                <summary>View previous and saved values</summary>
                <div className="cms-grid">
                  <div>
                    <h3>Before</h3>
                    <pre>{JSON.stringify(a.old_data, null, 2)}</pre>
                  </div>
                  <div>
                    <h3>After</h3>
                    <pre>{JSON.stringify(a.new_data, null, 2)}</pre>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
