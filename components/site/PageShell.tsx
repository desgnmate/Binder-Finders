import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { PageFooter } from "./PageFooter";
import { PageMotion } from "./PageMotion";

/** Header, page body and footer shared by the info pages and card pages. */
export function PageShell({
  children,
  background = "#fff6e0",
  compactFooter = false,
}: {
  children: ReactNode;
  background?: string;
  compactFooter?: boolean;
}) {
  return (
    <PageMotion className="flex min-h-screen flex-col font-body text-ink-black" style={{ background }}>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <PageFooter compact={compactFooter} />
    </PageMotion>
  );
}
