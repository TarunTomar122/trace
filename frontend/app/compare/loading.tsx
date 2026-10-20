import PublicHeader from "@/components/PublicHeader";
import { HOME_CSS } from "@/lib/home-css";
import { COMPARE_CSS } from "@/lib/compare-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

export default function CompareLoading() {
  return (
    <div className={`hp cmp ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{COMPARE_CSS}</style>
      <PublicHeader />
      <main aria-busy="true">
        <div className="cmp-top">
          <div className="cmp-hero" aria-hidden="true">
            <span className="cmp-sk" style={{ width: 132, height: 14, margin: "0 auto 22px" }} />
            <span className="cmp-sk" style={{ width: "78%", height: 46, margin: "0 auto 14px" }} />
            <span className="cmp-sk" style={{ width: "54%", height: 46, margin: "0 auto" }} />
            <span className="cmp-sk" style={{ width: "62%", height: 16, margin: "32px auto 0" }} />
            <span className="cmp-sk" style={{ width: "46%", height: 16, margin: "12px auto 0" }} />
          </div>
        </div>
        <div className="cmp-grid-wrap" aria-hidden="true">
          <div className="cmp-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="cmp-sk-card">
                <span className="cmp-sk" style={{ width: 92, height: 22 }} />
                <span className="cmp-sk" style={{ width: "88%", height: 26 }} />
                <span className="cmp-sk" style={{ width: "100%", height: 14 }} />
                <span className="cmp-sk" style={{ width: "70%", height: 14 }} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
