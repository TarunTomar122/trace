"""
Send Trace Daily newsletter test to tomartarun2001@gmail.com
New spec: no em dashes, full text, 7 stories (4 AI, 2 Tech, 1 Markets), 3 builds, 1 community. Pro user gets full.
Subject = AI one-emoji smart summary.
Uses v1/templates/frontier_trace.html (Trace colors).
"""
import sys
from pathlib import Path
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(project_root) / ".env")
load_dotenv(Path(project_root) / "frontend" / ".env")

import re
from datetime import datetime, timedelta, timezone

from v1.storage import FirestoreStore
from v1.tools.brevo_client import send_email

TARGET_EMAIL = "tomartarun2001@gmail.com"

def get_today_ist():
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).strftime("%Y-%m-%d")

def load_template(name):
    p = Path(__file__).parent.parent / "templates" / name
    return p.read_text()

def clean_no_emdash(t: str) -> str:
    if not t:
        return ""
    # remove em dashes / en dashes
    t = t.replace("—", ", ").replace("–", ", ").replace("  ", " ")
    # also replace the unicode em dash char
    t = re.sub(r"\s*—\s*", ", ", t)
    t = re.sub(r"\s*–\s*", ", ", t)
    return t

def strip_md(t):
    if not t:
        return ""
    t = re.sub(r"\*\*(.*?)\*\*", r"\1", t)
    t = re.sub(r"\*(.*?)\*", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", t)
    t = clean_no_emdash(t)
    return t.strip()

def full_summary(item):
    """Full text, never truncated, with link host at end."""
    sh = (item.get("summary") or {}).get("short_article") or {}
    # Prefer body, then subtitle, then description
    text = sh.get("body") or sh.get("subtitle") or item.get("description") or item.get("summary") or ""
    # if body is markdown with headings, keep full but clean
    text = strip_md(str(text))
    # also append key takeaways if present
    kt = sh.get("key_takeaways") or []
    if kt:
        # keep full takeaways but inline? For now append as sentences
        pass
    return text

def render_top7(items):
    html = ""
    for item in items:
        title = strip_md(item.get("title", "Untitled"))
        title = clean_no_emdash(title)
        text = full_summary(item)
        text = clean_no_emdash(text)
        # Do not truncate
        url = item.get("url", "#") or "#"
        source = item.get("source_name") or item.get("source") or ""
        # host for link
        host = ""
        try:
            from urllib.parse import urlparse
            if url.startswith("http"):
                h = urlparse(url).hostname or ""
                host = h.replace("www.", "") if h else source
            else:
                host = source
        except:
            host = source
        html += f"""
<a href="{url}" style="text-decoration:none; display:block; margin-bottom:22px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:0;">
  <tr><td style="font-size:16px; font-weight:800; color:#18181b; line-height:1.35; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding-bottom:8px;">{title}</td></tr>
  <tr><td style="font-size:14px; color:#27272a; line-height:1.7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">{text}</td></tr>
</table>
</a>"""
    return html

def render_builds(items):
    html = ""
    for item in items:
        title = clean_no_emdash(strip_md(item.get("title", "Untitled")))
        txt = clean_no_emdash(full_summary(item))
        url = item.get("url", "#") or "#"
        host = ""
        try:
            from urllib.parse import urlparse
            if url.startswith("http"):
                h = urlparse(url).hostname or ""
                host = h.replace("www.", "") if h else ""
        except:
            host = ""
        thumb = item.get("thumbnail") or ""
        if thumb and thumb.startswith("http"):
            icon_html = f'<img src="{thumb}" width="48" height="48" style="width:48px; height:48px; border-radius:8px; object-fit:cover; border:1px solid #e4e4e7; display:block;" />'
        else:
            letter = (item.get("source_name") or title or "?")[0].upper()
            icon_html = f'<div style="width:48px; height:48px; border-radius:8px; background:#f4f4f5; border:1px solid #e4e4e7; text-align:center; line-height:48px; font-size:16px; font-weight:800; color:#18181b;">{letter}</div>'
        cnt = item.get("metadata", {}).get("signal_count") or item.get("metadata", {}).get("source_count") or ""
        cnt_str = str(cnt) if cnt else ""
        html += f"""
<a href="{url}" style="text-decoration:none; display:block; margin-bottom:16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:0;">
  <tr>
    <td width="56" style="vertical-align:top; padding-right:12px;">{icon_html}</td>
    <td style="vertical-align:top;">
      <div style="font-size:14px; font-weight:700; color:#18181b; line-height:1.35;">{title}</div>
      <div style="margin-top:4px; font-size:13px; color:#52525b; line-height:1.6;">{txt}</div>
      {f'<div style="margin-top:6px; font-size:11px; color:#71717a;">{cnt_str} signals</div>' if cnt_str else ''}
    </td>
  </tr>
</table>
</a>"""
    return html

def render_forum(items):
    if not items:
        return '<p style="font-size:14px; color:#52525b; line-height:1.6;">No community thread today, check back tomorrow.</p>'
    item = items[0]
    title = clean_no_emdash(strip_md(item.get("title", "Community discussion")))
    body = full_summary(item)
    body = clean_no_emdash(body)
    url = item.get("url", "https://yourtrace.online/feed") or "https://yourtrace.online/feed"
    host = ""
    try:
        from urllib.parse import urlparse
        if url.startswith("http"):
            h = urlparse(url).hostname or ""
            host = h.replace("www.", "") if h else ""
    except:
        host = ""
    # keep full body, not truncated beyond reasonable email length (let it be full, but email clients handle)
    return f"""
<a href="{url}" style="text-decoration:none; display:block;">
<p style="margin:0 0 10px 0; font-size:17px; font-weight:800; color:#18181b; line-height:1.3; font-family:Georgia,'Times New Roman',serif;">{title}</p>
<p style="margin:0; font-size:14px; color:#27272a; line-height:1.7;">{body}</p>
</a>
"""

def generate_subject_and_emojis(items):
    """One call: smart subject (one emoji) + one emoji per each of 7 titles. Reuses the single AI call that builds newsletter."""
    titles = [clean_no_emdash(strip_md(i.get("title",""))) for i in items[:7]]
    prompt_titles = "\n".join([f"{idx+1}. {t}" for idx, t in enumerate(titles)])
    fallback_emoji = "⚡"
    fallback_subject = f"{fallback_emoji} {titles[0][:55]} and 6 more today"
    fallback_subject = clean_no_emdash(fallback_subject)
    fallback_emojis = ["🔹","⚡","🧠","🚀","💡","🛠️","📰"][:len(titles)]
    api_key = None
    try:
        import os
        api_key = os.getenv("OPENAI_API_KEY")
    except:
        pass
    if not api_key:
        return fallback_subject, fallback_emojis
    try:
        from openai import OpenAI
        import json
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You write email subjects and title emojis for Trace Daily Brief. Rules: no em dashes, no exclamation. Return JSON with 'subject': one emoji + max 55 chars smart summary of the 7 titles, and 'emojis': array of 7 single emojis, one per title in order, each relevant to that title. Example: {\"subject\": \"🤖 AI breakthroughs you missed today\", \"emojis\": [\"🧠\",\"💸\",\"🐙\",\"🚀\",\"⚡\",\"🛠️\",\"💬\"]}"},
                {"role": "user", "content": f"Titles today:\n{prompt_titles}\n\nReturn JSON:"}
            ],
            max_tokens=120,
            temperature=0.7,
        )
        raw = resp.choices[0].message.content.strip()
        # extract JSON
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
            subj = clean_no_emdash(str(data.get("subject") or fallback_subject).strip().strip('"').strip("'"))
            emojis = data.get("emojis") or fallback_emojis
            # sanitize emojis
            cleaned = []
            for e in emojis[:len(titles)]:
                e = str(e).strip()
                if not e:
                    e = fallback_emojis[len(cleaned) % len(fallback_emojis)]
                cleaned.append(e.split()[0][:2])  # keep first emoji
            # pad if needed
            while len(cleaned) < len(titles):
                cleaned.append(fallback_emojis[len(cleaned) % len(fallback_emojis)])
            if len(subj) > 70:
                subj = subj[:67] + "..."
            if subj and subj[0].isalnum():
                subj = f"{fallback_emoji} {subj}"
            subj = clean_no_emdash(subj)
            return subj, cleaned
        return fallback_subject, fallback_emojis
    except Exception as e:
        print(f"OpenAI subject+emojis failed: {e}, using fallback")
        return fallback_subject, fallback_emojis

def generate_smart_subject(items):
    subj, _ = generate_subject_and_emojis(items)
    return subj

def pick_top7(pool):
    def interest_of(it):
        iid = (it.get("interest_id") or "").lower()
        if iid in ["ai", "tech", "markets", "market", "engineering", "ux-design"]:
            if iid == "market":
                return "markets"
            if iid in ["engineering", "ux-design"]:
                return "tech"
            return iid
        tags = [t.lower() for t in (it.get("tags") or [])]
        for t in tags:
            if t in ["ai", "tech", "markets", "market", "engineering", "ux-design"]:
                if t == "market":
                    return "markets"
                if t in ["engineering", "ux-design"]:
                    return "tech"
                return t
        return ""
    def norm_title(t):
        return re.sub(r"\W+", " ", (t or "").lower()).strip()
    ai = [i for i in pool if interest_of(i) == "ai"]
    tech = [i for i in pool if interest_of(i) == "tech"]
    markets = [i for i in pool if interest_of(i) == "markets"]
    picked = []
    seen_titles = set()
    seen_ids = set()
    def add(lst, n):
        c = 0
        for it in lst:
            if c >= n:
                break
            ident = it.get("id") or it.get("url") or ""
            title_norm = norm_title(it.get("title"))
            if ident in seen_ids or title_norm in seen_titles:
                continue
            if not title_norm:
                continue
            seen_ids.add(ident)
            seen_titles.add(title_norm)
            picked.append(it)
            c += 1
        return c
    add(ai, 4)
    add(tech, 2)
    add(markets, 1)
    if len(picked) < 7:
        for it in pool:
            if len(picked) >= 7:
                break
            ident = it.get("id") or it.get("url") or ""
            title_norm = norm_title(it.get("title"))
            if ident in seen_ids or title_norm in seen_titles:
                continue
            if not title_norm:
                continue
            seen_ids.add(ident)
            seen_titles.add(title_norm)
            picked.append(it)
    return picked[:7]

def main():
    store = FirestoreStore()
    today = get_today_ist()
    print(f"Building Trace Daily for {TARGET_EMAIL} date {today}")

    uid = None
    for doc in store.db.collection("user_profiles").where("email", "==", TARGET_EMAIL).stream():
        uid = doc.id
        print(f"Found UID {uid}")
        break
    if not uid:
        for doc in store.db.collection("user_profiles").stream():
            if (doc.to_dict().get("email") or "").lower() == TARGET_EMAIL.lower():
                uid = doc.id
                print(f"Found UID scan {uid}")
                break
    if not uid:
        print("No UID, fallback to global")
        profile_name = "Tarat"
        is_pro = True
    else:
        prof = store.db.collection("user_profiles").document(uid).get().to_dict() or {}
        profile_name = prof.get("name") or prof.get("displayName") or "Tarat"
        # check pro
        from v1.storage import is_user_subscribed
        is_pro = is_user_subscribed(prof)
        print(f"Profile {profile_name} is_pro={is_pro} sub={prof.get('subscriptionStatus')} app={prof.get('appSubscriptionStatus')}")

    # Fetch user feed if pro, else global
    pool = []
    builds_pool = []
    community_pool = []
    global_doc = None
    # try global
    snap = store.db.collection("v3_user_feeds").document("_global").collection("daily").document(today).get()
    if snap.exists:
        global_doc = snap.to_dict()
        print(f"Global daily {today} found")
    else:
        try:
            from google.cloud.firestore_v1 import Query
            docs = list(store.db.collection("v3_user_feeds").document("_global").collection("daily").order_by("__name__", direction=Query.DESCENDING).limit(1).stream())
            if docs:
                global_doc = docs[0].to_dict()
                print(f"Latest global {docs[0].id}")
        except Exception as e:
            print(f"global fetch failed {e}")

    # Try user feed for personalized pool (if pro)
    user_pool = []
    if uid:
        udoc = store.db.collection("user_feeds").document(uid).collection("daily").document(today).get()
        if udoc.exists:
            udata = udoc.to_dict() or {}
            items = udata.get("items") or []
            user_pool = [i for i in items if i.get("type") != "video"]
            print(f"User feed items {len(user_pool)}")
        else:
            print("No user feed for today, using global pool")

    # Build pool for top7: prefer user_pool if pro and has items, else global trending+topics
    if user_pool:
        pool = user_pool
    else:
        if global_doc:
            trending = global_doc.get("trending") or []
            topics = global_doc.get("trending_topics") or []
            # also for_you_roles
            fy = (global_doc.get("for_you_roles") or {}).get("developer") or []
            # combine topics expanded + trending
            topic_items = []
            for t in topics:
                arts = t.get("articles") or []
                first = arts[0] if arts else {}
                # make a synthetic item for topic
                topic_items.append({
                    "id": t.get("id"),
                    "title": t.get("title"),
                    "url": first.get("url") or f"https://yourtrace.online/topics/{t.get('topic_key') or t.get('id')}",
                    "source_name": first.get("source_name") or "Trace",
                    "interest_id": t.get("interest_id"),
                    "tags": t.get("tags") or [],
                    "summary": {"short_article": {"body": t.get("summary") or "", "subtitle": ""}},
                    "metadata": {"source_count": t.get("source_count") or len(arts)},
                    "sources": first.get("sources") or [],
                })
            pool = topic_items + trending + fy
            print(f"Pool constructed topics {len(topic_items)} trending {len(trending)} fy {len(fy)} total {len(pool)}")
        else:
            pool = []

    if not pool:
        pool = [
            {"title": "OpenAI unveils private safety processing system", "url": "https://the-decoder.com", "source_name": "the-decoder.com", "interest_id": "ai", "summary": {"short_article": {"body": "OpenAI has launched a new privacy centric safety system called Private Safety Processing, designed to prevent misuse of its AI technology without retaining customer data. This innovative system identifies patterns of abuse while ensuring that customer data is not stored."}}},
            {"title": "Humanoid robots set for breakthrough in a decade", "url": "https://cnbc.com", "source_name": "cnbc.com", "interest_id": "ai", "summary": {"short_article": {"body": "Wang Xingxing, founder of Unitree Robotics, predicts that humanoid robots will reach a ChatGPT moment within ten years, marking a significant advancement in the field. The company recently highlighted its IPO, which reflects growing interest."}}},
            {"title": "Chip costs shift smartphone market in India", "url": "https://example.com", "source_name": "example.com", "interest_id": "tech", "summary": {"short_article": {"body": "Rising memory chip costs are reshaping the smartphone market in India, significantly impacting Chinese brands."}}},
        ]

    top7 = pick_top7(pool)
    print(f"Top7 picked: {[ (i.get('title')[:40], i.get('interest_id')) for i in top7 ]}")

    # Builds: top 3 builds from Pulse tab (daily_pulse_roles[developer].tools) — correct frontend source
    builds_pool = []
    if global_doc and global_doc.get("daily_pulse_roles"):
        dpr = global_doc.get("daily_pulse_roles") or {}
        # prefer developer role (user is developer), fallback to any
        bucket = dpr.get("developer") or next(iter(dpr.values()), {})
        builds_pool = bucket.get("tools") or []
        print(f"Found builds in daily_pulse_roles: {len(builds_pool)}")
    if not builds_pool and global_doc and global_doc.get("daily_pulse"):
        builds_pool = (global_doc.get("daily_pulse") or {}).get("tools") or []
    if not builds_pool and global_doc and global_doc.get("build_pulse"):
        builds_pool = global_doc.get("build_pulse") or []
    if not builds_pool:
        builds_pool = [i for i in pool if (i.get("type") in ["repo", "launch"] or "tool" in str(i.get("tags")).lower())][:3]
    if not builds_pool:
        builds_pool = pool[:3]
    top3_builds = builds_pool[:3]
    print(f"Builds: {len(top3_builds)} -> {[i.get('title')[:50] for i in top3_builds]}")

    # Community: one independent writing (blog) from Pulse tab, not discussion
    comm_pool = []
    if global_doc and global_doc.get("daily_pulse_roles"):
        dpr = global_doc.get("daily_pulse_roles") or {}
        bucket = dpr.get("developer") or next(iter(dpr.values()), {})
        comm_pool = bucket.get("blogs") or []
        print(f"Found blogs (independent writings) in daily_pulse_roles: {len(comm_pool)}")
    if not comm_pool and global_doc and global_doc.get("daily_pulse"):
        comm_pool = (global_doc.get("daily_pulse") or {}).get("blogs") or []
    if not comm_pool:
        comm_pool = [i for i in pool if i.get("type")=="blog"][:1]
    if not comm_pool and pool:
        comm_pool = [pool[-1]]
    forum_one = comm_pool[:1]
    print(f"Independent writing picked: {forum_one[0].get('title')[:50] if forum_one else 'none'}")

    # One AI call: subject + 7 emojis for titles (reuses the single call that builds newsletter)
    subject, title_emojis = generate_subject_and_emojis(top7)
    # prepend emoji to each of the 7 titles (model-generated, not hardcoded)
    for idx, it in enumerate(top7):
        emo = title_emojis[idx] if idx < len(title_emojis) else ""
        if emo and not it.get("title","").strip().startswith(emo):
            it["title"] = f"{emo} {it.get('title','').strip()}"
    print(f"Subject: {subject} | Emojis: {title_emojis}")

    # Render
    top7_html = render_top7(top7)
    builds_html = render_builds(top3_builds)
    forum_html = render_forum(forum_one)

    # Pro ad: only for free teaser; is_pro True so hide
    is_teaser = not is_pro
    if is_teaser:
        pro_ad_html = """
<tr><td style="padding:16px 32px 0 32px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; overflow:hidden;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0 0 6px 0; font-size:13px; font-weight:800; color:#92400e;">You are on the free teaser, 3 stories</p>
      <p style="margin:0 0 12px 0; font-size:13px; color:#78350f; line-height:1.5;">Pro unlocks the full 7 plus builds and community, every morning. $2.99 per month after 3 day trial, cancel anytime.</p>
      <a href="https://www.yourtrace.online/profile?tab=subscription&intent=checkout" style="display:inline-block; padding:10px 18px; background:#18181b; color:#fff; text-decoration:none; border-radius:999px; font-size:13px; font-weight:700;">Unlock full brief</a>
    </td></tr>
  </table>
</td></tr>
"""
    else:
        pro_ad_html = ""

    tpl = load_template("frontier_trace.html")
    first_name = profile_name.split()[0] if profile_name else "there"
    greeting = f", {first_name}" if first_name else ""
    try:
        d = datetime.strptime(today, "%Y-%m-%d")
        display_date = d.strftime("%B %d, %Y")
    except:
        display_date = today

    html = tpl.replace("{{DATE}}", display_date)
    html = html.replace("{{USER_NAME_GREETING}}", greeting)
    html = html.replace("{{ITEM_COUNT}}", str(len(top7)))
    html = html.replace("{{TOP7_HTML}}", top7_html)
    html = html.replace("{{BUILDS_HTML}}", builds_html)
    html = html.replace("{{FORUM_HTML}}", forum_html)
    html = html.replace("{{PRO_AD_HTML}}", pro_ad_html)

    text = "Trace Daily Brief " + today + "\n\nTop 7:\n" + "\n".join([strip_md(i.get("title","")) for i in top7])

    print(f"Sending to {TARGET_EMAIL} subject: {subject} is_pro={is_pro}")
    res = send_email(
        to_email=TARGET_EMAIL,
        to_name=profile_name if 'profile_name' in locals() else None,
        subject=subject,
        html_content=html,
        text_content=text,
        tags=["frontier_v2"],
    )
    print(f"Result: {res}")
    Path("/tmp/frontier_trace_preview.html").write_text(html)
    print("Preview saved to /tmp/frontier_trace_preview.html")

if __name__ == "__main__":
    main()
