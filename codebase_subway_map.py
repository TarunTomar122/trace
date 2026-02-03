#!/usr/bin/env python3
"""
Generate a subway map visualization of the Trace codebase
"""

import svgwrite
import math

def create_subway_map():
    # Canvas size - wider for better horizontal use
    width = 1800
    height = 900
    
    dwg = svgwrite.Drawing('codebase_subway.svg', size=(width, height))
    
    # Add background with subtle grid pattern (LIGHT MODE)
    dwg.add(dwg.rect(insert=(0, 0), size=(width, height), fill='#f5f5f5'))
    
    # Grid pattern
    grid = dwg.defs.add(dwg.pattern(id='grid', size=(30, 30), patternUnits='userSpaceOnUse'))
    grid.add(dwg.line(start=(0, 0), end=(30, 0), stroke='#e0e0e0', stroke_width=0.5))
    grid.add(dwg.line(start=(0, 0), end=(0, 30), stroke='#e0e0e0', stroke_width=0.5))
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
        dwg.add(dwg.circle(center=(x, y), r=r+3, fill=color, opacity=0.2))
        # Station circle
        dwg.add(dwg.circle(center=(x, y), r=r, fill='#ffffff', stroke=color, stroke_width=3))
        if is_interchange:
            dwg.add(dwg.circle(center=(x, y), r=r-4, fill=color))
        
        # Label
        text = dwg.text(name, insert=(x + label_offset[0], y + label_offset[1]), 
                       fill='#333333', font_size=font_size, font_family='Menlo, monospace',
                       font_weight='500')
        dwg.add(text)
    
    def draw_legend():
        """Draw the legend"""
        legend_x = 1500
        legend_y = 100
        
        # Legend box (light mode)
        dwg.add(dwg.rect(insert=(legend_x - 20, legend_y - 30), size=(280, 280), 
                        fill='#ffffff', rx=10, ry=10, opacity=0.9, stroke='#e0e0e0', stroke_width=1))
        dwg.add(dwg.text('TRACE CODEBASE', insert=(legend_x, legend_y), 
                        fill='#222222', font_size=16, font_family='Menlo, monospace',
                        font_weight='bold'))
        dwg.add(dwg.text('TRANSIT MAP', insert=(legend_x, legend_y + 20), 
                        fill='#666666', font_size=12, font_family='Menlo, monospace'))
        
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
                           fill='#333333', font_size=11, font_family='Menlo, monospace'))
    
    # ============ FRONTEND LINE (Red) ============
    frontend_points = [
        (80, 150),    # Start
        (200, 150),   # layout.tsx
        (350, 150),   # page.tsx (main)
        (350, 280),   # Turn down
        (350, 400),   # feed/
        (350, 520),   # bookmarks/
        (200, 520),   # profile/
        (80, 520),    # onboarding/
    ]
    draw_line(frontend_points, colors['frontend'])
    
    draw_station(80, 150, 'frontend/', colors['frontend'], is_interchange=True, label_offset=(-75, -15))
    draw_station(200, 150, 'layout.tsx', colors['frontend'], label_offset=(15, -10))
    draw_station(350, 150, 'page.tsx', colors['frontend'], is_interchange=True, label_offset=(20, 5))
    draw_station(350, 280, 'globals.css', colors['frontend'], label_offset=(20, 5))
    draw_station(350, 400, 'feed/', colors['frontend'], label_offset=(20, 5))
    draw_station(350, 520, 'bookmarks/', colors['frontend'], label_offset=(20, 5))
    draw_station(200, 520, 'profile/', colors['frontend'], label_offset=(15, 25))
    draw_station(80, 520, 'onboarding/', colors['frontend'], label_offset=(-85, 5))
    
    # Branch to trending/terms/privacy (horizontal spread)
    branch_points = [(350, 400), (480, 400), (610, 400), (610, 520)]
    draw_line(branch_points, colors['frontend'], line_width=6)
    draw_station(480, 400, 'trending/', colors['frontend'], label_offset=(15, -10))
    draw_station(610, 400, 'terms/', colors['frontend'], label_offset=(15, -10))
    draw_station(610, 520, 'privacy/', colors['frontend'], label_offset=(20, 5))
    
    # ============ API LINE (Blue) ============
    api_points = [
        (350, 150),   # Connect from page.tsx
        (500, 80),    # app/api/
        (650, 80),    # auth/
        (800, 80),    # feed/
        (950, 80),    # bookmarks/
        (1100, 80),   # trending/
        (1250, 80),   # user/
    ]
    draw_line(api_points, colors['api'])
    
    draw_station(500, 80, 'app/api/', colors['api'], is_interchange=True, label_offset=(15, -12))
    draw_station(650, 80, 'auth/', colors['api'], label_offset=(15, -12))
    draw_station(800, 80, 'feed/', colors['api'], label_offset=(15, -12))
    draw_station(950, 80, 'bookmarks/', colors['api'], label_offset=(15, -12))
    draw_station(1100, 80, 'trending/', colors['api'], label_offset=(15, -12))
    draw_station(1250, 80, 'user/', colors['api'], label_offset=(15, -12))
    
    # ============ MOBILE APP LINE (Teal) ============
    trace_points = [
        (80, 680),    # trace/
        (220, 680),   # _layout.tsx
        (380, 680),   # onboarding.tsx
        (540, 680),   # (tabs)/
        (700, 680),   # explore.tsx
        (700, 800),   # Turn down
        (540, 800),   # index.tsx
        (380, 800),   # profile.tsx
    ]
    draw_line(trace_points, colors['trace'])
    
    draw_station(80, 680, 'trace/', colors['trace'], is_interchange=True, label_offset=(-55, -15))
    draw_station(220, 680, '_layout.tsx', colors['trace'], label_offset=(15, -12))
    draw_station(380, 680, 'onboarding.tsx', colors['trace'], label_offset=(15, -12))
    draw_station(540, 680, '(tabs)/', colors['trace'], is_interchange=True, label_offset=(15, -12))
    draw_station(700, 680, 'explore.tsx', colors['trace'], label_offset=(15, -12))
    draw_station(700, 800, 'FeedCard.tsx', colors['trace'], label_offset=(20, 5))
    draw_station(540, 800, 'index.tsx', colors['trace'], label_offset=(15, 22))
    draw_station(380, 800, 'profile.tsx', colors['trace'], label_offset=(15, 22))
    
    # Components branch
    comp_points = [(540, 680), (540, 600), (380, 600), (220, 600)]
    draw_line(comp_points, colors['trace'], line_width=6)
    draw_station(540, 600, 'components/', colors['trace'], label_offset=(20, 5))
    draw_station(380, 600, 'contexts/', colors['trace'], label_offset=(15, -12))
    draw_station(220, 600, 'lib/', colors['trace'], label_offset=(15, -12))
    
    # ============ V1 FLOWS LINE (Yellow) ============
    flows_points = [
        (800, 200),   # v1/
        (950, 200),   # flows/
        (1100, 200),  # build_feed_from_topics.py
        (1250, 200),  # build_newsletter.py
        (1400, 200),  # Turn
        (1400, 320),  # build_topics.py
        (1250, 320),  # add_trending.py
        (1100, 320),  # send_newsletter.py
        (950, 320),   # Continue
        (800, 320),   # storage.py
        (800, 440),   # scheduler.py
        (950, 440),   # run_daily_batch.py
    ]
    draw_line(flows_points, colors['v1_flows'])
    
    draw_station(800, 200, 'v1/', colors['v1_flows'], is_interchange=True, label_offset=(-40, -12))
    draw_station(950, 200, 'flows/', colors['v1_flows'], is_interchange=True, label_offset=(15, -12))
    draw_station(1100, 200, 'build_feed', colors['v1_flows'], label_offset=(15, -12), font_size=10)
    draw_station(1250, 200, 'newsletter', colors['v1_flows'], label_offset=(15, -12), font_size=10)
    draw_station(1400, 200, 'trending', colors['v1_flows'], label_offset=(20, 5), font_size=10)
    draw_station(1400, 320, 'topics', colors['v1_flows'], label_offset=(20, 5), font_size=10)
    draw_station(1250, 320, 'suggestions', colors['v1_flows'], label_offset=(15, 22), font_size=10)
    draw_station(1100, 320, 'unsubscribe', colors['v1_flows'], label_offset=(15, 22), font_size=10)
    draw_station(950, 320, 'hooks/', colors['v1_flows'], label_offset=(15, 22))
    draw_station(800, 320, 'storage.py', colors['v1_flows'], label_offset=(-85, 5))
    draw_station(800, 440, 'scheduler.py', colors['v1_flows'], label_offset=(-95, 5))
    draw_station(950, 440, 'run_daily.py', colors['v1_flows'], label_offset=(15, 22))
    
    # ============ CORE AGENTS LINE (Purple) ============
    core_points = [
        (800, 200),   # Connect from v1/
        (800, 560),   # core_agents/
        (950, 560),   # reflection.py
        (1100, 560),  # prompts/
    ]
    draw_line(core_points, colors['v1_core'])
    
    draw_station(800, 560, 'core_agents/', colors['v1_core'], is_interchange=True, label_offset=(-100, 5))
    draw_station(950, 560, 'reflection.py', colors['v1_core'], label_offset=(15, 22))
    draw_station(1100, 560, 'prompts/', colors['v1_core'], label_offset=(15, 22))
    
    # ============ TOOLS LINE (Green) ============
    tools_points = [
        (950, 200),   # Connect from flows/
        (950, 680),   # tools/
        (1100, 680),  # Various tools
        (1250, 680),   
        (1400, 680),   
        (1400, 800),   
        (1250, 800),   
    ]
    draw_line(tools_points, colors['v1_tools'])
    
    draw_station(950, 680, 'tools/', colors['v1_tools'], is_interchange=True, label_offset=(-55, 5))
    draw_station(1100, 680, 'tavily.py', colors['v1_tools'], label_offset=(15, -12))
    draw_station(1250, 680, 'firecrawl.py', colors['v1_tools'], label_offset=(15, -12))
    draw_station(1400, 680, 'perplexity.py', colors['v1_tools'], label_offset=(15, -12))
    draw_station(1400, 800, 'algorithm/', colors['v1_tools'], label_offset=(20, 5))
    draw_station(1250, 800, 'pool_utils.py', colors['v1_tools'], label_offset=(15, 22))
    
    # ============ ANALYSIS LINE (Orange) ============
    analysis_points = [
        (80, 400),    # analysis/
        (220, 400),   # user_analysis.ipynb
        (380, 400),   # audience_analysis.py
        (540, 400),   # data/
        (700, 400),   # topics.json
        (700, 520),   # user_profiles.json
    ]
    draw_line(analysis_points, colors['analysis'])
    
    draw_station(80, 400, 'analysis/', colors['analysis'], is_interchange=True, label_offset=(-75, -12))
    draw_station(220, 400, 'notebooks', colors['analysis'], label_offset=(15, -12))
    draw_station(380, 400, 'audience.py', colors['analysis'], label_offset=(15, -12))
    draw_station(540, 400, 'data/', colors['analysis'], is_interchange=True, label_offset=(15, -12))
    draw_station(700, 400, 'topics.json', colors['analysis'], label_offset=(20, 5))
    draw_station(700, 520, 'profiles.json', colors['analysis'], label_offset=(20, 5))
    
    # ============ CONNECTING LINES (shared libs/contexts) ============
    # Firebase connection between frontend and trace
    firebase_points = [(220, 520), (220, 600)]
    draw_line(firebase_points, '#888888', line_width=4)
    
    # Draw legend
    draw_legend()
    
    # Title
    dwg.add(dwg.text('🚇', insert=(50, 55), font_size=36))
    dwg.add(dwg.text('TRACE', insert=(100, 50), fill='#222222', 
                    font_size=32, font_family='Menlo, monospace', font_weight='bold'))
    dwg.add(dwg.text('Codebase Transit Authority', insert=(100, 75), fill='#666666', 
                    font_size=14, font_family='Menlo, monospace'))
    
    # Footer
    dwg.add(dwg.text('Next.js • Expo • Python • Firebase', insert=(50, height - 20), 
                    fill='#888888', font_size=12, font_family='Menlo, monospace'))
    
    # Save the SVG
    dwg.save()
    print("✅ Subway map saved to codebase_subway.svg")
    
    # Convert to PNG using Playwright (renders in headless browser)
    try:
        from playwright.sync_api import sync_playwright
        import os
        
        svg_path = os.path.abspath('codebase_subway.svg')
        png_path = os.path.abspath('codebase_subway.png')
        
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1800, 'height': 900})
            page.goto(f'file://{svg_path}')
            page.screenshot(path=png_path, type='png', scale='css')
            browser.close()
        
        print("✅ PNG version saved to codebase_subway.png")
    except ImportError:
        print("ℹ️  Install playwright for PNG: pip install playwright && playwright install chromium")
    except Exception as e:
        print(f"⚠️  PNG conversion failed: {e}")

if __name__ == '__main__':
    create_subway_map()

