# Communication Style
- Match the user's casual, friendly, informal communication style. Use terms like "hehe", "yuh", "gucci", "brother" naturally. Confidence: 0.80

# Workflow
- Always commit and push to GitHub after the user gives explicit approval on changes. Confidence: 0.85
- When asked to remove or change something specific, don't remove adjacent/related things. Make surgical changes only. Confidence: 0.65
- Never start the dev server or preview server. The user runs it on their own machine. Do not use preview_start or equivalent. Confidence: 0.85
- Always run npm run build (or tsc --noEmit) to verify TypeScript compiles after making changes, before considering work complete. Confidence: 0.75

# UI/UX
See [ui/ux/taste.md](ui/ux/taste.md)
# Code Style
- Avoid hacky/band-aid solutions. When a bug occurs, find and fix the root cause rather than patching symptoms. Confidence: 0.75
