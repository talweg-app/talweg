import os
import subprocess

def create_all_assets():
    output_dir = "/home/ivan/Projects/talweg-app/assets/branding"
    os.makedirs(output_dir, exist_ok=True)

    # 1. Dark Topography (Default 1024x1024)
    v1_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E171B" />
      <stop offset="100%" stop-color="#070B0D" />
    </linearGradient>
    <linearGradient id="streamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.4" />
      <stop offset="40%" stop-color="#2DD4BF" stop-opacity="1" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="1" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="1024" height="1024" rx="220" fill="url(#bgGrad)" />
  <circle cx="512" cy="512" r="480" stroke="#162329" stroke-width="2" stroke-dasharray="8 12" opacity="0.6" />

  <path d="M 220 290 Q 512 410 804 290" stroke="#1B2930" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M 190 410 Q 360 480 470 510 L 512 525 L 554 510 Q 664 480 834 410" stroke="#22353E" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 170 550 Q 340 630 460 670 L 512 690 L 564 670 Q 684 630 854 550" stroke="#2A424E" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 160 700 Q 330 790 450 835 L 512 860 L 574 835 Q 694 790 864 700" stroke="#345262" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <path d="M 512 180 L 512 860" stroke="#2DD4BF" stroke-width="24" opacity="0.15" filter="url(#softGlow)" />
  <path d="M 512 180 L 512 860" stroke="url(#streamGrad)" stroke-width="10" stroke-linecap="round" />

  <circle cx="512" cy="350" r="8" fill="#1B2930" stroke="#2DD4BF" stroke-width="4" />
  <circle cx="512" cy="525" r="10" fill="#22353E" stroke="#2DD4BF" stroke-width="5" />
  <circle cx="512" cy="690" r="12" fill="#2A424E" stroke="#5EEAD4" stroke-width="6" />
  
  <circle cx="512" cy="860" r="22" fill="#5EEAD4" filter="url(#softGlow)" />
  <circle cx="512" cy="860" r="14" fill="#0B1215" stroke="#5EEAD4" stroke-width="6" />
</svg>
"""

    # 2. Transparent Topography (No rect background, pure vector)
    v1_transparent = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <linearGradient id="streamGradT" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.4" />
      <stop offset="40%" stop-color="#2DD4BF" stop-opacity="1" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="1" />
    </linearGradient>
    <filter id="softGlowT" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <path d="M 220 290 Q 512 410 804 290" stroke="#334D5C" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M 190 410 Q 360 480 470 510 L 512 525 L 554 510 Q 664 480 834 410" stroke="#416173" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 170 550 Q 340 630 460 670 L 512 690 L 564 670 Q 684 630 854 550" stroke="#4F758C" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 160 700 Q 330 790 450 835 L 512 860 L 574 835 Q 694 790 864 700" stroke="#5E8AA5" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <path d="M 512 180 L 512 860" stroke="#2DD4BF" stroke-width="24" opacity="0.25" filter="url(#softGlowT)" />
  <path d="M 512 180 L 512 860" stroke="url(#streamGradT)" stroke-width="10" stroke-linecap="round" />

  <circle cx="512" cy="350" r="8" fill="#1B2930" stroke="#2DD4BF" stroke-width="4" />
  <circle cx="512" cy="525" r="10" fill="#22353E" stroke="#2DD4BF" stroke-width="5" />
  <circle cx="512" cy="690" r="12" fill="#2A424E" stroke="#5EEAD4" stroke-width="6" />
  
  <circle cx="512" cy="860" r="22" fill="#5EEAD4" filter="url(#softGlowT)" />
  <circle cx="512" cy="860" r="14" fill="#0B1215" stroke="#5EEAD4" stroke-width="6" />
</svg>
"""

    # 3. Monogram T Dark
    v2_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <linearGradient id="tBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F171A" />
      <stop offset="100%" stop-color="#080D0F" />
    </linearGradient>
    <linearGradient id="tStroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5EEAD4" />
      <stop offset="100%" stop-color="#0EA5E9" />
    </linearGradient>
    <filter id="tGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="1024" height="1024" rx="220" fill="url(#tBg)" />
  <path d="M 240 320 Q 512 440 784 320" stroke="#18252C" stroke-width="12" stroke-linecap="round" fill="none" />
  <path d="M 280 440 Q 512 550 744 440" stroke="#1E2F38" stroke-width="12" stroke-linecap="round" fill="none" />

  <path d="M 240 360 C 400 480, 470 500, 512 500 C 554 500, 624 480, 784 360" 
        stroke="url(#tStroke)" stroke-width="36" stroke-linecap="round" fill="none" />

  <path d="M 512 500 L 512 780" stroke="#15242C" stroke-width="48" stroke-linecap="round" />
  <path d="M 512 500 L 512 780" stroke="url(#tStroke)" stroke-width="36" stroke-linecap="round" />

  <circle cx="512" cy="780" r="28" fill="#5EEAD4" filter="url(#tGlow)" />
  <circle cx="512" cy="780" r="16" fill="#080D0F" stroke="#5EEAD4" stroke-width="6" />
</svg>
"""

    # 4. Social Preview Card (1280x640)
    sp_card = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640" fill="none">
  <defs>
    <linearGradient id="spBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1317" />
      <stop offset="50%" stop-color="#080E11" />
      <stop offset="100%" stop-color="#05080A" />
    </linearGradient>
    <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2DD4BF" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>
    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="1280" height="640" fill="url(#spBg)" />

  <g opacity="0.35">
    <path d="M 700 80 Q 950 160 1220 90" stroke="#1A2930" stroke-width="2" stroke-dasharray="4 6" fill="none" />
    <path d="M 680 180 Q 950 290 1240 190" stroke="#21353F" stroke-width="2.5" fill="none" />
    <path d="M 660 300 Q 950 430 1250 310" stroke="#2B434F" stroke-width="3" fill="none" />
    <path d="M 640 430 Q 950 580 1260 440" stroke="#1F323B" stroke-width="2" fill="none" />
    <path d="M 620 550 Q 950 710 1280 570" stroke="#16242B" stroke-width="2" stroke-dasharray="6 8" fill="none" />
  </g>

  <path d="M 950 40 L 950 600" stroke="url(#accentLine)" stroke-width="4" stroke-linecap="round" />
  <circle cx="950" cy="235" r="5" fill="#2DD4BF" />
  <circle cx="950" cy="365" r="7" fill="#5EEAD4" filter="url(#cyanGlow)" />
  <circle cx="950" cy="505" r="5" fill="#38BDF8" />

  <g transform="translate(100, 140)">
    <g transform="translate(0, 0) scale(0.65)">
      <rect width="120" height="120" rx="30" fill="#111C22" stroke="#1E2F37" stroke-width="3" />
      <path d="M 24 38 Q 60 56 96 38" stroke="#334B57" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 24 58 Q 60 76 96 58" stroke="#415F6E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 24 78 Q 60 96 96 78" stroke="#334B57" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M 60 22 L 60 98" stroke="#2DD4BF" stroke-width="5" stroke-linecap="round"/>
      <circle cx="60" cy="76" r="6" fill="#5EEAD4" />
    </g>

    <text x="100" y="55" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="64" font-weight="700" fill="#F0FDF4" letter-spacing="-0.03em">Talweg</text>

    <text x="350" y="50" font-family="'SF Mono', Menlo, Consolas, monospace" 
          font-size="18" font-weight="500" fill="#64748B">/ˈtɑːlvɛɡ/</text>

    <text x="0" y="140" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="28" font-weight="500" fill="#94A3B8" letter-spacing="-0.01em">
      The natural path through complex thoughts.
    </text>

    <text x="0" y="185" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="20" font-weight="400" fill="#64748B">
      Local-first • Yjs CRDT • IndexedDB • Orthogonal A* Routing • Zero Telemetry
    </text>

    <g transform="translate(0, 230)">
      <rect x="0" y="0" width="130" height="36" rx="8" fill="#132127" stroke="#1D313A" stroke-width="1.5" />
      <text x="16" y="23" font-family="'SF Mono', Menlo, monospace" font-size="13" font-weight="600" fill="#2DD4BF">local-first</text>

      <rect x="142" y="0" width="130" height="36" rx="8" fill="#132127" stroke="#1D313A" stroke-width="1.5" />
      <text x="158" y="23" font-family="'SF Mono', Menlo, monospace" font-size="13" font-weight="600" fill="#38BDF8">open-source</text>

      <rect x="284" y="0" width="140" height="36" rx="8" fill="#132127" stroke="#1D313A" stroke-width="1.5" />
      <text x="300" y="23" font-family="'SF Mono', Menlo, monospace" font-size="13" font-weight="600" fill="#94A3B8">no-accounts</text>
    </g>
  </g>

  <line x1="0" y1="638" x2="1280" y2="638" stroke="#132026" stroke-width="2" />
  <line x1="880" y1="638" x2="1020" y2="638" stroke="#2DD4BF" stroke-width="3" />
</svg>
"""

    # 5. Light Mode Logo (Warm paper background)
    v1_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" fill="none">
  <defs>
    <linearGradient id="streamGradL" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0D9488" stop-opacity="0.5" />
      <stop offset="50%" stop-color="#0F766E" stop-opacity="1" />
      <stop offset="100%" stop-color="#0369A1" stop-opacity="1" />
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" rx="220" fill="#F4F0E8" />
  <circle cx="512" cy="512" r="480" stroke="#E2DAC9" stroke-width="2" stroke-dasharray="8 12" />

  <path d="M 220 290 Q 512 410 804 290" stroke="#D1C7B2" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M 190 410 Q 360 480 470 510 L 512 525 L 554 510 Q 664 480 834 410" stroke="#C0B49B" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 170 550 Q 340 630 460 670 L 512 690 L 564 670 Q 684 630 854 550" stroke="#AFA083" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 160 700 Q 330 790 450 835 L 512 860 L 574 835 Q 694 790 864 700" stroke="#9A8968" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <path d="M 512 180 L 512 860" stroke="#0F766E" stroke-width="20" opacity="0.12" />
  <path d="M 512 180 L 512 860" stroke="url(#streamGradL)" stroke-width="10" stroke-linecap="round" />

  <circle cx="512" cy="350" r="8" fill="#F4F0E8" stroke="#0F766E" stroke-width="4" />
  <circle cx="512" cy="525" r="10" fill="#F4F0E8" stroke="#0F766E" stroke-width="5" />
  <circle cx="512" cy="690" r="12" fill="#F4F0E8" stroke="#0D9488" stroke-width="6" />
  
  <circle cx="512" cy="860" r="22" fill="#0F766E" />
  <circle cx="512" cy="860" r="12" fill="#F4F0E8" stroke="#0F766E" stroke-width="4" />
</svg>
"""

    files = {
        "logo_topography.svg": v1_dark,
        "logo_topography_transparent.svg": v1_transparent,
        "logo_topography_light.svg": v1_light,
        "logo_monogram.svg": v2_dark,
        "github_social_preview.svg": sp_card,
    }

    for name, content in files.items():
        with open(os.path.join(output_dir, name), "w") as f:
            f.write(content)

    print("All SVGs created successfully.")

if __name__ == "__main__":
    create_all_assets()
