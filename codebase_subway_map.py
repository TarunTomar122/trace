#!/usr/bin/env python3
"""
Generate a subway map visualization of the Claudia codebase
"""

import svgwrite
import math

def create_subway_map():
    # Canvas size
    width = 1400
    height = 1000
    
    dwg = svgwrite.Drawing('codebase_subway.svg', size=(width, height))
    
    # Add background with subtle grid pattern
    dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill='#1a1a2e'))
    
    # Grid pattern
    grid = dwg.defs.add(dwg.pattern(id='grid', size=(30, 30), patternUnits='userSpaceOnUse'))
    grid.add(dwg.line(start=(0, 0), end=(30, 0), stroke='#252542', stroke_width=0.5))
    grid.add(dwg.line(start=(0, 0), end=(0, 30), stroke='#252542', stroke_width=0.5))
    dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill='url(#grid)'))
    
    # Line colors (inspired by real subway systems)
    colors = {
        'frontend': '#ff6b6b',      # Red Line - Next.js Frontend
        'trace': '#4ecdc4',          # Teal Line - Mobile App
        'v1_flows': '#ffe66d',       # Yellow Line - Backend Flows
        'v1_core': '#a855f7',        # Purple Line - Core Agents
        'v1_tools': '#06d6a0',       # Green Line - Tools
        'analysis': '#ff9f43',       # Orange Line - Analysis
        'api': '#74b9ff',            # Blue Line - API Routes
    }
    
    # Station styling
    station_radius = 8
    interchange_radius = 12
    
    def draw_line(points, color, line_width=8):
        """Draw a subway line through points"""
        if len(points) < 2:
            return
        
        # Create path with rounded corners
        path_data = f"M {points[0][0]} {points[0][1]}"
        for i in range(1, len(points)):
            path_data += f" L {points[i][0]} {points[i][1]}"
        
        # Draw glow effect
        dwg.add(dwg.path(d=path_data, stroke=color, stroke_width=line_width + 6, 
                        fill='none', stroke_linecap='round', stroke_linejoin='round',
                        opacity=0.3))
        # Draw main line
        dwg.add(dwg.path(d=path_data, stroke=color, stroke_width=line_width, 
                        fill='none', stroke_linecap='round', stroke_linejoin='round'))
    
    def draw_station(x, y, name, color, is_interchange=False, label_offset=(15, 5), font_size=11):
        """Draw a station marker with label"""
        r = interchange_radius if is_interchange else station_radius
        
        # Outer ring (glow)
        dwg.add(dwg.circle(center=(x, y), r=r+3, fill=color, opacity=0.3))
        # Station circle
        dwg.add(dwg.circle(center=(x, y), r=r, fill='#1a1a2e', stroke=color, stroke_width=3))
        if is_interchange:
            dwg.add(dwg.circle(center=(x, y), r=r-4, fill=color))
        
        # Label
        text = dwg.text(name, insert=(x + label_offset[0], y + label_offset[1]), 
                       fill='#e8e8e8', font_size=font_size, font_family='Menlo, monospace',
                       font_weight='500')
        dwg.add(text)
    
    def draw_legend():
        """Draw the legend"""
        legend_x = 1100
        legend_y = 100
        
        # Legend box
        dwg.add(dwg.rect(insert=(legend_x - 20, legend_y - 30), size=(280, 280), 
                        fill='#252542', rx=10, ry=10, opacity=0.8))
        dwg.add(dwg.text('CLAUDIA CODEBASE', insert=(legend_x, legend_y), 
                        fill='#ffffff', font_size=16, font_family='Menlo, monospace',
                        font_weight='bold'))
        dwg.add(dwg.text('TRANSIT MAP', insert=(legend_x, legend_y + 20), 
                        fill='#888888', font_size=12, font_family='Menlo, monospace'))
        
        lines = [
            ('Frontend (Next.js)', colors['frontend']),
            ('API Routes', colors['api']),
            ('Mobile App (Expo)', colors['trace']),
            ('Backend Flows', colors['v1_flows']),
            ('Core Agents', colors['v1_core']),
            ('Tools & Utils', colors['v1_tools']),
            ('Analysis', colors['analysis']),
        ]
        
        for i, (name, color) in enumerate(lines):
            y = legend_y + 50 + i * 28
            dwg.add(dwg.line(start=(legend_x, y), end=(legend_x + 30, y), 
                           stroke=color, stroke_width=6, stroke_linecap='round'))
            dwg.add(dwg.text(name, insert=(legend_x + 45, y + 4), 
                           fill='#e8e8e8', font_size=11, font_family='Menlo, monospace'))
    
    # ============ FRONTEND LINE (Red) ============
    frontend_points = [
        (100, 150),   # Start
        (200, 150),   # layout.tsx
        (320, 150),   # page.tsx (main)
        (320, 250),   # Turn down
        (320, 350),   # feed/
        (320, 450),   # bookmarks/
        (320, 550),   # profile/
        (200, 550),   # onboarding/
        (100, 550),   # waitlist/
    ]
    draw_line(frontend_points, colors['frontend'])
    
    draw_station(100, 150, 'frontend/', colors['frontend'], is_interchange=True, label_offset=(-80, -15))
    draw_station(200, 150, 'layout.tsx', colors['frontend'], label_offset=(15, -10))
    draw_station(320, 150, 'page.tsx', colors['frontend'], is_interchange=True, label_offset=(20, 5))
    draw_station(320, 250, 'globals.css', colors['frontend'], label_offset=(20, 5))
    draw_station(320, 350, 'feed/', colors['frontend'], label_offset=(20, 5))
    draw_station(320, 450, 'bookmarks/', colors['frontend'], label_offset=(20, 5))
    draw_station(320, 550, 'profile/', colors['frontend'], label_offset=(20, 5))
    draw_station(200, 550, 'onboarding/', colors['frontend'], label_offset=(15, 25))
    draw_station(100, 550, 'waitlist/', colors['frontend'], label_offset=(-70, 25))
    
    # Branch to trending/terms/privacy
    branch_points = [(320, 350), (420, 350), (520, 350), (520, 450)]
    draw_line(branch_points, colors['frontend'], line_width=6)
    draw_station(420, 350, 'trending/', colors['frontend'], label_offset=(15, -10))
    draw_station(520, 350, 'terms/', colors['frontend'], label_offset=(15, -10))
    draw_station(520, 450, 'privacy/', colors['frontend'], label_offset=(20, 5))
    
    # ============ API LINE (Blue) ============
    api_points = [
        (320, 150),   # Connect from page.tsx
        (420, 80),    # app/api/
        (520, 80),    # auth/
        (620, 80),    # feed/
        (720, 80),    # bookmarks/
        (820, 80),    # trending/
        (920, 80),    # user/
    ]
    draw_line(api_points, colors['api'])
    
    draw_station(420, 80, 'app/api/', colors['api'], is_interchange=True, label_offset=(15, -12))
    draw_station(520, 80, 'auth/', colors['api'], label_offset=(15, -12))
    draw_station(620, 80, 'feed/', colors['api'], label_offset=(15, -12))
    draw_station(720, 80, 'bookmarks/', colors['api'], label_offset=(15, -12))
    draw_station(820, 80, 'trending/', colors['api'], label_offset=(15, -12))
    draw_station(920, 80, 'user/', colors['api'], label_offset=(15, -12))
    
    # ============ MOBILE APP LINE (Teal) ============
    trace_points = [
        (100, 700),   # trace/
        (200, 700),   # _layout.tsx
        (300, 700),   # onboarding.tsx
        (400, 700),   # (tabs)/
        (500, 700),   # explore.tsx
        (500, 800),   # Turn down
        (400, 800),   # index.tsx
        (300, 800),   # profile.tsx
    ]
    draw_line(trace_points, colors['trace'])
    
    draw_station(100, 700, 'trace/', colors['trace'], is_interchange=True, label_offset=(-60, -15))
    draw_station(200, 700, '_layout.tsx', colors['trace'], label_offset=(15, -12))
    draw_station(300, 700, 'onboarding.tsx', colors['trace'], label_offset=(15, -12))
    draw_station(400, 700, '(tabs)/', colors['trace'], is_interchange=True, label_offset=(15, -12))
    draw_station(500, 700, 'explore.tsx', colors['trace'], label_offset=(15, -12))
    draw_station(500, 800, 'FeedCard.tsx', colors['trace'], label_offset=(20, 5))
    draw_station(400, 800, 'index.tsx', colors['trace'], label_offset=(15, 22))
    draw_station(300, 800, 'profile.tsx', colors['trace'], label_offset=(15, 22))
    
    # Components branch
    comp_points = [(400, 700), (400, 620), (300, 620), (200, 620)]
    draw_line(comp_points, colors['trace'], line_width=6)
    draw_station(400, 620, 'components/', colors['trace'], label_offset=(20, 5))
    draw_station(300, 620, 'contexts/', colors['trace'], label_offset=(15, -12))
    draw_station(200, 620, 'lib/', colors['trace'], label_offset=(15, -12))
    
    # ============ V1 FLOWS LINE (Yellow) ============
    flows_points = [
        (600, 200),   # v1/
        (700, 200),   # flows/
        (800, 200),   # build_feed_from_topics.py
        (900, 200),   # build_newsletter.py
        (900, 300),   # Turn
        (800, 300),   # build_topics.py
        (700, 300),   # add_trending.py
        (600, 300),   # send_newsletter.py
        (600, 400),   # Continue down
        (700, 400),   # scheduler.py
        (800, 400),   # run_daily_batch.py
    ]
    draw_line(flows_points, colors['v1_flows'])
    
    draw_station(600, 200, 'v1/', colors['v1_flows'], is_interchange=True, label_offset=(-40, -12))
    draw_station(700, 200, 'flows/', colors['v1_flows'], is_interchange=True, label_offset=(15, -12))
    draw_station(800, 200, 'build_feed', colors['v1_flows'], label_offset=(15, -12), font_size=10)
    draw_station(900, 200, 'newsletter', colors['v1_flows'], label_offset=(15, -12), font_size=10)
    draw_station(900, 300, 'trending', colors['v1_flows'], label_offset=(20, 5), font_size=10)
    draw_station(800, 300, 'topics', colors['v1_flows'], label_offset=(15, 22), font_size=10)
    draw_station(700, 300, 'suggestions', colors['v1_flows'], label_offset=(15, 22), font_size=10)
    draw_station(600, 300, 'unsubscribe', colors['v1_flows'], label_offset=(-80, 5), font_size=10)
    draw_station(600, 400, 'storage.py', colors['v1_flows'], label_offset=(-85, 5))
    draw_station(700, 400, 'scheduler.py', colors['v1_flows'], label_offset=(15, 22))
    draw_station(800, 400, 'run_daily.py', colors['v1_flows'], label_offset=(15, 22))
    
    # ============ CORE AGENTS LINE (Purple) ============
    core_points = [
        (600, 200),   # Connect from v1/
        (600, 500),   # core_agents/
        (700, 500),   # reflection.py
        (800, 500),   # __init__.py
    ]
    draw_line(core_points, colors['v1_core'])
    
    draw_station(600, 500, 'core_agents/', colors['v1_core'], is_interchange=True, label_offset=(-95, 5))
    draw_station(700, 500, 'reflection.py', colors['v1_core'], label_offset=(15, 22))
    draw_station(800, 500, 'prompts/', colors['v1_core'], label_offset=(15, 22))
    
    # ============ TOOLS LINE (Green) ============
    tools_points = [
        (700, 200),   # Connect from flows/
        (700, 580),   # tools/
        (800, 580),   # Various tools
        (900, 580),   
        (900, 650),   
        (800, 650),   
    ]
    draw_line(tools_points, colors['v1_tools'])
    
    draw_station(700, 580, 'tools/', colors['v1_tools'], is_interchange=True, label_offset=(-55, 5))
    draw_station(800, 580, 'tavily.py', colors['v1_tools'], label_offset=(15, -12))
    draw_station(900, 580, 'firecrawl.py', colors['v1_tools'], label_offset=(15, -12))
    draw_station(900, 650, 'perplexity.py', colors['v1_tools'], label_offset=(20, 5))
    draw_station(800, 650, 'pool_utils.py', colors['v1_tools'], label_offset=(15, 22))
    
    # ============ ANALYSIS LINE (Orange) ============
    analysis_points = [
        (100, 400),   # analysis/
        (200, 400),   # user_analysis.ipynb
        (300, 400),   # audience_analysis.py
        (400, 400),   # data/
        (500, 400),   # topics.json
        (500, 480),   # user_profiles.json
    ]
    draw_line(analysis_points, colors['analysis'])
    
    draw_station(100, 400, 'analysis/', colors['analysis'], is_interchange=True, label_offset=(-80, -12))
    draw_station(200, 400, 'notebooks', colors['analysis'], label_offset=(15, -12))
    draw_station(300, 400, 'audience.py', colors['analysis'], label_offset=(15, -12))
    draw_station(400, 400, 'data/', colors['analysis'], is_interchange=True, label_offset=(15, -12))
    draw_station(500, 400, 'topics.json', colors['analysis'], label_offset=(20, 5))
    draw_station(500, 480, 'profiles.json', colors['analysis'], label_offset=(20, 5))
    
    # ============ CONNECTING LINES (shared libs/contexts) ============
    # Firebase connection between frontend and trace
    firebase_points = [(200, 550), (200, 620)]
    draw_line(firebase_points, '#888888', line_width=4)
    
    # Draw legend
    draw_legend()
    
    # Title
    dwg.add(dwg.text('🚇', insert=(50, 60), font_size=36))
    dwg.add(dwg.text('CLAUDIA', insert=(100, 55), fill='#ffffff', 
                    font_size=32, font_family='Menlo, monospace', font_weight='bold'))
    dwg.add(dwg.text('Codebase Transit Authority', insert=(100, 80), fill='#888888', 
                    font_size=14, font_family='Menlo, monospace'))
    
    # Footer
    dwg.add(dwg.text('Next.js • Expo • Python • Firebase', insert=(50, height - 30), 
                    fill='#666666', font_size=12, font_family='Menlo, monospace'))
    
    # Save the SVG
    dwg.save()
    print("✅ Subway map saved to codebase_subway.svg")
    
    # Also create a PNG version using cairosvg if available
    try:
        import cairosvg
        cairosvg.svg2png(url='codebase_subway.svg', write_to='codebase_subway.png', scale=2)
        print("✅ PNG version saved to codebase_subway.png")
    except ImportError:
        print("ℹ️  Install cairosvg to also generate PNG: pip install cairosvg")

if __name__ == '__main__':
    create_subway_map()

