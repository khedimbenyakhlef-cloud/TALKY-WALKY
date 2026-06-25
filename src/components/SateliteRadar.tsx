import React, { useState, useEffect, useRef } from "react";
import { Satellite } from "../types";
import { Radar, Shield, Zap, AlertTriangle, Compass } from "lucide-react";
import { playKeyClick } from "../utils/audio";

interface SateliteRadarProps {
  satellites: Satellite[];
  activeSatId: string;
  onSelectSat: (id: string) => void;
  alignmentAngle: number; // Current orientation / direction angle
  onAdjustAlignment: (angle: number) => void;
  linkStrength: number; // 0 to 100 calculated based on alignment
}

export default function SateliteRadar({
  satellites,
  activeSatId,
  onSelectSat,
  alignmentAngle,
  onAdjustAlignment,
  linkStrength
}: SateliteRadarProps) {
  const [rotating, setRotating] = useState(0);
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [compassAvailable, setCompassAvailable] = useState(true);

  // Auto rotating radar sweep visual effect
  useEffect(() => {
    let animId: any;
    const tick = () => {
      setRotating((prev) => (prev + 1.2) % 360);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Listen to Device Orientation Compass
  useEffect(() => {
    if (!isCompassActive) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let heading = event.alpha;
      
      // Handle safari iOS webkit compass heading
      if ((event as any).webkitCompassHeading !== undefined) {
        heading = (event as any).webkitCompassHeading;
      }

      if (heading !== null && heading !== undefined) {
        onAdjustAlignment(Math.round(heading));
      }
    };

    if ("ondeviceorientationabsolute" in window) {
      (window as any).addEventListener("deviceorientationabsolute", handleOrientation);
    } else {
      (window as any).addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      if ("ondeviceorientationabsolute" in window) {
        (window as any).removeEventListener("deviceorientationabsolute", handleOrientation);
      } else {
        (window as any).removeEventListener("deviceorientation", handleOrientation);
      }
    };
  }, [isCompassActive, onAdjustAlignment]);

  const toggleCompassSensor = async () => {
    playKeyClick();

    // Check iOS safari permission flow
    const reqPermission = (DeviceOrientationEvent as any).requestPermission;
    if (typeof reqPermission === "function") {
      try {
        const response = await reqPermission();
        if (response === "granted") {
          setIsCompassActive(true);
        } else {
          alert("Compass sensor access denied. Falling back to simulated manual alignment.");
          setCompassAvailable(false);
        }
      } catch (err) {
        console.warn("Compass permission error:", err);
        setCompassAvailable(false);
      }
    } else {
      // Chrome Android and standard PC browser
      setIsCompassActive(!isCompassActive);
    }
  };

  const selectedSat = satellites.find(s => s.id === activeSatId) || satellites[0];

  // Each satellite will have an orbital angle on our radar map
  const getSatelliteAngle = (id: string): number => {
    switch (id) {
      case "thuraya-2": return 44;
      case "thuraya-3": return 135;
      case "iridium-12": return 280;
      case "thor-relay-x": return 330;
      default: return 90;
    }
  };

  const activeSatAngle = getSatelliteAngle(activeSatId);

  const handleDragCompass = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    // Calculate angle in degrees (0 to 360) where 0 is up
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI + 90;
    if (angleDeg < 0) angleDeg += 360;
    
    onAdjustAlignment(Math.round(angleDeg));
  };

  return (
    <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-900 shadow-xl flex flex-col gap-4 text-white">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-emerald-400 animate-pulse" />
          <span className="font-mono text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Thuraya Link Align
          </span>
        </div>
        <div className="font-mono text-[10px] text-zinc-500">
          GRID COMPASS COHERENCE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Radar Circular Calibration Screen */}
        <div className="flex flex-col items-center">
          <div 
            className="relative w-48 h-48 bg-emerald-950/20 rounded-full border border-emerald-900/40 flex items-center justify-center cursor-pointer select-none"
            onMouseMove={(e) => {
              if (e.buttons === 1) handleDragCompass(e);
            }}
            onTouchMove={handleDragCompass}
            onClick={handleDragCompass}
          >
            {/* Compass Rings */}
            <div className="absolute inset-2 rounded-full border border-emerald-900/30"></div>
            <div className="absolute inset-8 rounded-full border border-emerald-900/20"></div>
            <div className="absolute inset-16 rounded-full border border-emerald-900/20"></div>
            
            {/* Target Crosshairs */}
            <div className="absolute w-full h-px bg-emerald-950"></div>
            <div className="absolute h-full w-px bg-emerald-950"></div>
            
            {/* Spinning Sweep Line */}
            <div 
              className="absolute inset-0 origin-center pointer-events-none"
              style={{ transform: `rotate(${rotating}deg)` }}
            >
              <div className="w-1/2 h-full border-r border-emerald-500/20 bg-gradient-to-l from-emerald-500/5 to-transparent origin-right transform rotate-90 scale-x-[-1]"></div>
            </div>

            {/* Render Satellites as points */}
            {satellites.map((sat) => {
              const angle = getSatelliteAngle(sat.id);
              // convert angle 0 (up) to standard math angle
              const mathAngle = (angle - 90) * Math.PI / 180;
              const radius = 68; // orbit radius
              const x = Math.cos(mathAngle) * radius;
              const y = Math.sin(mathAngle) * radius;
              const isActive = sat.id === activeSatId;

              return (
                <button
                  key={sat.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    playKeyClick();
                    onSelectSat(sat.id);
                  }}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all focus:outline-none ${
                    isActive 
                      ? "bg-emerald-500 text-black scale-125 z-10 shadow-[0_0_12px_rgba(16,185,129,0.8)]" 
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:scale-110"
                  }`}
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`
                  }}
                  title={sat.name}
                >
                  <Compass className="w-3.5 h-3.5" />
                </button>
              );
            })}

            {/* Hand-alignment Arrow indicator (The user rotates this) */}
            <div 
              className="absolute inset-0 pointer-events-none transition-transform duration-100"
              style={{ transform: `rotate(${alignmentAngle}deg)` }}
            >
              {/* Arrow pointer targeting outwards */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-3 h-6 flex flex-col items-center">
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-sky-400"></div>
                <div className="w-1.5 h-full bg-sky-400/80"></div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center font-mono text-[11px] text-zinc-400">
            Drag Compass area to aim physical L-band LNB at Satellite
          </div>
          {compassAvailable && (
            <button
              onClick={toggleCompassSensor}
              className={`mt-2.5 py-1.5 px-3 rounded-xl text-[10px] font-bold tracking-wider uppercase border cursor-pointer select-none transition-all flex items-center justify-center gap-1.5 w-full max-w-[180px] ${
                isCompassActive
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.25)] animate-pulse"
                  : "bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${isCompassActive ? "animate-spin" : ""}`} />
              <span>{isCompassActive ? "Sensor: LIVE ON" : "Bind Real IMU"}</span>
            </button>
          )}
        </div>

        {/* Alignment Information Dashboard */}
        <div className="flex flex-col gap-3 font-mono">
          <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900">
            <div className="text-[10px] text-zinc-550 uppercase font-bold">Selected transponder</div>
            <div className="text-sm font-semibold text-white mt-1 flex items-center justify-between">
              <span>{selectedSat.name}</span>
              <span className="text-xs text-emerald-400 bg-[#0e170e] px-1.5 py-0.5 rounded border border-emerald-900/30">
                {selectedSat.orbitType}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-3 text-xs border-t border-zinc-900 pt-2">
              <div>
                <span className="text-zinc-550">Longitude / Alt:</span>
                <span className="text-zinc-350 block">
                  {selectedSat.lon ? `${selectedSat.lon.toFixed(2)}° Est` : selectedSat.alt}
                </span>
              </div>
              <div>
                <span className="text-zinc-550">Signal Power:</span>
                <span className="text-zinc-350 block">{selectedSat.power}</span>
              </div>
              <div>
                <span className="text-zinc-550">Orbit Inclination:</span>
                <span className="text-zinc-350 block">{selectedSat.inclination ? `${selectedSat.inclination.toFixed(2)}°` : "N/A"}</span>
              </div>
              <div>
                <span className="text-zinc-550">Mean Motion:</span>
                <span className="text-zinc-350 block">{selectedSat.meanMotion ? `${selectedSat.meanMotion} rev/day` : "N/A"}</span>
              </div>
            </div>

            {selectedSat.isLiveCelesTrak && (
              <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-center justify-between text-[9px]">
                <span className="text-emerald-400 font-bold tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  CELESTRAK LIVE TLE COHERENCE
                </span>
                <span className="text-zinc-500 font-mono">Epoch: {selectedSat.epoch}</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 mt-2.5 text-xs border-t border-zinc-900/60 pt-2">
              <div>
                <span className="text-zinc-550">Target Angle:</span>
                <span className="text-emerald-400 block">{activeSatAngle}° North</span>
              </div>
              <div>
                <span className="text-zinc-550">Antenna Azimuth:</span>
                <span className="text-emerald-400 block">{alignmentAngle}°</span>
              </div>
            </div>
          </div>

          {/* Alignment Lock indicator */}
          <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-zinc-500 uppercase">Coherence quality</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                linkStrength > 85 
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                  : linkStrength > 40
                  ? "bg-yellow-950 text-yellow-400 border border-yellow-900"
                  : "bg-red-950 text-red-400 border border-red-900 animate-pulse"
              }`}>
                {linkStrength > 85 ? "LINK LOCKED" : linkStrength > 40 ? "WARNING: SEVERE ATTENUATION" : "CARRIER LOST"}
              </span>
            </div>

            {/* Link Strength Meter */}
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-200 ${
                  linkStrength > 85 ? "bg-emerald-500" : linkStrength > 40 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${linkStrength}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] mt-1 text-zinc-500">
              <span>90° Out-of-Phase</span>
              <span className="text-zinc-300 font-bold">{linkStrength}%</span>
              <span>Perfect Coherence</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
