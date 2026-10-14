// A Claude Code style skill (SKILL.md) for personal agents. Install with:
//   mkdir -p ~/.claude/skills/trace-tech-brief && curl -fsSL -o ~/.claude/skills/trace-tech-brief/SKILL.md https://www.yourtrace.online/agents/skill.md
// The folder name matches the skill's `name`, as the Agent Skills spec requires.
const skill = `---
name: trace-tech-brief
description: Fetches today's tech and AI news brief from Trace - the biggest stories, notable builds and open-source releases, and practitioner conversations, each with sources. Use when the user asks what is happening in tech or AI today, wants a morning or daily brief, asks about recent launches, model releases or developer tools, or wants tech news posted to a chat channel.
---

# Trace tech brief

Trace reads 100+ tech sources every morning, groups coverage of the same event into one story and ranks it. Everything here is read-only.

## Get the brief

1. **Trace MCP server connected** (tools \`get_daily_tech_brief\`, \`get_top_tech_news\`, \`get_latest_builds\`, \`get_tech_conversations\`): use it.
   - General "what's new" questions: \`get_daily_tech_brief\` with \`limit\` 5 to 8.
   - Only news: \`get_top_tech_news\`. Launches and open source: \`get_latest_builds\`. Discussions: \`get_tech_conversations\`.
   - If you know what the user does, pass \`role\` (developer, founder, designer, product manager).
2. **Not connected**: ask the user to add it once. There is no key: their client opens a Trace page, they sign in with Google and click Allow. Tell them the Allow page can also send Trace's daily brief by email (a box, ticked by default; unsubscribe any time; access continues).
   - Claude Code: \`claude mcp add --transport http trace https://www.yourtrace.online/api/mcp\`, then \`/mcp\` to sign in.
   - Any other MCP client: add the remote server URL \`https://www.yourtrace.online/api/mcp\`.
   - Setup for each app: https://www.yourtrace.online/agents
3. **Scripts and bots with \`TRACE_AGENT_KEY\` set** (a key from https://www.yourtrace.online/agents#agent-key): use HTTPS.

   \`\`\`bash
   curl -s "https://www.yourtrace.online/api/agents/brief?section=all&limit=8" \\
     -H "Authorization: Bearer $TRACE_AGENT_KEY"
   \`\`\`

   \`section\` is \`all\`, \`news\`, \`builds\` or \`conversations\`. Never print or log the key.
4. **Neither available**: the public daily edition is readable at https://www.yourtrace.online/brief (each day at \`/brief/YYYY-MM-DD\`).

## Present it

- Responses have \`feed_date\` and lists of items with \`title\`, \`summary\`, \`why_it_matters\`, \`key_takeaways\`, \`url\` and \`sources\`.
- Lead with the 3 to 5 biggest stories: one line each on what happened and why it matters, with a source link.
- Use only stories and links from the response; never invent either. Mention \`feed_date\` so the user knows how fresh it is.
- If the tool says no brief is available yet, say so and try again later rather than searching the web for a substitute.
`;

export function GET() {
  return new Response(skill, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
