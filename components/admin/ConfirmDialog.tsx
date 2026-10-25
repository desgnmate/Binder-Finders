"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Check, Lock, PencilLine, X } from "lucide-react";

export type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  details?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "dark";
  icon?: "lock" | "warning" | "check" | "edit";
};
type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const icons = { lock: Lock, warning: AlertTriangle, check: Check, edit: PencilLine };

// Outside the provider (isolated component tests) fall back to the browser.
const ConfirmContext = createContext<Confirm>((options) =>
  Promise.resolve(window.confirm(options.title)),
);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise((resolve) => setRequest({ ...options, resolve })),
    [],
  );
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <ConfirmDialog
          {...request}
          onClose={(ok) => {
            request.resolve(ok);
            setRequest(null);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  title,
  body,
  details,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  icon = tone === "danger" ? "warning" : "check",
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const Icon = icons[icon];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Start on the safe choice so Enter never confirms by accident.
    cancel.current?.focus();
    return () => previous?.focus?.();
  }, []);
  function keydown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose(false);
    }
    if (e.key !== "Tab") return;
    const buttons = Array.from(
      dialog.current?.querySelectorAll<HTMLButtonElement>("button") || [],
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  return (
    <div className="cms-modal-backdrop" onMouseDown={() => onClose(false)}>
      <div
        ref={dialog}
        className="cms-modal"
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={body ? `${id}-body` : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={keydown}
      >
        <div className="cms-modal-head">
          <span className="cms-modal-icon" data-tone={tone} data-icon={icon}>
            <Icon size={22} />
          </span>
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            {body && <p id={`${id}-body`}>{body}</p>}
          </div>
          <button
            type="button"
            className="cms-icon-btn"
            aria-label="Close"
            onClick={() => onClose(false)}
          >
            <X size={15} />
          </button>
        </div>
        {details}
        <div className="cms-modal-actions">
          <button
            ref={cancel}
            type="button"
            className="cms-btn"
            onClick={() => onClose(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`cms-btn ${tone === "danger" ? "cms-btn-danger-solid" : tone === "dark" ? "cms-btn-dark" : "cms-btn-primary"}`}
            onClick={() => onClose(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
