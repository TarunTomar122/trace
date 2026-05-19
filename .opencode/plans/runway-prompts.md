# Plan: Runway-Ready Prompt Generator

## Files to create/modify

### 1. `hackathon/characters.py` (NEW)
Character library mapping companies → cartoon personas.

**Known characters:**
| Company | Persona | Look | Setting |
|---------|---------|------|---------|
| Nvidia | Jensen Huang | Black leather jacket, cybernetic arm, slicked grey hair | Glowing green GPU server room, floating Blackwell racks, CUDA symbols |
| OpenAI | Sam Altman | Grey hoodie, intense eyes, holding Worldcoin orb | White void, AGI warning signs, giant GPT logos |
| Anthropic | Dario Amodei | Lab coat over hoodie, safety goggles | Sterile lab, Claude holograms, safety interlock signs |
| xAI/Tesla/SpaceX/Elon | Elon Musk | Black leather jacket, holding a giant metal sink | Rocket factory, DOGE coin glowing, Mars hologram |
| Apple | Tim Cook | White turtleneck, round glasses, serene smile | Minimalist white room, floating product silhouettes, glowing Apple logo |
| Meta/Facebook | Zuck | Grey t-shirt, awkward half-smile, floating | Metaverse portal, VR headsets, digital avatars dancing |
| Microsoft | Satya Nadella | Crisp blue suit, holding Surface tablet-shield | Excel spreadsheet floor, Azure raining, Clippy resurrected |
| Google | Sundar Pichai | Google-colored jacket, search bar halo above head | Cloud of search results, Gemini logos, "I'm Feeling Lucky" button |
| DeepMind | Demis Hassabis | Chess grandmaster stare, holding glowing protein fold | Chess board floor, AlphaGo trophies, floating neural nets |
| Amazon/AWS | Andy Jassy | Plain blue button-up, holding Amazon box | Warehouse with robots, Prime Air drones, AWS cloud logo |
| Alibaba | Jack Ma | Mischievous grin, holding Chinese lantern + smartphone | Floating Taobao marketplace, red lanterns, flying packages |
| Baidu | Robin Li | Sharp suit, holding glowing AI brain | Silver supercomputer room, Apollo self-driving car, Ernie Bot face |
| ByteDance/TikTok | Zhang Yiming | Phone screen face showing infinite TikTok feed | Dopamine factory, floating phones, brain scans |

**Funny fallbacks** (randomly picked when no match):
1. Chaotic VC in Patagonia vest on burning term sheets, holding podcast mic
2. 14yo coding prodigy in dark basement with 27 monitors, surrounded by Monster cans
3. Tech influencer with blinding ring light holding crypto rug pull chart that's actually a rug
4. Open-source maintainer on throne of GitHub stars, surrounded by empty coffee cups
5. YC founder in Allbirds pacing nervously at whiteboard that says "AI but for X"
6. Growth hacker with sunglasses at midnight, holding viral post template, engagement graphs going up
7. Startup bro in "DISRUPT" hoodie holding pitch deck with no numbers, just vibes
8. AI safety researcher with hair on fire holding "P(doom) = 0.5" sign

### 2. `hackathon/generate_script.py` (REWRITE existing)

**Flow:**
1. Fetch feed from API (existing logic, unchanged)
2. Send ALL trending items in ONE OpenAI call for batch detection:
   - person/company involved
   - chaotic 3-10 word hot take quote
   - visual hook (prop + action specific to the news)
3. Map each detected person→character from library (or pick funny fallback)
4. Assemble Runway-ready prompt per item

**System prompt for OpenAI batch call:**
```
You are a chaotic Silicon Mania video prompt generator. For each news item, identify:
- person/company
- a 3-10 word chaotic quote
- a visual hook describing what they're doing with a prop

Return JSON array.
```

**Prompt assembly per item:**
```
## {N}. {Title} ({duration}s)

Pixar 3D cartoon render, bold vibrant colors, dramatic lighting, 8k,
{character look} in {setting}, {visual hook},
saying "{chaotic quote}", {camera direction}
```

- Duration: 3-5 seconds (based on position, top stories get 5s)
- Camera directions cycled: slow push-in, orbit around, dolly zoom, pan across, crane up, handheld shake
- Style prefix is consistent across ALL prompts

## Output format (markdown)

```markdown
# Trace Daily — 2026-05-07 — Runway Prompts

Style: Pixar 3D cartoon render, bold vibrant colors, dramatic lighting, 8k

## 1. Pentagon Blacklist Backlash (4s)

Pixar 3D cartoon render, bold vibrant colors, dramatic lighting, 8k, Cartoon Jack Ma
in a floating Taobao marketplace with red lanterns everywhere, desperately trying to
tape a "NOT A THREAT" sign onto a giant blacklist scroll, saying "Whoops! Wrong Alibaba!",
slow push-in

## 2. xAI + Anthropic Compute Deal (3s)

Pixar 3D cartoon render, bold vibrant colors, dramatic lighting, 8k, Cartoon Elon Musk
in a rocket engine factory, holding a giant glowing power plug labeled "300MW" in one
hand and an Anthropic logo in the other, maniacal grin, saying "Compute is the new oil baby",
orbit around

...
```

## Usage
```bash
OPENAI_API_KEY=... python3 hackathon/generate_script.py                    # fresh fetch + gen
OPENAI_API_KEY=... python3 hackathon/generate_script.py --from-feed        # re-gen from cached
OPENAI_API_KEY=... python3 hackathon/generate_script.py --raw              # just dump feed
```
