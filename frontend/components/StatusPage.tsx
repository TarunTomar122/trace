import type { ReactNode } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { STATUS_CSS } from "@/lib/status-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

export type StatusCard = {
  title: string;
  text: string;
  href: string;
  tint: "yellow" | "cyan" | "pink" | "green";
};

/** id of the page heading; error.tsx focuses it so the failure is announced. */
export const STATUS_TITLE_ID = "status-title";

/**
 * Shared layout for the error boundary and the 404: the site header and dark
 * footer around one calm centred block. Safe to render from a client component
 * (error.tsx) as well as a server one (not-found.tsx).
 */
export default function StatusPage({
  note,
  title,
  lede,
  actions,
  fine,
  cards,
}: {
  /** Small handwritten line above the headline. */
  note: string;
  title: string;
  lede: string;
  /** The buttons row (`st-btn` links or buttons). */
  actions: ReactNode;
  /** Optional quiet line under the buttons. */
  fine?: ReactNode;
  cards: StatusCard[];
}) {
  return (
    <div className={`st ${HOME_FONT_VARS}`}>
      <style>{STATUS_CSS}</style>
      <PublicHeader />
      <main className="st-main">
        <div className="st-wrap">
          <p className="st-note" aria-hidden="true">{note}</p>
          <h1 id={STATUS_TITLE_ID} tabIndex={-1} className="st-h1">{title}</h1>
          <p className="st-lede">{lede}</p>
          <div className="st-btns">{actions}</div>
          {fine ? <p className="st-fine">{fine}</p> : null}
        </div>
        <ul className="st-cards">
          {cards.map((card) => (
            <li key={card.href} className={`st-card st-card-${card.tint}`}>
              <Link href={card.href} className="st-card-link">
                <span className="st-card-title">{card.title}</span>
                <span className="st-card-text">{card.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer variant="landing" />
    </div>
  );
}
