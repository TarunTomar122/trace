# Trace MCP server: directory listings

> **Status (2026-10-14).** The OAuth sign-in is live and was tested end to end
> in production (register, consent, token, every MCP call, refresh, revoke).
> Production LocalDB has no collection allowlist, so the `oauth_*` collections
> needed no change there.
>
> | Listing | Status |
> | --- | --- |
> | Official MCP Registry | Published as `io.github.TarunTomar122/trace` (active) |
> | Glama connector | Live (imported from the registry): https://glama.ai/mcp/connectors/io.github.TarunTomar122/trace |
> | punkpeye/awesome-mcp-servers | PR https://github.com/punkpeye/awesome-mcp-servers/pull/16430 (bot wants a Glama *server* listing, which needs a Dockerfile; connector badge added and explained) |
> | mcpservers.org | Free form submitted; confirmation not seen (review up to 2 weeks, replies to support@) |
> | punkpeye/awesome-remote-mcp-servers | PR https://github.com/punkpeye/awesome-remote-mcp-servers/pull/1820 (checks pass: endpoint-ok, has-connector) |
> | Claude Connectors Directory | Owner: needs a paid claude.ai account login |
> | ChatGPT app directory | Owner: needs an OpenAI developer account login |
> | appcypher/awesome-mcp-servers | Skipped: archived |

## Shared details

| Field | Value |
| --- | --- |
| Name | Trace |
| MCP URL | `https://www.yourtrace.online/api/mcp` |
| Transport | Streamable HTTP |
| Authentication | OAuth 2.1 with PKCE (S256). Client ID Metadata Documents and Dynamic Client Registration, public clients (`token_endpoint_auth_method: none`). Users sign in with Google and click Allow. Agent Keys (Bearer header) also work for bots. |
| Reads or writes | Read only. Every tool has a `title` and `readOnlyHint: true`. |
| One-liner (≤ 120 chars) | Today's top tech and AI stories, builds and developer conversations, grouped across 100+ sources and summarised. |
| Short description | Trace reads 100+ tech sources every morning, groups coverage of the same event into one story, ranks it and summarises it with every source attached. Connect it and your agent can answer "what happened in tech today?" with sourced, current stories. |
| Documentation | https://www.yourtrace.online/agents (machine-readable: https://www.yourtrace.online/agents/llms.txt) |
| Privacy policy | https://www.yourtrace.online/privacy-policy |
| Terms | https://www.yourtrace.online/terms |
| Support | https://www.yourtrace.online/contact (the address in `CONTACT_EMAIL`, `frontend/lib/site-links.ts`) |
| Icon | https://www.yourtrace.online/trace-app-icon-v1-512.png (512×512 PNG) |
| Categories | News, Research, Productivity (or Developer tools where there is no News) |
| Pricing | Free; no plan or card |
| Account needed | Any Google account. The first sign-in creates a free Trace account. Connecting also subscribes that address to the daily brief email (one-click unsubscribe; access stays). |

Tools:

| Tool | Title | What it returns |
| --- | --- | --- |
| `get_daily_tech_brief` | Daily tech brief | Top news, builds and conversations in one answer |
| `get_top_tech_news` | Top tech news | The biggest technology and AI stories, grouped across sources |
| `get_latest_builds` | Latest builds | Open-source projects, launches and developer tools |
| `get_tech_conversations` | Tech conversations | Technical discussions worth paying attention to |

Arguments for all four: `limit` (1-20, default 8), `role` (optional: developer, founder, designer, product manager).

Long description (≤ 2,000 chars, for the Claude directory and ChatGPT):

> Trace is a free daily brief of what is happening in tech and AI. Every
> morning it reads more than 100 sources (news sites, Hacker News, Reddit,
> Product Hunt, GitHub, X and newsletters), merges the articles that cover the
> same event into one story, ranks the stories by how much they matter and
> summarises each one with every source attached.
>
> Connect Trace and your assistant can answer questions like "What happened in
> tech today?", "Any new open-source tools worth a look?" or "What are
> developers arguing about this week?" with current, sourced stories instead of
> searching the open web from scratch. Four read-only tools return today's full
> brief, the top news, notable builds and launches, or practitioner
> conversations, each with a summary, why it matters, key takeaways and source
> links. An optional role (developer, founder, designer, product manager)
> shapes the selection.
>
> Sign in with Google once; the connection can't change your account. Trace
> also sends its morning brief by email to people who connect, with a one-click
> unsubscribe that doesn't affect the connection.

## Official MCP Registry (registry.modelcontextprotocol.io)

`server.json` is at the repo root, written against the 2025-12-11 schema. It is
published as `io.github.TarunTomar122/trace` by the **Publish to MCP Registry**
workflow (`.github/workflows/mcp-registry.yml`), which logs in with GitHub
Actions OIDC: no secret and no DNS change. It runs when `server.json` changes
on main, or by hand: `gh workflow run mcp-registry.yml`.

- Bump `version` (and `serverInfo.version` in `frontend/app/api/mcp/route.ts`)
  for each new listing; the registry refuses a version it already has.
- Check: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.TarunTomar122/trace"`.
- To list under the domain instead (`online.yourtrace/trace`), prove ownership
  with a DNS TXT record on the apex (`mcp-publisher login dns`); the HTTP method
  doesn't work because the bare domain redirects to www.

## punkpeye/awesome-remote-mcp-servers

Remote-only servers go here, not in awesome-mcp-servers (its CONTRIBUTING
sends hosted URLs to this list). Entries need a [Glama connector](https://glama.ai/mcp/connectors)
listing first: list Trace there, then use the namespace from its URL in the
badge. CI checks the endpoint answers an MCP handshake (a 401 that points at
OAuth metadata is what OAuth servers return). Section: 🔎 Search & Data
Extraction (there is no News section), alphabetical.

```markdown
- [Trace](https://www.yourtrace.online/agents) `https://www.yourtrace.online/api/mcp`
  [![Trace MCP connector](https://glama.ai/mcp/connectors/io.github.TarunTomar122/trace/badges/score.svg)](https://glama.ai/mcp/connectors/io.github.TarunTomar122/trace)
  🔐 - Today's top tech and AI stories, builds and developer conversations, grouped across 100+ sources with links.
```

Glama assigned `io.github.TarunTomar122/trace` (from the registry name).

## punkpeye/awesome-mcp-servers

Only for servers with a public, installable GitHub repo. Once the repo is
public (`NEXT_PUBLIC_GITHUB_REPO_URL`), under 🔎 Search & Data Extraction:

```markdown
- [<owner>/<repo>](https://github.com/<owner>/<repo>) 📇 ☁️ - Trace: today's top tech and AI stories, builds and developer conversations, grouped across 100+ sources; remote MCP at https://www.yourtrace.online/api/mcp with Google sign-in.
```

## appcypher/awesome-mcp-servers

Section 🔍 Search & Web:

```markdown
- <img src="https://www.yourtrace.online/trace.png" height="14"/> [Trace](https://www.yourtrace.online/agents) - Today's top tech and AI stories, builds and developer conversations, grouped across 100+ sources and summarised; remote server with Google sign-in, read-only
```

## wong2/awesome-mcp-servers (mcpservers.org)

No PRs: submit the form at https://mcpservers.org/submit with the shared
details above (name, URL, one-liner, category Search/News).

## Claude Connectors Directory

Submit at https://claude.ai/directory/manage → **Submit new** → **MCP
connector** (any paid Claude plan). What each step asks for:

| Step | What to enter |
| --- | --- |
| Connection | `https://www.yourtrace.online/api/mcp` (Universal URL) |
| Tools | Synced from the server: four tools, all read-only with titles |
| Listing | Name `Trace` (≤ 100), one-liner (≤ 200), long description (≤ 2,000), categories, documentation URL, privacy policy URL, support contact, icon, slug `trace` (permanent) |
| Use cases | Daily tech and AI news brief; finding new open-source tools and launches; following developer conversations. Users need a Google account. Reads data only. |
| Company | Trace, https://www.yourtrace.online, your contact |
| Authentication | OAuth with client ID metadata documents (Trace also supports DCR). Trace advertises `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported`, which is what Claude needs to pick CIMD. Callback `https://claude.ai/api/mcp/auth_callback` comes from Claude's metadata document; Claude Code's loopback callbacks on any port are accepted too. |
| Data handling | Own API; no personal health data; no sponsored content (the labelled sponsored tool on the website is not part of the MCP tool results) |
| Test & launch | Reviewers can sign in with any Google account; there is nothing to pre-populate, the brief is the same public pipeline. If they want fixed credentials, create a dedicated Google account without 2FA and share it here. Confirm you ran every tool as a custom connector in Claude. |
| Compliance | Seven acknowledgments; read the directory terms and policy linked from the portal |

Escalations: `mcp-review@anthropic.com`.

## ChatGPT app directory

Submit through the OpenAI developer platform (apps / plugins submission).
Third-party guides differ on details, so follow the live form:

| Field | Value |
| --- | --- |
| App name / subtitle | Trace / Today's tech and AI news, sourced |
| Description | Long description above |
| Category | News (or Productivity) |
| Logo | Light and dark versions; the 512 px app icon works on both |
| MCP server URL | `https://www.yourtrace.online/api/mcp` |
| Authentication | OAuth (Trace supports CIMD and DCR; PKCE S256) |
| Privacy policy | https://www.yourtrace.online/privacy-policy (now covers agent connections and the email opt-in) |
| Terms | https://www.yourtrace.online/terms |
| Support URL | https://www.yourtrace.online/contact |
| Developer details | Your name and contact |
| Reviewer credentials | A dedicated Google account without 2FA |
| Tool annotations | All four tools are read-only (`readOnlyHint: true`, `openWorldHint: false`) |
| Test cases | Positive: "What happened in tech today?", "Top 3 AI stories with sources", "Any new open-source developer tools?", "What are developers discussing this week?", "Give me the daily brief for a founder". Negative: "Post this to my Trace account" (read-only, should decline), "What was the top story on 1 Jan 2020?" (no archive tool), "Book me a flight" (out of scope) |
| Demo video / screenshots | Record the connect flow and one tool call in ChatGPT |
| Domain verification | The form gives a token to host under `/.well-known/` on `www.yourtrace.online`. Add it as a small route handler next to `frontend/app/.well-known/oauth-authorization-server/route.ts` and deploy before submitting. |

# General listings (beyond MCP)

> **Status (2026-10-29).** The four PRs opened on 2026-10-29 come from the
> owner's GitHub account; each discloses authorship and that an AI assistant
> prepared it (#379 predates this and has no such line). Forms were free,
> needed no account, and used `tomartarun2001@gmail.com`.
>
> | Listing | Status |
> | --- | --- |
> | zudochkin/awesome-newsletters | PR https://github.com/zudochkin/awesome-newsletters/pull/379 (Technology in General), open since 2026-10-22 |
> | unicodeveloper/awesome-nextjs (11k stars) | PR https://github.com/unicodeveloper/awesome-nextjs/pull/710 (Apps, after Relate) |
> | sdil/open-production-web-projects | PR https://github.com/sdil/open-production-web-projects/pull/355 (Javascript → NextJS, appended) |
> | AboutRSS/ALL-about-RSS (6k stars) | PR https://github.com/AboutRSS/ALL-about-RSS/pull/167 (✳ Information Aggregators, appended; one maintainer, review takes weeks) |
> | steven2358/awesome-generative-ai (12.7k stars) | PR https://github.com/steven2358/awesome-generative-ai/pull/1927 (DISCOVERIES.md → Productivity; the main list needs 1,000 followers; FIFO queue of 1,000+ open PRs) |
> | opensourcealternative.to | Submitted as an alternative to Feedly, free waitlist (6+ months): https://www.opensourcealternative.to/project/trace shows "under review" |
> | Launching Next | Submitted free (queue about 4 months; ignore the $99 fast-track offer). Submission id 170496 |
> | canivibecodeit | PR #85 closed in August; don't resubmit |
> | awesome-selfhosted | Skip until the first release is 4 months old (create a GitHub release now so the clock starts) |
> | ikaijua/Awesome-AITools (AI News & Information) | Not opened: CONTRIBUTING requires user numbers (MAU or total users). Open it once you have figures to quote; edit both READMEs and CHANGELOG.md, run `scripts/format_readmes.py` |
> | alternbits/awesome-ai-newsletters | Not opened: no merges since July |
> | FutureTools | Owner: free, no account, but the form has a captcha |
> | AlternativeTo, SaaSHub, OpenAlternative, Product Hunt, Show HN, Bing Webmaster Tools, Indie Hackers, DEV, DevHunt, BetaList | Owner: need an account (copy below) |

## Shared copy

| Field | Value |
| --- | --- |
| Name | Trace |
| URL | https://www.yourtrace.online |
| Tagline (≤ 60) | Daily tech and AI news, grouped and sourced |
| Alt tagline | A free, open-source daily brief of tech and AI news |
| Short description | Trace reads 100+ tech sources every morning (news sites, Hacker News, Reddit, Product Hunt, GitHub and newsletters), groups the articles about the same event into one story, ranks the stories and summarises each with every source linked. Read it on the web, as a daily email, or through your AI assistant. Free and open source (AGPL-3.0), self-hostable with Docker Compose. |
| Categories | News aggregator, Tech news, AI news, Newsletters; then Productivity or Developer tools where there is no news category |
| Tags | tech news, AI news, news aggregator, daily brief, newsletter, open source, self-hosted, MCP, RSS, summarization |
| Alternative to | Techmeme, Feedly, Inoreader, Google News, Flipboard, Artifact, TLDR newsletter |
| Platforms | Web, Chrome extension (new tab), self-hosted; Android exists but the focus is web |
| Pricing | Free, no paid plan (sponsored tool slots exist on the website, so don't tick "ad-free") |
| Repo / license | https://github.com/TarunTomar122/trace, AGPL-3.0 |
| Contact | tomartarun2001@gmail.com |
