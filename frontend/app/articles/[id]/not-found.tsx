import Link from "next/link";
import StatusPage from "@/components/StatusPage";

export default function ArticleNotFound() {
  return (
    <StatusPage
      note="this one has gone"
      title="Article not found"
      lede="This article may have been removed, or the link might be wrong."
      actions={
        <>
          <Link href="/feed" className="st-btn st-btn-dark">
            Open the feed
          </Link>
          <Link href="/" className="st-btn st-btn-line">
            Back to home
          </Link>
        </>
      }
      cards={[
        { title: "Daily Brief", text: "5-minute brief, grouped from 100+ sources", href: "/brief", tint: "yellow" },
        { title: "How it works", text: "From a hundred sources to one calm page", href: "/how-it-works", tint: "pink" },
        { title: "Guides", text: "Plain tips for beating news overload", href: "/blog", tint: "green" },
      ]}
    />
  );
}
