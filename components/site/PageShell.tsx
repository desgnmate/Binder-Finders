import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { PageMotion } from "./PageMotion";
import { SiteFooter } from "../footer/SiteFooter";
import { RevealFooterLayout } from "../RevealFooterLayout";

/**
 * Header, page body and footer shared by the info pages, card pages and bag.
 * The footer is the same one the home page and shop use.
 */
export function PageShell({
  children,
  background = "#fff6e0",
  footer = <SiteFooter />,
}: {
  children: ReactNode;
  background?: string;
  /** Pages outside the store layout pass a footer that loads its own settings. */
  footer?: ReactNode;
}) {
  return (
    <PageMotion className="relative bg-[#7b39ed] font-body text-ink-black">
      <RevealFooterLayout footer={footer}>
        <div className="flex min-h-screen flex-col" style={{ background }}>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </RevealFooterLayout>
    </PageMotion>
  );
}
