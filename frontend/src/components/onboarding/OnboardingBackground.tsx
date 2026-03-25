"use client"

interface OnboardingBackgroundProps {
    currentStep: number
    totalSteps: number
}

export default function OnboardingBackground({ currentStep, totalSteps }: OnboardingBackgroundProps) {
    // Calculate progress (0 at step 1, 100 at final step)
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100

    // We want to simulate RISING UP:
    // - City should move DOWN (fall below us) 
    // - Clouds should come into view from above
    //
    // Scene layout:
    // - BOTTOM of scene: City (starting point)
    // - TOP of scene: Clouds (destination)
    //
    // Scene is positioned so city is initially visible
    // As progress increases, scene moves DOWN (positive translateY)
    // This pushes city below viewport and reveals clouds from above
    const translateY = progress * 0.6 // Moves DOWN

    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Sky gradient */}
            <div
                className="absolute inset-0 transition-all duration-1000 ease-out"
                style={{
                    background: progress < 30
                        ? 'linear-gradient(to top, rgb(241, 245, 249) 0%, rgb(224, 242, 254) 50%, rgb(186, 230, 253) 100%)'
                        : progress < 60
                            ? 'linear-gradient(to top, rgb(224, 242, 254) 0%, rgb(186, 230, 253) 50%, rgb(125, 211, 252) 100%)'
                            : 'linear-gradient(to top, rgb(186, 230, 253) 0%, rgb(125, 211, 252) 50%, rgb(56, 189, 248) 100%)'
                }}
            />

            {/* Scene container - starts showing bottom (city), shifts DOWN to reveal top (clouds) */}
            <div
                className="absolute w-full transition-transform duration-1000 ease-out"
                style={{
                    height: '250%',
                    top: '-150%', // Position so bottom of scene aligns with viewport bottom initially
                    transform: `translateY(${translateY}%)`
                }}
            >
                {/* === CLOUDS - DENSE AT TOP, SPARSE AT BOTTOM === */}
                <div className="absolute w-full" style={{ top: '0', height: '40%' }}>

                    {/* ===== TOP SECTION (0-30%) - VERY DENSE, FULL COVER ===== */}

                    {/* Layer 1 - Massive base clouds covering entire top */}
                    <svg className="absolute" style={{ left: '-10%', top: '-5%' }} width="500" height="250" viewBox="0 0 500 250">
                        <ellipse cx="130" cy="130" rx="130" ry="100" fill="white" />
                        <ellipse cx="260" cy="110" rx="150" ry="110" fill="white" />
                        <ellipse cx="420" cy="125" rx="120" ry="90" fill="white" />
                    </svg>

                    <svg className="absolute" style={{ right: '-10%', top: '-8%' }} width="480" height="240" viewBox="0 0 480 240">
                        <ellipse cx="120" cy="125" rx="120" ry="95" fill="white" />
                        <ellipse cx="250" cy="105" rx="140" ry="105" fill="white" />
                        <ellipse cx="400" cy="120" rx="110" ry="85" fill="white" />
                    </svg>

                    <svg className="absolute" style={{ left: '15%', top: '0%' }} width="450" height="220" viewBox="0 0 450 220">
                        <ellipse cx="110" cy="115" rx="110" ry="85" fill="white" />
                        <ellipse cx="230" cy="100" rx="130" ry="95" fill="white" />
                        <ellipse cx="370" cy="110" rx="100" ry="75" fill="white" />
                    </svg>

                    {/* Layer 2 - Fill all gaps at top */}
                    <svg className="absolute" style={{ left: '0%', top: '5%' }} width="400" height="200" viewBox="0 0 400 200">
                        <ellipse cx="100" cy="105" rx="100" ry="75" fill="white" />
                        <ellipse cx="210" cy="90" rx="115" ry="85" fill="white" />
                        <ellipse cx="330" cy="100" rx="90" ry="68" fill="white" />
                    </svg>

                    <svg className="absolute" style={{ right: '0%', top: '8%' }} width="380" height="190" viewBox="0 0 380 190">
                        <ellipse cx="95" cy="100" rx="95" ry="70" fill="white" />
                        <ellipse cx="195" cy="85" rx="108" ry="80" fill="white" />
                        <ellipse cx="310" cy="95" rx="85" ry="65" fill="white" />
                    </svg>

                    <svg className="absolute" style={{ left: '30%', top: '3%' }} width="350" height="180" viewBox="0 0 350 180">
                        <ellipse cx="85" cy="95" rx="85" ry="65" fill="white" />
                        <ellipse cx="180" cy="80" rx="100" ry="75" fill="white" />
                        <ellipse cx="285" cy="90" rx="75" ry="58" fill="white" />
                    </svg>

                    {/* Layer 3 - Extra density for solid white top */}
                    <svg className="absolute" style={{ left: '5%', top: '15%' }} width="320" height="160" viewBox="0 0 320 160">
                        <ellipse cx="80" cy="85" rx="80" ry="60" fill="white" />
                        <ellipse cx="165" cy="72" rx="92" ry="68" fill="white" />
                        <ellipse cx="260" cy="80" rx="70" ry="55" fill="white" />
                    </svg>

                    <svg className="absolute" style={{ right: '5%', top: '12%' }} width="300" height="150" viewBox="0 0 300 150">
                        <ellipse cx="75" cy="80" rx="75" ry="58" fill="white" />
                        <ellipse cx="155" cy="68" rx="85" ry="65" fill="white" />
                        <ellipse cx="245" cy="75" rx="65" ry="50" fill="white" />
                    </svg>

                    <svg className="absolute" style={{ left: '40%', top: '10%' }} width="280" height="140" viewBox="0 0 280 140">
                        <ellipse cx="70" cy="75" rx="70" ry="52" fill="white" />
                        <ellipse cx="145" cy="62" rx="80" ry="60" fill="white" />
                        <ellipse cx="225" cy="70" rx="60" ry="45" fill="white" />
                    </svg>

                    {/* ===== MIDDLE SECTION (30-60%) - MEDIUM DENSITY ===== */}

                    <svg className="absolute" style={{ left: '0%', top: '35%' }} width="250" height="120" viewBox="0 0 250 120">
                        <ellipse cx="60" cy="65" rx="58" ry="42" fill="white" opacity="0.9" />
                        <ellipse cx="130" cy="55" rx="70" ry="50" fill="white" opacity="0.95" />
                        <ellipse cx="200" cy="62" rx="52" ry="38" fill="white" opacity="0.9" />
                    </svg>

                    <svg className="absolute" style={{ right: '10%', top: '38%' }} width="220" height="110" viewBox="0 0 220 110">
                        <ellipse cx="55" cy="60" rx="52" ry="38" fill="white" opacity="0.88" />
                        <ellipse cx="115" cy="50" rx="65" ry="48" fill="white" opacity="0.92" />
                        <ellipse cx="180" cy="58" rx="45" ry="35" fill="white" opacity="0.88" />
                    </svg>

                    <svg className="absolute" style={{ left: '35%', top: '42%' }} width="200" height="100" viewBox="0 0 200 100">
                        <ellipse cx="50" cy="55" rx="48" ry="35" fill="white" opacity="0.85" />
                        <ellipse cx="105" cy="48" rx="58" ry="42" fill="white" opacity="0.9" />
                        <ellipse cx="165" cy="52" rx="42" ry="32" fill="white" opacity="0.85" />
                    </svg>

                    {/* ===== BOTTOM SECTION (60-100%) - SPARSE, SCATTERED ===== */}

                    <svg className="absolute" style={{ left: '8%', top: '65%' }} width="160" height="80" viewBox="0 0 160 80">
                        <ellipse cx="40" cy="45" rx="38" ry="28" fill="white" opacity="0.7" />
                        <ellipse cx="85" cy="38" rx="48" ry="35" fill="white" opacity="0.75" />
                        <ellipse cx="130" cy="42" rx="32" ry="25" fill="white" opacity="0.7" />
                    </svg>

                    <svg className="absolute" style={{ right: '20%', top: '72%' }} width="140" height="70" viewBox="0 0 140 70">
                        <ellipse cx="35" cy="40" rx="32" ry="24" fill="white" opacity="0.6" />
                        <ellipse cx="75" cy="35" rx="42" ry="30" fill="white" opacity="0.65" />
                        <ellipse cx="115" cy="38" rx="28" ry="22" fill="white" opacity="0.6" />
                    </svg>

                    <svg className="absolute" style={{ left: '50%', top: '80%' }} width="120" height="60" viewBox="0 0 120 60">
                        <ellipse cx="30" cy="35" rx="28" ry="20" fill="white" opacity="0.5" />
                        <ellipse cx="65" cy="30" rx="35" ry="25" fill="white" opacity="0.55" />
                        <ellipse cx="100" cy="33" rx="25" ry="18" fill="white" opacity="0.5" />
                    </svg>
                </div>

                {/* === SKY TRANSITION (Middle) === */}
                <div className="absolute w-full" style={{ top: '35%', height: '25%' }}>
                    <svg className="absolute" style={{ left: '10%', top: '30%' }} width="140" height="70" viewBox="0 0 140 70">
                        <ellipse cx="40" cy="40" rx="35" ry="22" fill="white" opacity="0.5" />
                        <ellipse cx="75" cy="35" rx="42" ry="28" fill="white" opacity="0.6" />
                        <ellipse cx="110" cy="40" rx="30" ry="20" fill="white" opacity="0.5" />
                    </svg>

                    <svg className="absolute" style={{ right: '15%', top: '50%' }} width="120" height="60" viewBox="0 0 120 60">
                        <ellipse cx="35" cy="35" rx="30" ry="18" fill="white" opacity="0.45" />
                        <ellipse cx="65" cy="30" rx="38" ry="24" fill="white" opacity="0.55" />
                        <ellipse cx="95" cy="35" rx="25" ry="16" fill="white" opacity="0.45" />
                    </svg>
                </div>

                {/* === CITY (BOTTOM of scene - starting point) === */}
                <div className="absolute w-full" style={{ top: '55%', height: '45%' }}>
                    <svg className="absolute bottom-0 w-full" style={{ height: '100%' }} viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax slice">
                        {/* Distant buildings */}
                        <g fill="rgb(148, 163, 184)" opacity="0.4">
                            <rect x="50" y="150" width="60" height="350" />
                            <rect x="130" y="190" width="50" height="310" />
                            <rect x="200" y="130" width="85" height="370" />
                            <rect x="310" y="170" width="55" height="330" />
                            <rect x="400" y="110" width="75" height="390" />
                            <rect x="500" y="180" width="50" height="320" />
                            <rect x="580" y="140" width="70" height="360" />
                            <rect x="680" y="160" width="80" height="340" />
                            <rect x="790" y="120" width="60" height="380" />
                            <rect x="880" y="150" width="55" height="350" />
                            <rect x="960" y="100" width="90" height="400" />
                            <rect x="1080" y="140" width="65" height="360" />
                        </g>

                        {/* Mid buildings */}
                        <g fill="rgb(100, 116, 139)" opacity="0.6">
                            <rect x="20" y="220" width="80" height="280" />
                            <rect x="120" y="260" width="65" height="240" />
                            <rect x="210" y="200" width="100" height="300" />
                            <rect x="340" y="240" width="70" height="260" />
                            <rect x="440" y="180" width="95" height="320" />
                            <rect x="570" y="270" width="60" height="230" />
                            <rect x="660" y="210" width="85" height="290" />
                            <rect x="780" y="250" width="75" height="250" />
                            <rect x="890" y="190" width="90" height="310" />
                            <rect x="1010" y="230" width="80" height="270" />
                            <rect x="1120" y="200" width="70" height="300" />
                        </g>

                        {/* Foreground buildings */}
                        <g fill="rgb(51, 65, 85)">
                            <rect x="0" y="280" width="110" height="220" />
                            <rect x="130" y="310" width="90" height="190" />
                            <rect x="240" y="250" width="130" height="250" />
                            <rect x="400" y="290" width="100" height="210" />
                            <rect x="530" y="230" width="120" height="270" />
                            <rect x="680" y="320" width="80" height="180" />
                            <rect x="790" y="270" width="110" height="230" />
                            <rect x="930" y="300" width="95" height="200" />
                            <rect x="1050" y="240" width="105" height="260" />
                        </g>

                        {/* Windows */}
                        <g fill="rgb(251, 191, 36)" opacity="0.9">
                            <rect x="15" y="300" width="18" height="22" />
                            <rect x="45" y="300" width="18" height="22" />
                            <rect x="75" y="300" width="18" height="22" />
                            <rect x="15" y="340" width="18" height="22" />
                            <rect x="45" y="340" width="18" height="22" />
                            <rect x="75" y="340" width="18" height="22" />
                            <rect x="15" y="380" width="18" height="22" />
                            <rect x="45" y="380" width="18" height="22" />
                            <rect x="75" y="380" width="18" height="22" />
                            <rect x="15" y="420" width="18" height="22" />
                            <rect x="45" y="420" width="18" height="22" />
                            <rect x="75" y="420" width="18" height="22" />

                            <rect x="260" y="270" width="20" height="25" />
                            <rect x="295" y="270" width="20" height="25" />
                            <rect x="330" y="270" width="20" height="25" />
                            <rect x="260" y="310" width="20" height="25" />
                            <rect x="295" y="310" width="20" height="25" />
                            <rect x="330" y="310" width="20" height="25" />
                            <rect x="260" y="350" width="20" height="25" />
                            <rect x="295" y="350" width="20" height="25" />
                            <rect x="330" y="350" width="20" height="25" />
                            <rect x="260" y="390" width="20" height="25" />
                            <rect x="295" y="390" width="20" height="25" />
                            <rect x="330" y="390" width="20" height="25" />
                            <rect x="260" y="430" width="20" height="25" />
                            <rect x="295" y="430" width="20" height="25" />
                            <rect x="330" y="430" width="20" height="25" />

                            <rect x="550" y="250" width="18" height="22" />
                            <rect x="580" y="250" width="18" height="22" />
                            <rect x="610" y="250" width="18" height="22" />
                            <rect x="550" y="290" width="18" height="22" />
                            <rect x="580" y="290" width="18" height="22" />
                            <rect x="610" y="290" width="18" height="22" />
                            <rect x="550" y="330" width="18" height="22" />
                            <rect x="580" y="330" width="18" height="22" />
                            <rect x="610" y="330" width="18" height="22" />
                            <rect x="550" y="370" width="18" height="22" />
                            <rect x="580" y="370" width="18" height="22" />
                            <rect x="610" y="370" width="18" height="22" />
                            <rect x="550" y="410" width="18" height="22" />
                            <rect x="580" y="410" width="18" height="22" />
                            <rect x="610" y="410" width="18" height="22" />
                            <rect x="550" y="450" width="18" height="22" />
                            <rect x="580" y="450" width="18" height="22" />
                            <rect x="610" y="450" width="18" height="22" />

                            <rect x="810" y="290" width="18" height="22" />
                            <rect x="845" y="290" width="18" height="22" />
                            <rect x="880" y="290" width="18" height="22" />
                            <rect x="810" y="330" width="18" height="22" />
                            <rect x="845" y="330" width="18" height="22" />
                            <rect x="880" y="330" width="18" height="22" />
                            <rect x="810" y="370" width="18" height="22" />
                            <rect x="845" y="370" width="18" height="22" />
                            <rect x="880" y="370" width="18" height="22" />
                            <rect x="810" y="410" width="18" height="22" />
                            <rect x="845" y="410" width="18" height="22" />
                            <rect x="880" y="410" width="18" height="22" />

                            <rect x="1070" y="260" width="18" height="22" />
                            <rect x="1105" y="260" width="18" height="22" />
                            <rect x="1070" y="300" width="18" height="22" />
                            <rect x="1105" y="300" width="18" height="22" />
                            <rect x="1070" y="340" width="18" height="22" />
                            <rect x="1105" y="340" width="18" height="22" />
                            <rect x="1070" y="380" width="18" height="22" />
                            <rect x="1105" y="380" width="18" height="22" />
                            <rect x="1070" y="420" width="18" height="22" />
                            <rect x="1105" y="420" width="18" height="22" />
                            <rect x="1070" y="460" width="18" height="22" />
                            <rect x="1105" y="460" width="18" height="22" />
                        </g>

                        {/* Street */}
                        <rect x="0" y="495" width="1200" height="10" fill="rgb(30, 41, 59)" />
                    </svg>
                </div>
            </div>
        </div>
    )
}
