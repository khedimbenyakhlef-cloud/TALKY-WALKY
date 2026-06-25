import React, { useState, useEffect, useRef } from "react";
import { Compass, Signal, AlertOctagon, HelpCircle, RefreshCw, Radio, MapPin, Play, MessageSquare, Flame, CheckCircle, Smartphone } from "lucide-react";
import { playKeyClick, playScanBeep } from "../utils/audio";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface OperatorNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  frequency: string;
  isSelf?: boolean;
  status: "ACTIVE" | "EMERGENCY_SOS" | "MUTED";
}

interface NetworkTacticalMapProps {
  socket: any;
  activeChannel: { id: string; name: string; frequency: string };
}

export default function NetworkTacticalMap({ socket, activeChannel }: NetworkTacticalMapProps) {
  const [nodes, setNodes] = useState<OperatorNode[]>([]);
  const [gpsStatus, setGpsStatus] = useState<"ACQUIRING" | "LOCKED" | "DENIED" | "STANDBY">("STANDBY");
  const [myCoords, setMyCoords] = useState<{ lat: number; lon: number }>({ lat: 24.4539, lon: 54.3773 }); // Abu Dhabi fallback
  
  // Radar Sweep States
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepResults, setSweepResults] = useState<string[]>([]);
  const [sweepProgress, setSweepProgress] = useState(0);

  // Simulated & real Twilio SMS triggers
  const [smsTarget, setSmsTarget] = useState("+33 6 12 34 56 78");
  const [smsStatus, setSmsStatus] = useState<"IDLE" | "SENDING" | "DELIVERED" | "FAILED">("IDLE");
  const [isRealSmsMode, setIsRealSmsMode] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  // Dynamic status poll to check mode (LIVE vs SIM)
  useEffect(() => {
    fetch("/api/gateway/status")
      .then(res => res.json())
      .then(resData => {
        setIsRealSmsMode(resData.mode === "real");
      })
      .catch(() => setIsRealSmsMode(false));
  }, []);

  // Update starting nodes whenever GPS coords are set
  useEffect(() => {
    setNodes([
      { id: "self", name: "YOU (ALPHA-OPERATOR)", lat: myCoords.lat, lon: myCoords.lon, frequency: activeChannel.frequency, isSelf: true, status: "ACTIVE" },
      { id: "sim-1", name: "BASE-HQ (ABU DHABI OUTPOST - SIM)", lat: 24.4712, lon: 54.3980, frequency: "1.616 GHz", status: "ACTIVE" },
      { id: "sim-2", name: "FIELD-PATROL-GIBRALTAR (SIM)", lat: 36.1408, lon: -5.3536, frequency: "148.45 MHz", status: "MUTED" },
      { id: "sim-3", name: "RESCUE-UNIT-SVALBARD (SIM)", lat: 78.2232, lon: 15.6267, frequency: "1.626 GHz", status: "EMERGENCY_SOS" }
    ]);
  }, [myCoords, activeChannel]);

  // Leaflet initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Build the leaflet instance
    const map = L.map(mapContainerRef.current, {
      center: [myCoords.lat, myCoords.lon],
      zoom: 6,
      zoomControl: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap"
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Leaflet View and Map custom icons
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Invert zoom/pan view onto operator's coordinate
    map.setView([myCoords.lat, myCoords.lon], map.getZoom());

    // Clear old markers
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};

    // Place new tactical markers
    nodes.forEach((node) => {
      const iconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-4 h-4 rounded-full border-2 border-zinc-950 flex items-center justify-center ${
            node.isSelf 
              ? "bg-sky-400 ring-4 ring-sky-900/50 animate-pulse" 
              : node.status === "EMERGENCY_SOS"
              ? "bg-rose-600 ring-4 ring-rose-950 animate-bounce"
              : "bg-emerald-400"
          }"></div>
          <div class="absolute -bottom-6 font-mono text-[9px] font-black border border-zinc-900 bg-zinc-950 px-1 rounded text-zinc-300 pointer-events-none uppercase whitespace-nowrap opacity-90">
            ${node.name.split(" ")[0]}
          </div>
        </div>
      `;

      const divIcon = L.divIcon({
        html: iconHtml,
        className: "custom-leaflet-tactical-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([node.lat, node.lon], { icon: divIcon })
        .addTo(map)
        .bindPopup(`
          <div class="font-mono text-[11px] text-zinc-300 p-2 rounded bg-zinc-950 border border-zinc-800">
            <strong class="text-white block uppercase border-b border-zinc-900 pb-1 mb-1">${node.name}</strong>
            <span class="block">LATITUDE: ${node.lat.toFixed(4)}° N</span>
            <span class="block">LONGITUDE: ${node.lon.toFixed(4)}° E</span>
            <span class="block text-sky-400 mt-1">FREQUENCY: ${node.frequency}</span>
            <span class="block text-[9px] text-zinc-500 uppercase mt-0.5">${node.status} GATE</span>
          </div>
        `);

      markersRef.current[node.id] = marker;
    });

  }, [nodes, myCoords]);

  // Handle live socket operators map sync
  useEffect(() => {
    if (!socket) return;

    socket.on("nodes-update", (rawNodes: any[]) => {
      const activeList = rawNodes.map((rn) => ({
        id: rn.id,
        name: rn.name,
        lat: rn.lat,
        lon: rn.lon,
        isSelf: rn.id === socket.id,
        frequency: activeChannel.frequency,
        status: "ACTIVE" as const
      }));

      // Merge user fallback simulator nodes for realistic bento density
      setNodes((prev) => {
        const sims = prev.filter(n => n.id.startsWith("sim-"));
        return [
          ...activeList,
          ...sims
        ];
      });
    });

    socket.on("sos-packet", (packet: any) => {
      if (packet.enabled && packet.coords) {
        setNodes((prev) => {
          const exists = prev.some(n => n.id === packet.from);
          if (exists) {
            return prev.map(n => n.id === packet.from ? { ...n, status: "EMERGENCY_SOS", lat: packet.coords.lat, lon: packet.coords.lng } : n);
          } else {
            return [
              ...prev,
              {
                id: packet.from,
                name: packet.name,
                lat: packet.coords.lat,
                lon: packet.coords.lng,
                frequency: activeChannel.frequency,
                status: "EMERGENCY_SOS"
              }
            ];
          }
        });
      }
    });

    return () => {
      socket.off("nodes-update");
      socket.off("sos-packet");
    };
  }, [socket, activeChannel]);

  // Request browser geolocation with absolute precision
  const handleAcquireGPS = () => {
    playKeyClick();
    if (!navigator.geolocation) {
      setGpsStatus("DENIED");
      return;
    }

    setGpsStatus("ACQUIRING");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const lat = +latitude.toFixed(4);
        const lon = +longitude.toFixed(4);
        setMyCoords({ lat, lon });
        setGpsStatus("LOCKED");
        
        // Share to the connected socket cluster
        if (socket) {
          socket.emit("position-update", { lat, lon });
        }
        playScanBeep();
      },
      (error) => {
        console.warn("Geolocation denied, using mock", error.message);
        setGpsStatus("DENIED");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Spectrum sweeps API execution
  const runRadarSweepScan = () => {
    if (isSweeping) return;
    playScanBeep();
    setIsSweeping(true);
    setSweepProgress(0);
    setSweepResults([]);

    const interval = setInterval(() => {
      setSweepProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          finishRadarSweep();
          return 100;
        }
        return prev + 15;
      });
    }, 200);
  };

  const finishRadarSweep = async () => {
    setIsSweeping(false);
    playScanBeep();
    
    try {
      const response = await fetch("/api/scan/spectrum");
      const resData = await response.json();
      
      if (resData.success && resData.data.spectrum) {
        const metrics = resData.data.spectrum.map((spec: any) => {
          return `📡 CH: ${spec.channel} | ACTIVE OPERATORS: ${spec.users} | SIGNAL: ${spec.signalStrength}% SQUELCH MESH | STATUS: ${spec.lastActivity}`;
        });
        setSweepResults(metrics);
      } else {
        setSweepResults(["⚠️ DEC CRYPT INTEGRITY FAILED. BAND ATTENUATED."]);
      }
    } catch (err: any) {
      setSweepResults([`❌ API DEC CRYPT SCAN FAIL: ${err.message}`]);
    }
  };

  // Real Twilio API dispatcher
  const handleTriggerSmsDispatch = async () => {
    if (!smsTarget.trim()) return;
    playKeyClick();
    setSmsStatus("SENDING");

    const messageBody = `🚨 [MOTO-SAT EMERGENCY BEACON] Operator reports SOS distress! Channel: ${activeChannel.name}. Coords: Lat ${myCoords.lat}° N / Lon ${myCoords.lon}° E. RE-ORIENT CARRIER. OVER.`;

    try {
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: smsTarget,
          message: messageBody
        })
      });
      const data = await response.json();
      if (data.success) {
        setSmsStatus("DELIVERED");
        setIsRealSmsMode(data.mode === "real");
        playScanBeep();
      } else {
        setSmsStatus("FAILED");
      }
    } catch (err) {
      console.error(err);
      setSmsStatus("FAILED");
    }
  };

  return (
    <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 shadow-2xl font-mono text-zinc-300 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
      
      {/* LEFT PANEL: Interactive Leaflet map representation of user coordinates */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-400 animate-spin-slow" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              Network Operator Tactical Map
              <span className="px-1.5 py-0.5 bg-emerald-950 border border-emerald-900 text-emerald-400 font-extrabold text-[8px] rounded uppercase">
                Interactive OpenStreetMap
              </span>
            </h2>
          </div>
          <span className="text-[10px] text-zinc-550 font-bold uppercase shrink-0">
            Grid Scale: 120km
          </span>
        </div>

        {/* Leaflet container styled into high tech HUD */}
        <div className="relative aspect-square w-full rounded-2xl border border-zinc-900 overflow-hidden flex items-center justify-center bg-zinc-950 z-10">
          <div 
            ref={mapContainerRef} 
            className="w-full h-full rounded-2xl filter invert-[90%] hue-rotate-[180deg] saturate-[50%] brightness-[40%] contrast-[130%]"
          />

          {/* Sweep indicator overlay if isSweeping */}
          {isSweeping && (
            <div className="absolute inset-0 bg-[#061e12]/15 backdrop-blur-[0.5px] pointer-events-none flex flex-col items-center justify-center z-20">
              <span className="font-bold text-emerald-400 animate-pulse text-xs tracking-widest text-center bg-zinc-950/90 py-3 px-4 border border-emerald-900/60 rounded-xl max-w-xs uppercase leading-relaxed">
                ⚙️ ACTIVE MULTI-FREQUENCY SWEEP ({sweepProgress}%)<br />
                ACQUIRING COGNITIVE SPECTRUM RECORDS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Live GSM Twilio Gates & GPS Status checks */}
      <div className="lg:col-span-5 flex flex-col gap-4 z-10">
        
        {/* GPS Geolocation section */}
        <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-1.5 border-b border-zinc-900">
            <span className="font-extrabold text-[9px] uppercase">GÉOLOCALISATION CAPTOR</span>
            <span className={`text-[10px] font-bold ${gpsStatus === "LOCKED" ? "text-emerald-400" : "text-amber-500"}`}>
              {gpsStatus === "LOCKED" ? "GPS SIGNAL VERROUILLÉ" : gpsStatus === "ACQUIRING" ? "SYNCHRONISATION..." : "RÉSEAU PRÊT"}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-550 font-mono">My Active Latitude:</span>
              <span className="text-white font-bold font-mono">{myCoords.lat}° N</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-550 font-mono">My Active Longitude:</span>
              <span className="text-white font-bold font-mono">{myCoords.lon}° E</span>
            </div>
          </div>

          <button
            onClick={handleAcquireGPS}
            className="w-full py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 transition-colors cursor-pointer text-xs font-bold text-sky-400 font-mono flex items-center justify-center gap-1.5 uppercase"
          >
            <MapPin className="w-4 h-4 text-sky-450 animate-bounce" />
            <span>Synchroniser GPS Réel Navigateur</span>
          </button>
        </div>

        {/* Cognitive RF Radar Sweep */}
        <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-400" />
            Automated Spectrograph Scan Link
          </h3>
          
          <button
            onClick={runRadarSweepScan}
            disabled={isSweeping}
            className="w-full py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 text-white cursor-pointer border border-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 uppercase transition-all shadow-[0_4px_12px_rgba(99,102,241,0.15)]"
          >
            <Play className={`w-3.5 h-3.5 ${isSweeping ? "animate-spin" : ""}`} />
            <span>Spectrum Scan Tracker (Express API)</span>
          </button>

          {sweepResults.length > 0 && (
            <div className="border-t border-zinc-900 pt-2.5 flex flex-col gap-1.5 max-h-[140px] overflow-y-auto scrollbar-zinc pb-1">
              <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest">RF SCANNED FEED RECORDS:</span>
              {sweepResults.map((line, idx) => (
                <div key={idx} className="bg-zinc-950 p-2 rounded-lg border border-zinc-900 text-[10px] text-zinc-450 leading-normal flex items-start gap-1.5 animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* twilio sms card */}
        <div className="bg-[#12080a]/40 border border-rose-950/40 p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between text-rose-450 font-extrabold text-[10px] border-b border-rose-950/40 pb-1.5 uppercase">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
              Twilio SMS Dispatch Gate
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide border ${
              isRealSmsMode ? "bg-emerald-950 text-emerald-400 border-emerald-900" : "bg-zinc-900 text-zinc-500 border-zinc-850"
            }`}>
              {isRealSmsMode ? "TWILIO LIVE" : "SIMULATION GATE"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-zinc-550 uppercase tracking-widest font-black">
              Destinataire Alerte SMS Urgent (To) :
            </label>
            
            <div className="aria-disabled:pointer-events-none flex gap-2">
              <input
                type="text"
                value={smsTarget}
                onChange={(e) => setSmsTarget(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="bg-zinc-950 text-white p-2.5 rounded-xl text-xs border border-zinc-850 flex-1 outline-none font-mono"
              />
              <button
                onClick={handleTriggerSmsDispatch}
                disabled={smsStatus === "SENDING" || !smsTarget.trim()}
                className="bg-rose-700 hover:bg-rose-650 cursor-pointer text-white transition-colors duration-200 px-3.5 rounded-xl font-bold text-xs uppercase"
              >
                Send Alarm
              </button>
            </div>
          </div>

          {smsStatus !== "IDLE" && (
            <div className="text-[10px] bg-zinc-950 p-2.5 rounded-xl text-zinc-400 border border-zinc-900 flex items-center justify-between animate-fade-in">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
                Statut Twilio Gateway API :
              </span>
              <strong className={`font-mono text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                smsStatus === "DELIVERED" 
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-900/60" 
                  : smsStatus === "SENDING"
                  ? "bg-amber-950 text-amber-400 border-amber-900 animate-pulse"
                  : "bg-rose-950 text-rose-400 border-rose-900"
              }`}>
                {smsStatus === "SENDING" ? "DISPATCHING..." : smsStatus === "DELIVERED" ? "ALERTE SMS COMPLÉTÉE" : "ECHEC D'ENVOI"}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
