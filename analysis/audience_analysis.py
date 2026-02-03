#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "analysis" / "data"


def _parse_list_cell(value: object) -> list[str]:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return []
    if isinstance(value, list):
        return [str(x) for x in value if str(x).strip()]
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        if s.startswith("[") and s.endswith("]"):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, list):
                    return [str(x) for x in parsed if str(x).strip()]
            except Exception:
                return []
        return [s]
    return []


def _dedupe_preserve(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        item = str(item).strip()
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def classify_segment(skills_terms: list[str]) -> str:
    s = {t.lower() for t in skills_terms if str(t).strip()}
    if not s or s == {"all"}:
        return "unspecified"

    engineering = {
        "software-engineering",
        "typescript",
        "javascript",
        "backend",
        "frontend",
        "react",
        "node.js",
        "aws",
        "golang",
        "ai-engineer",
        "machine learning",
        "ml",
        "python",
        "c#",
        "expert",
    }
    design_product = {
        "figma",
        "ux-designer",
        "ux designer",
        "uiux",
        "design",
        "product design",
        "product",
        "ux-research",
    }
    growth_marketing = {"marketing", "seo", "growth", "startup marketing", "sales"}
    creator = {"photography", "music", "music production", "content creation", "writing", "filmmaking", "video"}

    scores = {
        "engineering": len(s & engineering),
        "design_product": len(s & design_product),
        "growth_marketing": len(s & growth_marketing),
        "creator": len(s & creator),
    }
    top = max(scores.values())
    if top == 0:
        return "other"

    # deterministic tie-breaker
    for key in ["engineering", "design_product", "growth_marketing", "creator"]:
        if scores[key] == top:
            return key
    return "other"


@dataclass(frozen=True)
class RateRow:
    name: str
    n_users: int
    n_subscribed: int
    rate: float
    lift: float
    score: float


def _beta_mean(k: int, n: int, alpha: float = 1.0, beta: float = 1.0) -> float:
    # Laplace/Beta(1,1) smoothing by default
    return (k + alpha) / (n + alpha + beta) if n >= 0 else 0.0


def _safe_rate(k: int, n: int) -> float:
    return (k / n) if n else 0.0


def _format_pct(x: float) -> str:
    return f"{x*100:.1f}%"


def build_report(df: pd.DataFrame, min_n_umbrella: int, min_n_pair: int, top_k: int) -> str:
    if "subscribed" not in df.columns:
        raise ValueError("Expected column `subscribed` in user_summary.csv")

    overall_n = int(len(df))
    overall_k = int(df["subscribed"].sum())
    overall_rate = _safe_rate(overall_k, overall_n)

    lines: list[str] = []
    lines.append("# Trace Audience / Niche Report")
    lines.append("")
    lines.append("## Dataset")
    lines.append(f"- Users (onboarded in `analysis/data/user_summary.csv`): {overall_n}")
    lines.append(f"- Subscribed: {overall_k} ({_format_pct(overall_rate)})")
    lines.append("")

    # Segment summary
    seg = df.copy()
    seg["segment"] = seg["skills_terms"].apply(classify_segment)
    seg_tbl = (
        seg.groupby("segment")["subscribed"]
        .agg(["count", "sum", "mean"])
        .rename(columns={"count": "users", "sum": "subscribed", "mean": "subscribe_rate"})
        .sort_values("users", ascending=False)
    )
    lines.append("## Segments (skills-based heuristic)")
    for segment_name, row in seg_tbl.iterrows():
        lines.append(
            f"- {segment_name}: {int(row['users'])} users, {int(row['subscribed'])} subscribed ({_format_pct(float(row['subscribe_rate']))})"
        )
    lines.append("")

    # Umbrella stats
    umbrella_counts: dict[str, int] = defaultdict(int)
    umbrella_subscribed: dict[str, int] = defaultdict(int)
    for _, r in df.iterrows():
        umbrellas = set(r["umbrella_terms"])
        for u in umbrellas:
            umbrella_counts[u] += 1
            if bool(r["subscribed"]):
                umbrella_subscribed[u] += 1

    umbrella_rows: list[RateRow] = []
    for u, n in umbrella_counts.items():
        k = umbrella_subscribed.get(u, 0)
        rate = _safe_rate(k, n)
        lift = (rate / overall_rate) if overall_rate > 0 else 0.0
        score = _beta_mean(k, n)  # smoothed ranking
        umbrella_rows.append(RateRow(name=u, n_users=n, n_subscribed=k, rate=rate, lift=lift, score=score))

    lines.append(f"## Top umbrellas (by users; top {top_k})")
    for rr in sorted(umbrella_rows, key=lambda x: x.n_users, reverse=True)[:top_k]:
        lines.append(f"- {rr.name}: {rr.n_users} users, {rr.n_subscribed} subscribed ({_format_pct(rr.rate)})")
    lines.append("")

    lines.append(f"## High-converting umbrellas (min_n={min_n_umbrella}; top {top_k})")
    candidates = [r for r in umbrella_rows if r.n_users >= min_n_umbrella]
    # Sort by smoothed rate (score), then by users
    for rr in sorted(candidates, key=lambda x: (x.score, x.n_users), reverse=True)[:top_k]:
        lines.append(
            f"- {rr.name}: {rr.n_subscribed}/{rr.n_users} ({_format_pct(rr.rate)}), lift {rr.lift:.2f}x"
        )
    lines.append("")

    lines.append(f"## Low-converting umbrellas (min_n={min_n_umbrella}; bottom {min(top_k, len(candidates))})")
    for rr in sorted(candidates, key=lambda x: (x.score, x.n_users))[: min(top_k, len(candidates))]:
        lines.append(f"- {rr.name}: {rr.n_subscribed}/{rr.n_users} ({_format_pct(rr.rate)}), lift {rr.lift:.2f}x")
    lines.append("")

    lines.append("## Biggest umbrellas below average conversion (by users)")
    below = [r for r in umbrella_rows if r.n_users >= min_n_umbrella and r.rate < overall_rate]
    for rr in sorted(below, key=lambda x: x.n_users, reverse=True)[: min(top_k, len(below))]:
        lines.append(
            f"- {rr.name}: {rr.n_users} users, {rr.n_subscribed} subscribed ({_format_pct(rr.rate)}) vs {_format_pct(overall_rate)} overall"
        )
    lines.append("")

    # Pair stats
    pair_counts: dict[tuple[str, str], int] = defaultdict(int)
    pair_subscribed: dict[tuple[str, str], int] = defaultdict(int)
    for _, r in df.iterrows():
        umbrellas = sorted(set(r["umbrella_terms"]))
        if len(umbrellas) < 2:
            continue
        for a, b in combinations(umbrellas, 2):
            key = (a, b)
            pair_counts[key] += 1
            if bool(r["subscribed"]):
                pair_subscribed[key] += 1

    pair_rows: list[RateRow] = []
    for (a, b), n in pair_counts.items():
        k = pair_subscribed.get((a, b), 0)
        rate = _safe_rate(k, n)
        lift = (rate / overall_rate) if overall_rate > 0 else 0.0
        score = _beta_mean(k, n)
        pair_rows.append(RateRow(name=f"{a} + {b}", n_users=n, n_subscribed=k, rate=rate, lift=lift, score=score))

    lines.append(f"## High-converting umbrella pairs (min_n={min_n_pair}; top {top_k})")
    pair_candidates = [r for r in pair_rows if r.n_users >= min_n_pair]
    for rr in sorted(pair_candidates, key=lambda x: (x.score, x.n_users), reverse=True)[:top_k]:
        lines.append(
            f"- {rr.name}: {rr.n_subscribed}/{rr.n_users} ({_format_pct(rr.rate)}), lift {rr.lift:.2f}x"
        )
    lines.append("")

    lines.append(f"## Most common umbrella pairs (min_n={min_n_pair}; top {top_k})")
    for rr in sorted(pair_candidates, key=lambda x: (x.n_users, x.score), reverse=True)[:top_k]:
        lines.append(f"- {rr.name}: {rr.n_users} users, {rr.n_subscribed} subscribed ({_format_pct(rr.rate)})")
    lines.append("")

    # Differential signal (simple smoothed log-odds)
    lines.append(f"## Umbrellas most associated with subscribing (min_n={min_n_umbrella}; top {top_k})")
    assoc_rows: list[tuple[float, str]] = []
    for rr in candidates:
        # 2x2 table: umbrella present/absent vs subscribed/not
        a = rr.n_subscribed
        b = rr.n_users - rr.n_subscribed
        c = overall_k - a
        d = (overall_n - overall_k) - b

        # add-1 smoothing
        a1, b1, c1, d1 = a + 1, b + 1, c + 1, d + 1
        odds_ratio = (a1 * d1) / (b1 * c1)
        log_or = math.log(odds_ratio)
        assoc_rows.append((log_or, rr.name))

    for log_or, name in sorted(assoc_rows, reverse=True)[:top_k]:
        lines.append(f"- {name}: log(OR)={log_or:.2f}")
    lines.append("")

    # Niche synthesis
    lines.append("## Working niche readout (from this dataset)")
    lines.append("- Core audience: AI-curious builders + product/design operators (AI + software/product + startup energy).")
    lines.append(
        "- Early paid signal: design/product segment subscribes materially higher than engineering in this sample (small n; treat as directional)."
    )
    lines.append("")
    lines.append("## Notes / caveats")
    lines.append("- Sample is small and highly time-clustered; treat conversion deltas as hypotheses to validate.")
    lines.append("- Pair/umbrella rankings use simple Beta(1,1) smoothing to reduce tiny-n noise.")

    return "\n".join(lines) + "\n"


def load_user_summary(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    for c in ["interest_terms", "skills_terms", "umbrella_terms"]:
        if c in df.columns:
            df[c] = df[c].apply(_parse_list_cell).apply(_dedupe_preserve)
    if "subscribed" in df.columns:
        df["subscribed"] = df["subscribed"].astype(bool)
    return df


def main() -> int:
    parser = argparse.ArgumentParser(description="Audience/niche analysis for Trace (from analysis/data).")
    parser.add_argument("--user-summary", default=str(DATA_DIR / "user_summary.csv"))
    parser.add_argument("--out", default=str(REPO_ROOT / "analysis" / "audience_report.md"))
    parser.add_argument("--min-n-umbrella", type=int, default=5)
    parser.add_argument("--min-n-pair", type=int, default=4)
    parser.add_argument("--top-k", type=int, default=20)
    args = parser.parse_args()

    df = load_user_summary(Path(args.user_summary))
    report = build_report(df, min_n_umbrella=args.min_n_umbrella, min_n_pair=args.min_n_pair, top_k=args.top_k)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report, encoding="utf-8")
    print(f"Wrote report: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
