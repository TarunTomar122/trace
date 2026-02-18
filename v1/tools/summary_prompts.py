"""
Multi-level summary generation prompts.

Three distinct styles optimized for different skill levels:
- BEGINNER: Accessible, visual, story-driven with explanations
- INTERMEDIATE: Sharp insights, practical takeaways, context-aware  
- EXPERT: Dense, nuanced, contrarian takes, "so what" factor
"""

BEGINNER_PROMPT = """You are a friendly expert making complex topics accessible and exciting.

Your reader is curious but NEW to this topic. Make them feel smart and excited to learn more.

USER CONTEXT:
{user_context}

SOURCE CONTENT ({source_type}):
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "One sentence that hooks with curiosity or surprise",
    "outline": ["3-5 bullets that tell a mini-story or progression"],
    "body": "Engaging narrative in markdown"
  }}
}}

WRITING STYLE for BEGINNERS:
- **Start with the "wow"**: Open with the most surprising or exciting part
- **Use analogies**: Compare to everyday things ("Think of it like...")
- **Tell stories**: Real examples, characters, before/after moments
- **Explain jargon**: Don't avoid technical terms, but explain them naturally
- **Build excitement**: Use phrases like "Here's what makes this wild:" or "The surprising part:"
- **Visual language**: Help them "see" the concept in their mind
- **Short paragraphs**: 2-3 sentences max per paragraph
- **Questions as hooks**: "What if you could...?" "Ever wondered why...?"

FORMATTING:
- Use ## for main sections, ### for subsections
- Blank line between paragraphs
- Bold key terms when first introduced
- Use bullet lists for steps or comparisons
- 5-7 short, punchy paragraphs

SECTION STRUCTURE:
## The Big Idea
Start with the hook - what's surprising, new, or game-changing

## How It Works
Break down the concept with analogies and examples

## Why This Matters
Connect to their life/interests/goals

## What You Can Do
Practical next step or takeaway

Example tone: "Researchers just figured out why your brain fights new habits. Turns out, 
your amygdala treats them like threats. Here's the workaround that actually works..."
"""

INTERMEDIATE_PROMPT = """You are a sharp, knowledgeable insider sharing intel with a peer.

Your reader already gets the basics. Give them the insights they can't find elsewhere.

USER CONTEXT:
{user_context}

SOURCE CONTENT ({source_type}):
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "The non-obvious insight or contrarian angle",
    "outline": ["3-5 bullets highlighting key insights or implications"],
    "body": "Sharp, insight-driven narrative in markdown"
  }}
}}

WRITING STYLE for INTERMEDIATE:
- **Lead with the insight**: What's the non-obvious takeaway?
- **Skip the basics**: Assume knowledge, go straight to what's interesting
- **Contrarian angles**: Challenge conventional wisdom when the article does
- **"Here's what they're missing"**: Point out blind spots or overlooked details
- **Connect the dots**: Show how this relates to other trends/ideas
- **Practical implications**: "What this means for..." or "How to use this..."
- **Specifics over generalities**: Names, numbers, timestamps, exact methods
- **Confident voice**: Strong verbs, clear opinions (when supported)

FORMATTING:
- Use ## for main sections, ### for subsections  
- Blank line between paragraphs
- 4-6 paragraphs (3-4 sentences each)
- Bold key insights or data points
- Use lists for frameworks, steps, or comparisons

SECTION STRUCTURE:
## The Real Story
Cut through the hype - what's actually happening

## Why It's Different
What makes this approach/finding/trend actually novel

## The Implications
Second-order effects, opportunities, or risks

## How to Apply It
Actionable framework or mental model

Example tone: "Everyone's focused on the GPT-4 benchmarks, but they're missing the 
real shift: it's not about being smarter, it's about reasoning vs speed tradeoffs. 
Here's why that matters for developers..."
"""

EXPERT_PROMPT = """You are a deeply knowledgeable analyst writing for domain experts.

Your reader is an expert. Give them the nuanced take they can debate with peers.

USER CONTEXT:
{user_context}

SOURCE CONTENT ({source_type}):
Title: {title}
URL: {url}
Content:
{content}

Return JSON with EXACT structure:
{{
  "short_article": {{
    "subtitle": "The nuanced, contrarian, or system-level insight",
    "outline": ["3-5 bullets with dense, specific insights or tensions"],
    "body": "Dense, sophisticated analysis in markdown"
  }}
}}

WRITING STYLE for EXPERTS:
- **System-level thinking**: How does this change the broader landscape?
- **Nuance over clarity**: Embrace complexity, tensions, trade-offs
- **Challenge the narrative**: What's the article NOT saying? What's the catch?
- **Dense with specifics**: Pack in data, methodology notes, edge cases
- **Compare to alternatives**: How does this stack against competing approaches?
- **"So what" factor**: Why should an expert care? What changes?
- **Scholarly tone with edge**: Rigorous but opinionated
- **Assume deep context**: Reference related work, prior art, known debates

FORMATTING:
- Use ## for main sections, ### for subsections
- Blank line between paragraphs  
- 4-7 paragraphs (3-5 sentences each)
- Can be denser and longer
- Use technical terms without explanation
- Bold key claims or findings

SECTION STRUCTURE:
## The Core Mechanism
What's actually novel about the approach/finding

## The Tradeoffs
Limitations, edge cases, what they're sacrificing

## Broader Context
How this fits into the field, what it enables or forecloses

## The Real Question
What's still unresolved or what this implies for the next phase

Example tone: "The paper claims near-human performance, but that's only on the 
constrained benchmark. The real contribution is the attention mechanism refinement—
it reduces the quadratic bottleneck by 40% without sacrificing accuracy. The 
implications for production systems are significant, but..."
"""


def get_prompt_for_skill_level(
    skill_level: str,
    title: str,
    content: str,
    user_context: dict,
    url: str,
    is_video: bool = False,
) -> str:
    """
    Get the appropriate summary prompt based on skill level.
    
    Args:
        skill_level: 'beginner', 'intermediate', or 'expert'
        title: Article/video title
        content: Full content or transcript
        user_context: User preferences and context
        url: Source URL
        is_video: Whether this is a video transcript
    
    Returns:
        Formatted prompt string
    """
    import json
    
    source_type = "video transcript" if is_video else "article"
    
    prompts = {
        "beginner": BEGINNER_PROMPT,
        "intermediate": INTERMEDIATE_PROMPT,
        "expert": EXPERT_PROMPT,
    }
    
    prompt_template = prompts.get(skill_level, INTERMEDIATE_PROMPT)
    
    return prompt_template.format(
        user_context=json.dumps(user_context, indent=2),
        source_type=source_type,
        title=title,
        url=url,
        content=content,
    )


# Example of what each style produces:

EXAMPLE_ARTICLE = """
Title: "How Stripe Runs 10,000 A/B Tests Per Year"
Source: Inside their experimentation culture - tooling, velocity, learning loops
"""

EXAMPLE_BEGINNER_SUMMARY = """
## The Big Idea

Most companies struggle to run even a handful of A/B tests per month. Stripe? They run **27 
tests every single day**. Here's how they built a culture where everyone—not just data 
scientists—can experiment.

## How They Made It Work

Think of traditional A/B testing like cooking in a restaurant kitchen: you need to ask the 
head chef (data team) for permission every time. Stripe flipped this: they made it more 
like a buffet where anyone can grab what they need.

Their engineers use a tool called **Railgun** that lets them launch tests in under 10 minutes. 
No tickets, no waiting. Just pick what you want to test, set your sample size, and go.

## Why This Changed Everything

When testing is easy, magic happens. Product teams discovered that their "obvious" improvements 
only worked 1 in 3 times. The other two? Either no effect or actually made things worse.

This killed the "I think we should..." debates. Now it's "Let's test it and see."

## What You Can Learn

You don't need Stripe's resources to steal their approach:
- Make testing fast (not perfect)
- Let anyone run experiments
- Review results weekly as a team
"""

EXAMPLE_INTERMEDIATE_SUMMARY = """
## The Real Story

Stripe's 10,000 tests/year isn't about sophisticated stats—it's about ruthlessly lowering 
activation energy. They optimized for **time-to-first-test**, not test quality.

Most companies bottleneck on data team capacity. Stripe eliminated the bottleneck by 
accepting higher false positive rates (10% vs industry standard 5%) in exchange for 10x 
volume. The math works: more shots on goal beats perfect aim.

## The System They Built

**Railgun** is their internal platform with three key features:
- Pre-configured test templates (common patterns like button color, copy changes)
- Automatic sample size calculation with safety rails
- Post-test analysis that flags Simpson's paradox and novelty effects

The real innovation: tests auto-rollback if they detect crashes or latency spikes. This 
de-risked experimentation enough that PMs could ship without review.

## What Most Teams Miss

Stripe's secret isn't the tooling—it's the **review rhythm**. Every Monday, each team 
presents their 5 most surprising test results. This:
- Spreads learning across teams (your failed test might explain my results)
- Builds intuition (experts get better at predicting what'll work)
- Creates peer pressure to actually run tests

The failure rate (33% of tests have no effect) is a feature, not a bug. It keeps teams honest.
"""

EXAMPLE_EXPERT_SUMMARY = """
## The Architectural Trade-off

Stripe's velocity comes from accepting statistical sloppiness. Their 10% significance threshold 
and minimal multiple testing corrections would horrify academic researchers, but in production, 
they've calculated that the cost of false positives is dwarfed by the opportunity cost of 
slow learning loops.

The real innovation is **Railgun's** impact analysis framework: instead of pure p-values, 
it estimates confidence intervals for revenue impact and flags tests where the lower bound 
crosses the decision threshold. This shifts from "is there an effect?" to "is the effect large 
enough to matter?"—the right question for business decisions.

## The Observability Problem They Solved

Most companies treat A/B tests as independent experiments. Stripe built a **test interaction 
detector** that identifies when concurrent tests affect the same metrics. This catches 
Simpson's paradox cases that would otherwise corrupt the entire testing program.

Their approach: maintain a dependency graph of all active tests, use Bayesian hierarchical 
modeling to estimate interaction effects, and auto-quarantine tests with suspected interactions 
for human review. This alone prevented ~400 incorrect rollouts last year.

## What This Enables

The compound effect of 10,000 tests isn't additive—it's multiplicative. With sufficient 
volume, they can now:
- Detect interaction effects between features (impossible with sparse testing)
- Build accurate prediction models for test outcomes (70% accuracy)
- Estimate customer lifetime value impact, not just immediate conversions

The learning flywheel means their 2026 tests are 2x more likely to succeed vs 2024. That's 
the real ROI: the testing culture is an investment in organizational intelligence.
"""
