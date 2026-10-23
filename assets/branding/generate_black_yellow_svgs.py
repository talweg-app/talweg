import os
import subprocess

def generate_black_yellow():
    output_dir = "/home/ivan/Projects/talweg-app/assets/branding"
    os.makedirs(output_dir, exist_ok=True)

    # 1. Concept 1: "The Golden Talweg" (Luminous Gold Stream in Dark Carbon Valley)
    # Deep true black (#070708), carbon contour curves (#18181C, #25252C, #363640)
    # Electric Yellow / Vivid Amber Stream (#FFE500 -> #F59E0B)
    v1_gold_stream = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <radialGradient id="darkBg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#0E0E12" />
      <stop offset="60%" stop-color="#060608" />
      <stop offset="100%" stop-color="#020203" />
    </radialGradient>
    <linearGradient id="goldBeam" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFF066" />
      <stop offset="45%" stop-color="#FFD000" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <linearGradient id="goldGlowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFD000" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.05" />
    </linearGradient>
    <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="24" result="blur1" />
      <feGaussianBlur stdDeviation="8" result="blur2" />
      <feMerge>
        <feMergeNode in="blur1" />
        <feMergeNode in="blur2" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="intensePoint" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Deep Black Container -->
  <rect width="1024" height="1024" rx="220" fill="url(#darkBg)" />

  <!-- Subtle Circular Safe Margin for GitHub Org Avatar -->
  <circle cx="512" cy="512" r="480" stroke="#17171C" stroke-width="1.5" stroke-dasharray="6 10" />

  <!-- Background Soft Gold Ambient Light in Canyon Center -->
  <ellipse cx="512" cy="620" rx="140" ry="260" fill="url(#goldGlowGrad)" />

  <!-- Topography Contour Elevations (The Valley Ridges) -->
  <!-- Level 1 (Top ridge) -->
  <path d="M 200 280 Q 512 400 824 280" stroke="#1C1C22" stroke-width="5" stroke-linecap="round" fill="none" />
  
  <!-- Level 2 (Mid-high ridge) -->
  <path d="M 170 410 Q 350 490 460 520 L 512 535 L 564 520 Q 674 490 854 410" 
        stroke="#24242D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <!-- Level 3 (Mid-low ridge) -->
  <path d="M 150 560 Q 330 650 450 690 L 512 708 L 574 690 Q 694 650 874 560" 
        stroke="#2E2E3A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <!-- Level 4 (Deep valley floor ridge) -->
  <path d="M 140 720 Q 320 820 440 865 L 512 885 L 584 865 Q 704 820 884 720" 
        stroke="#3D3D4E" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <!-- The Talweg (Golden Flow Line) -->
  <!-- Outer Atmospheric Glow -->
  <path d="M 512 170 L 512 885" stroke="#FFD000" stroke-width="32" opacity="0.12" filter="url(#goldGlow)" />
  <path d="M 512 170 L 512 885" stroke="#FFD000" stroke-width="14" opacity="0.4" filter="url(#goldGlow)" />
  <!-- Sharp Core Vector Line -->
  <path d="M 512 170 L 512 885" stroke="url(#goldBeam)" stroke-width="8" stroke-linecap="round" />

  <!-- Thought Nodes Along the Talweg -->
  <circle cx="512" cy="340" r="7" fill="#0A0A0D" stroke="#FFE500" stroke-width="3.5" />
  <circle cx="512" cy="535" r="9" fill="#0A0A0D" stroke="#FFD000" stroke-width="4" />
  <circle cx="512" cy="708" r="11" fill="#0A0A0D" stroke="#FFC000" stroke-width="4.5" />

  <!-- Bottom Anchor Node (Bright Destination) -->
  <circle cx="512" cy="885" r="24" fill="#FFD000" filter="url(#intensePoint)" />
  <circle cx="512" cy="885" r="13" fill="#070709" stroke="#FFF066" stroke-width="5" />
</svg>
"""

    # 2. Concept 2: "The Geometric Golden Monogram T" (Modern, Bold, High-Impact)
    # Razor-sharp industrial geometry. Visible even at 16px.
    v2_gold_monogram = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <radialGradient id="monoDarkBg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#111116" />
      <stop offset="70%" stop-color="#070709" />
      <stop offset="100%" stop-color="#020203" />
    </radialGradient>
    <linearGradient id="goldAcc" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF066" />
      <stop offset="50%" stop-color="#FFD000" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <filter id="monoGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="1024" height="1024" rx="220" fill="url(#monoDarkBg)" />
  <circle cx="512" cy="512" r="480" stroke="#16161B" stroke-width="1.5" />

  <!-- Subtle background carbon chevron echo -->
  <path d="M 240 280 L 512 420 L 784 280" stroke="#191921" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 270 380 L 512 500 L 754 380" stroke="#22222C" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <!-- Main Monogram: Valley Top Bar (Angular yet elegant) -->
  <path d="M 230 330 Q 370 470 512 470 Q 654 470 794 330" 
        stroke="url(#goldAcc)" stroke-width="38" stroke-linecap="round" fill="none" filter="url(#monoGlow)" />

  <!-- Main Monogram: Talweg Stem (Vertical laser path) -->
  <path d="M 512 470 L 512 790" stroke="#FFD000" stroke-width="48" opacity="0.2" filter="url(#monoGlow)" />
  <path d="M 512 470 L 512 790" stroke="url(#goldAcc)" stroke-width="36" stroke-linecap="round" />

  <!-- Terminus Point -->
  <circle cx="512" cy="790" r="30" fill="#FFD000" filter="url(#monoGlow)" />
  <circle cx="512" cy="790" r="16" fill="#070709" stroke="#FFF066" stroke-width="5" />
</svg>
"""

    # 3. Concept 3: "Golden Fissure / Topographic Contour Ring" (Minimalist Tech Emblem)
    # A sleek circular badge with concentric gold-tipped topographical arcs
    v3_emblem = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <radialGradient id="emblemBg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#121216" />
      <stop offset="100%" stop-color="#040405" />
    </radialGradient>
    <linearGradient id="ringGold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD000" />
      <stop offset="100%" stop-color="#FFB300" />
    </linearGradient>
    <filter id="emblemGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="1024" height="1024" rx="220" fill="url(#emblemBg)" />

  <!-- Circular Outer Frame with Tech Tick Marks -->
  <circle cx="512" cy="512" r="380" stroke="#22222B" stroke-width="4" stroke-dasharray="12 18" />
  <circle cx="512" cy="512" r="420" stroke="#16161D" stroke-width="2" />

  <!-- Flowing Topographic Contour Arcs -->
  <path d="M 280 340 C 390 440, 470 460, 512 460 C 554 460, 634 440, 744 340" stroke="#33333F" stroke-width="8" stroke-linecap="round" fill="none" />
  <path d="M 240 460 C 370 570, 460 590, 512 590 C 564 590, 654 570, 784 460" stroke="#444454" stroke-width="10" stroke-linecap="round" fill="none" />
  <path d="M 220 590 C 350 710, 450 730, 512 730 C 574 730, 674 710, 804 590" stroke="#555568" stroke-width="10" stroke-linecap="round" fill="none" />

  <!-- The Golden Fissure (Talweg Stream crossing the arcs) -->
  <path d="M 512 240 L 512 800" stroke="#FFD000" stroke-width="28" opacity="0.15" filter="url(#emblemGlow)" />
  <path d="M 512 240 L 512 800" stroke="url(#ringGold)" stroke-width="10" stroke-linecap="round" />

  <!-- Precision Crosshair Markers -->
  <circle cx="512" cy="310" r="6" fill="#FFD000" />
  <circle cx="512" cy="460" r="9" fill="#0A0A0D" stroke="#FFD000" stroke-width="4" />
  <circle cx="512" cy="590" r="11" fill="#0A0A0D" stroke="#FFD000" stroke-width="5" />
  <circle cx="512" cy="730" r="13" fill="#0A0A0D" stroke="#FFD000" stroke-width="6" />

  <!-- Final Golden Core Beacon -->
  <circle cx="512" cy="800" r="26" fill="#FFD000" filter="url(#emblemGlow)" />
  <circle cx="512" cy="800" r="14" fill="#060608" stroke="#FFE500" stroke-width="5" />
</svg>
"""

    # 4. GitHub Social Preview Card (1280x640) in Black & Gold
    sp_gold = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640" fill="none">
  <defs>
    <radialGradient id="spGoldBg" cx="25%" cy="35%" r="85%">
      <stop offset="0%" stop-color="#101015" />
      <stop offset="60%" stop-color="#070709" />
      <stop offset="100%" stop-color="#020203" />
    </radialGradient>
    <linearGradient id="goldAccLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFF066" />
      <stop offset="50%" stop-color="#FFD000" />
      <stop offset="100%" stop-color="#F59E0B" />
    </linearGradient>
    <filter id="goldCardGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Deep Obsidian Black Background -->
  <rect width="1280" height="640" fill="url(#spGoldBg)" />

  <!-- Fine Technical Grid Accent (Subtle dark titanium) -->
  <g opacity="0.18">
    <line x1="80" y1="0" x2="80" y2="640" stroke="#33333F" stroke-width="1" stroke-dasharray="3 6" />
    <line x1="640" y1="0" x2="640" y2="640" stroke="#33333F" stroke-width="1" stroke-dasharray="3 6" />
    <line x1="1200" y1="0" x2="1200" y2="640" stroke="#33333F" stroke-width="1" stroke-dasharray="3 6" />
    <line x1="0" y1="120" x2="1280" y2="120" stroke="#33333F" stroke-width="1" stroke-dasharray="3 6" />
    <line x1="0" y1="520" x2="1280" y2="520" stroke="#33333F" stroke-width="1" stroke-dasharray="3 6" />
  </g>

  <!-- Right Half: Topographic Valley Curves -->
  <g opacity="0.6">
    <path d="M 680 90 Q 960 170 1240 90" stroke="#1C1C24" stroke-width="3" fill="none" />
    <path d="M 650 190 Q 960 300 1260 200" stroke="#252530" stroke-width="3.5" fill="none" />
    <path d="M 620 310 Q 960 450 1280 320" stroke="#323240" stroke-width="4" fill="none" />
    <path d="M 600 440 Q 960 600 1290 450" stroke="#404052" stroke-width="4.5" fill="none" />
  </g>

  <!-- Right Half: Luminous Golden Talweg Channel -->
  <path d="M 960 50 L 960 590" stroke="#FFD000" stroke-width="24" opacity="0.12" filter="url(#goldCardGlow)" />
  <path d="M 960 50 L 960 590" stroke="url(#goldAccLine)" stroke-width="5" stroke-linecap="round" />
  
  <circle cx="960" cy="130" r="5" fill="#FFE500" />
  <circle cx="960" cy="245" r="7" fill="#0A0A0D" stroke="#FFD000" stroke-width="3.5" />
  <circle cx="960" cy="380" r="9" fill="#0A0A0D" stroke="#FFD000" stroke-width="4" />
  <circle cx="960" cy="525" r="16" fill="#FFD000" filter="url(#goldCardGlow)" />
  <circle cx="960" cy="525" r="8" fill="#070709" stroke="#FFF066" stroke-width="3.5" />

  <!-- Left Half: Branding & Typography -->
  <g transform="translate(100, 140)">
    <!-- Brand Icon -->
    <g transform="translate(0, 0) scale(0.65)">
      <rect width="120" height="120" rx="30" fill="#121217" stroke="#2B2B36" stroke-width="3" />
      <path d="M 24 38 Q 60 56 96 38" stroke="#363644" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 24 58 Q 60 76 96 58" stroke="#4C4C5F" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 24 78 Q 60 96 96 78" stroke="#363644" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 60 22 L 60 98" stroke="#FFD000" stroke-width="5" stroke-linecap="round"/>
      <circle cx="60" cy="76" r="6" fill="#FFD000" />
    </g>

    <!-- Main Title -->
    <text x="100" y="55" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="64" font-weight="800" fill="#FFFFFF" letter-spacing="-0.03em">Talweg</text>

    <!-- Pronunciation -->
    <text x="355" y="50" font-family="'SF Mono', Menlo, Consolas, monospace" 
          font-size="18" font-weight="600" fill="#FBBF24">/ˈtɑːlvɛɡ/</text>

    <!-- Slogan -->
    <text x="0" y="140" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="28" font-weight="500" fill="#E2E8F0" letter-spacing="-0.01em">
      The natural path through complex thoughts.
    </text>

    <!-- Subtitle / Value Proposition -->
    <text x="0" y="185" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="20" font-weight="400" fill="#94A3B8">
      Local-first • Yjs CRDT • IndexedDB • Orthogonal A* Routing • Zero Telemetry
    </text>

    <!-- Badges Container -->
    <g transform="translate(0, 230)">
      <!-- Badge 1: Local-first in Gold -->
      <rect x="0" y="0" width="130" height="36" rx="8" fill="#18181E" stroke="#363642" stroke-width="1.5" />
      <text x="16" y="23" font-family="'SF Mono', Menlo, monospace" font-size="13" font-weight="700" fill="#FFD000">local-first</text>

      <!-- Badge 2: Open Source in White -->
      <rect x="142" y="0" width="135" height="36" rx="8" fill="#18181E" stroke="#363642" stroke-width="1.5" />
      <text x="156" y="23" font-family="'SF Mono', Menlo, monospace" font-size="13" font-weight="600" fill="#F1F5F9">open-source</text>

      <!-- Badge 3: Zero Telemetry -->
      <rect x="289" y="0" width="150" height="36" rx="8" fill="#18181E" stroke="#363642" stroke-width="1.5" />
      <text x="303" y="23" font-family="'SF Mono', Menlo, monospace" font-size="13" font-weight="600" fill="#94A3B8">zero-telemetry</text>
    </g>
  </g>

  <!-- Bottom Crisp Gold Horizon -->
  <line x1="0" y1="638" x2="1280" y2="638" stroke="#1A1A22" stroke-width="2" />
  <line x1="880" y1="638" x2="1040" y2="638" stroke="#FFD000" stroke-width="3" />
</svg>
"""

    files = {
        "org_avatar_golden_talweg.svg": v1_gold_stream,
        "org_avatar_golden_monogram.svg": v2_gold_monogram,
        "org_avatar_golden_emblem.svg": v3_emblem,
        "github_social_preview_gold.svg": sp_gold,
    }

    for name, content in files.items():
        filepath = os.path.join(output_dir, name)
        with open(filepath, "w") as f:
            f.write(content)

    print("Black and Gold SVGs generated successfully.")

if __name__ == "__main__":
    generate_black_yellow()
