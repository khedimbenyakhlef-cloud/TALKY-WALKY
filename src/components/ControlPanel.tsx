import React, { useState } from "react";
import { Channel, CHANNELS_LIST } from "../types";
import { Sliders, ShieldCheck, ShieldAlert, MapPin, Radio, Wifi, HelpCircle, UserCheck, Activity } from "lucide-react";
import { playKeyClick, playCalibrationTone } from "../utils/audio";

interface ControlPanelProps {
  onChannelSelect: (channel: Channel) => void;
  activeChannelId: string;
  encryptActive: boolean;
  onToggleEncrypt: () => void;
  squelchLevel: number;
  onSquelchChange: (v: number) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  sosBeacon: boolean;
  onToggleSos: () => void;
  scrambleLevel: number;
  onScrambleChange: (v: number) => void;
  activeVoiceName: string;
  onVoiceNameSelect: (voice: string) => void;
}

export default function ControlPanel({
  onChannelSelect,
  activeChannelId,
  encryptActive,
  onToggleEncrypt,
  squelchLevel,
  onSquelchChange,
  volume,
  onVolumeChange,
  sosBeacon,
  onToggleSos,
  scrambleLevel,
  onScrambleChange,
  activeVoiceName,
  onVoiceNameSelect,
}: ControlPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [scrambleOn, setScrambleOn] = useState(false);

  // Live GPS details
  const [coords, setCoords] = React.useState<{ lat: string; lon: string; accuracy: number | null; error: boolean }>({
    lat: "Recherche GPS...",
    lon: "",
    accuracy: null,
    error: false
  });

  React.useEffect(() => {
    let watchId: number | null = null;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const latVal = position.coords.latitude;
          const lonVal = position.coords.longitude;
          const accVal = position.coords.accuracy;
          setCoords({
            lat: `${latVal.toFixed(5)}° ${latVal >= 0 ? "N" : "S"}`,
            lon: `${lonVal.toFixed(5)}° ${lonVal >= 0 ? "E" : "W"}`,
            accuracy: accVal,
            error: false
          });
        },
        (err) => {
          console.warn("GPS watch position denied or failed:", err);
          setCoords({
            lat: "Position non autorisée",
            lon: "",
            accuracy: null,
            error: true
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setCoords({
        lat: "Position non supportée",
        lon: "",
        accuracy: null,
        error: true
      });
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return (
    <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-900 shadow-xl text-white flex flex-col gap-4 font-mono">
      {/* Device Info Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">Tactical Control Deck</span>
        </div>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <div className="bg-[#0e170e] border border-emerald-900/40 p-3 rounded-2xl text-[11px] text-emerald-450 leading-relaxed">
          <p className="font-bold text-emerald-400 mb-1">MOTO-SAT SATELLITE OPERATIONS</p>
          <p>This transceiver bridges terrestrial VHF/UHF with L-Band orbital networks. Use the compass on the left to align with our satellites. Link strength depends on directional accuracy. Press and hold your keyboard SPACE BAR or the PTT click mechanism to transmit encrypted packages.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Frequency/Channel selectors */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-zinc-400" /> Secure Transceiver Bands
          </div>
          <div className="flex flex-col gap-1.5 max-h-[195px] overflow-y-auto pr-1">
            {CHANNELS_LIST.map((chan) => {
              const matches = chan.id === activeChannelId;
              return (
                <button
                  key={chan.id}
                  onClick={() => {
                    playKeyClick();
                    onChannelSelect(chan);
                  }}
                  className={`p-2 rounded-xl text-left border text-xs transition-all flex items-center justify-between cursor-pointer ${
                    matches
                      ? "bg-emerald-950/20 text-emerald-300 border-emerald-900/60 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                      : "bg-zinc-900/40 text-zinc-405 border-zinc-900 hover:border-zinc-800 hover:text-zinc-250"
                  }`}
                >
                  <div>
                    <div className="font-bold">{chan.name}</div>
                    <div className="text-[10px] text-zinc-650 truncate max-w-[130px]">{chan.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-emerald-400">{chan.frequency}</div>
                    {chan.isEncrypted && (
                      <span className="text-[8px] px-1 bg-emerald-950 border border-emerald-900 text-emerald-400 font-bold uppercase rounded pr-1 mt-0.5 inline-block">SEC</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Signal settings, crypto, modifiers */}
        <div className="flex flex-col gap-3">
          <div className="text-[10px] text-zinc-500 uppercase font-semibold">
            Signal Modifiers
          </div>

          {/* Squelch and Volume sliders */}
          <div className="flex flex-col gap-2.5 bg-zinc-900/40 p-3 rounded-2xl border border-zinc-900">
            {/* Squelch Control */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-400">Squelch Threshold</span>
                <span className="text-emerald-400 font-bold">{squelchLevel} dB</span>
              </div>
              <input 
                type="range"
                min="0"
                max="10"
                value={squelchLevel}
                onChange={(e) => {
                  onSquelchChange(parseInt(e.target.value));
                }}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Volume Control */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-400">Receiver Output Gain</span>
                <span className="text-emerald-400 font-bold">{Math.round(volume * 100)}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={(e) => {
                  onVolumeChange(parseFloat(e.target.value) / 100);
                }}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Scrambler / Vocoder & Active Crypto */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                playKeyClick();
                onToggleEncrypt();
              }}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                encryptActive
                  ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/80"
                  : "bg-red-950/20 text-red-500 border-red-900/50"
              }`}
            >
              {encryptActive ? (
                <>
                  <ShieldCheck className="w-5 h-5 mb-1 text-emerald-400" />
                  <span className="text-[10px] font-bold">CRYPTO ON</span>
                  <span className="text-[8px] text-emerald-600 block">AES-256 ENCR</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-5 h-5 mb-1 text-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold">CLEAR PATH</span>
                  <span className="text-[8px] text-red-700 block">UNPROTECTED</span>
                </>
              )}
            </button>

            {/* Voice scrambler dial / slider */}
            <div className="bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-900 flex flex-col justify-between">
              <div className="flex justify-between text-[9px] text-zinc-550">
                <span>SCRAMBLER</span>
                <span className={scrambleLevel > 0 ? "text-emerald-400 font-bold" : ""}>
                  {scrambleLevel > 0 ? `L-${scrambleLevel}` : "OFF"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <input 
                  type="range"
                  min="0"
                  max="5"
                  value={scrambleLevel}
                  onChange={(e) => onScrambleChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <span className="text-[8px] text-zinc-650 text-center mt-1">Analog Inversion Codec</span>
            </div>
          </div>

          {/* Beacon SOS / GPS summary */}
          <div className="bg-zinc-900/40 p-2.5 rounded-2xl border border-zinc-900 flex flex-col md:flex-row md:items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <MapPin className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
              <div className="flex flex-col">
                <span>
                  GCS TRK: {coords.lat} {coords.lon ? `| ${coords.lon}` : ""}
                </span>
                {coords.accuracy !== null && (
                  <span className="text-[9px] text-emerald-500 font-bold">
                    Précision: ±{Math.round(coords.accuracy)}m (Sat-Lock GPS)
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                playKeyClick();
                onToggleSos();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                sosBeacon
                  ? "bg-rose-950 text-rose-400 border-rose-800 animate-pulse"
                  : "bg-zinc-800/80 text-zinc-405 border-zinc-800 hover:text-zinc-300"
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>SOS BEACON</span>
            </button>
          </div>
        </div>
      </div>

      {/* NEW FEATURE SECTIONS: Virtual Satellite identities & Audio Frequency calibration */}
      <div className="border-t border-zinc-900 pt-3 mt-1 flex flex-col gap-3">
        {/* Virtual Satellite identities section */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Satellite Responder Voice Personality
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { key: "Fenrir", name: "FENRIR", desc: "Military Cdr", voice: "Fenrir" },
              { key: "Kore", name: "KORE", desc: "HF Dispatch", voice: "Kore" },
              { key: "Zephyr", name: "ZEPHYR", desc: "Comms System", voice: "Zephyr" },
              { key: "Charon", name: "CHARON", desc: "Deep Relay", voice: "Charon" }
            ].map((id) => {
              const selected = activeVoiceName === id.voice;
              return (
                <button
                  key={id.key}
                  onClick={() => {
                    playKeyClick();
                    onVoiceNameSelect(id.voice);
                  }}
                  className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    selected
                      ? "bg-emerald-950/25 text-emerald-300 border-emerald-900/50 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                      : "bg-zinc-900/40 text-zinc-400 border-zinc-900 hover:border-zinc-805"
                  }`}
                >
                  <div className="text-[10px] font-black tracking-wide leading-none">{id.name}</div>
                  <div className="text-[8px] text-zinc-500 mt-0.5">{id.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic sub-carrier frequency calibration tone test */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Sub-carrier Speaker Calibration Check
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { hz: 1000, label: "CARRIER LOCK", color: "text-rose-400" },
              { hz: 600, label: "SQUELCH TAIL", color: "text-amber-400" },
              { hz: 300, label: "VHF PILOT", color: "text-sky-400" },
            ].map((tone) => (
              <button
                key={tone.hz}
                onClick={() => {
                  playCalibrationTone(tone.hz, 0.45);
                }}
                className="bg-zinc-900/50 hover:bg-zinc-800/60 border border-zinc-900 hover:border-zinc-800 p-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer"
                title={`Inject a diagnostic sound tone of ${tone.hz}Hz to verify walkie-talkie speaker circuitry`}
              >
                <span className="text-[10px] font-bold text-white font-mono">{tone.hz} Hz</span>
                <span className="text-[7px] text-zinc-555 uppercase tracking-normal font-sans mt-0.5 leading-none">{tone.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
