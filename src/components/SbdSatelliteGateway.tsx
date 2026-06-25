import React, { useState, useEffect } from "react";
import { Server, Cpu, Database, Wifi, ShieldCheck, Zap, Send, Trash2, Layers } from "lucide-react";
import { playKeyClick, playScanBeep } from "../utils/audio";

interface SbdPacket {
  id: string;
  created_at?: string;
  timestamp?: string;
  payloadHex?: string;
  payload: string;
  sizeBytes?: number;
  status: "QUEUED" | "SIM_FORWARDED" | "TRANSMITTED" | "FAILED";
}

export default function SbdSatelliteGateway() {
  const [cpuTemp, setCpuTemp] = useState(41.4);
  const [constellation, setConstellation] = useState<"iridium" | "starlink" | "cell-4g">("iridium");
  const [codecConfig, setCodecConfig] = useState<"opus" | "codec2">("opus");
  const [sbdQueue, setSbdQueue] = useState<any[]>([]);
  const [rawText, setRawText] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isRealGateway, setIsRealGateway] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [forwardedCount, setForwardedCount] = useState(0);

  // Poll database status
  const fetchGatewayStats = async () => {
    try {
      const response = await fetch("/api/gateway/status");
      const resData = await response.json();
      if (resData.success && resData.data) {
        setCpuTemp(resData.data.cpuTemp);
        setQueuedCount(resData.data.queuedCount);
        setForwardedCount(resData.data.forwardedCount);
        setIsRealGateway(resData.mode === "real");
        
        // Map table schema back to UI packets representation
        if (resData.data.activeQueue) {
          const mapped = resData.data.activeQueue.map((aq: any) => {
            // derive timestamp or hex if missing
            const timeStr = aq.created_at ? new Date(aq.created_at).toLocaleTimeString() : new Date().toLocaleTimeString();
            let hex = "";
            for (let i = 0; i < aq.payload.length; i++) {
              hex += aq.payload.charCodeAt(i).toString(16).padStart(2, "0");
            }
            return {
              id: aq.id,
              timestamp: timeStr,
              payloadHex: hex,
              payloadText: aq.payload,
              sizeBytes: Math.ceil(hex.length / 2),
              status: aq.status
            };
          });
          setSbdQueue(mapped);
        }
      }
    } catch (err) {
      console.warn("Gateway stats fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchGatewayStats();
    const interval = setInterval(fetchGatewayStats, 3000);
    return () => clearInterval(interval);
  }, []);

  // Helper to convert text to Hex bytes
  const textToHex = (str: string): string => {
    let arr = [];
    for (let i = 0; i < str.length; i++) {
      arr.push(str.charCodeAt(i).toString(16).padStart(2, "0"));
    }
    return arr.join("");
  };

  const handleAddPacket = async () => {
    if (!rawText.trim()) return;
    playKeyClick();

    const hexPayload = textToHex(rawText);
    const byteLength = Math.ceil(hexPayload.length / 2);

    if (byteLength > 340) {
      alert("Iridium SBD protocol payload is strictly limited to 340 bytes maximum of packet telemetry!");
      return;
    }

    try {
      const response = await fetch("/api/gateway/sbd-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: rawText,
          priority: 1
        })
      });
      const data = await response.json();
      if (data.success) {
        setRawText("");
        fetchGatewayStats();
        playScanBeep();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`API Link Failure: ${err.message}`);
    }
  };

  const executeSbdUplinkTransmission = async () => {
    playScanBeep();
    setIsTransmitting(true);

    try {
      const response = await fetch("/api/gateway/sbd-transmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!data.success) {
        alert(`Gateway protocol transmission failure: ${data.error}`);
      }
    } catch (err: any) {
      console.error("Uplink error:", err);
    } finally {
      setIsTransmitting(false);
      fetchGatewayStats();
      playScanBeep();
    }
  };

  return (
    <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 shadow-2xl relative font-mono text-zinc-300 grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
      
      {/* LEFT COLUMN: Hardware Telemetry / Controller (Raspberry Pi 4 + Iridium SBD) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              L2 Gateway Controller
            </h2>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest border ${
            isRealGateway ? "bg-emerald-950 text-emerald-400 border-emerald-900" : "bg-zinc-900 text-zinc-550 border-zinc-850"
          }`}>
            {isRealGateway ? "LIVE SAT-SBD link" : "GATEWAY INTERFACE COGNITIVE"}
          </span>
        </div>

        {/* Pi Hardware Panel representation */}
        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute right-3 top-3 flex gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="flex h-2 w-2 relative">
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isTransmitting ? "bg-amber-500 animate-pulse" : "bg-zinc-650"}`}></span>
            </span>
          </div>

          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
            Hardware: Broadcom BCM2711 ARM | SQLite persistence logger active
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-900/80 pt-3">
            <div>
              <span className="text-zinc-550 block">Device SoC Core:</span>
              <span className="text-zinc-200">R-Pi 4 Cortex Broadcom</span>
            </div>
            <div>
              <span className="text-zinc-550 block">Core SoC Temp:</span>
              <span className={`font-semibold ${cpuTemp > 48 ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
                {cpuTemp}°C
              </span>
            </div>
            <div>
              <span className="text-zinc-550 block">SBD Serial Outpost:</span>
              <span className="text-emerald-400 truncate max-w-[150px] font-bold block">
                {isRealGateway ? "IRIDIUM_9603" : "SQLITE_SBD_GATE"}
              </span>
            </div>
            <div>
              <span className="text-zinc-550 block">Gateway state:</span>
              <span className={`font-bold ${isTransmitting ? "text-amber-400" : "text-emerald-400"}`}>
                {isTransmitting ? "TRANSMITTING..." : "BUFFER PERSISTENT"}
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-3">
            <span className="text-zinc-550 text-[10px] block uppercase font-bold mb-1.5">
              Uplink SBD Queue Metrics
            </span>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-900 text-[11px] flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>SQLite buffered packets count:</span>
                <span className="text-indigo-400">{queuedCount + forwardedCount} frames</span>
              </div>
              <div className="flex justify-between">
                <span>VHF LoRa Mesh telemetry:</span>
                <span className="text-emerald-500">SX1262 LoRa 868MHz</span>
              </div>
            </div>
          </div>
        </div>

        {/* Layer 3 Satellite Link Select (Bands & Codecs) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-900 text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">
            <Layers className="w-4 h-4 text-sky-400" />
            L3 Uplink Constellation & Codecs
          </div>

          {/* SBD / Link Connection Toggles */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
              Constellation Transport Stack
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { playKeyClick(); setConstellation("iridium"); }}
                className={`py-2 px-1.5 rounded-xl border text-center text-[10px] font-bold cursor-pointer transition-all ${
                  constellation === "iridium"
                    ? "bg-indigo-950 text-indigo-300 border-indigo-800 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                    : "bg-zinc-900 hover:bg-zinc-850 text-zinc-500 border-zinc-800"
                }`}
              >
                IRIDIUM NEXT (LEO)<br />
                <span className="text-[9px] opacity-60">2.4kbps Polar</span>
              </button>

              <button
                onClick={() => { playKeyClick(); setConstellation("starlink"); }}
                className={`py-2 px-1.5 rounded-xl border text-center text-[10px] font-bold cursor-pointer transition-all ${
                  constellation === "starlink"
                    ? "bg-sky-950 text-sky-300 border-sky-850 shadow-[0_0_8px_rgba(56,189,248,0.2)]"
                    : "bg-zinc-900 hover:bg-zinc-850 text-zinc-500 border-zinc-800"
                }`}
              >
                STARLINK TERMINAL<br />
                <span className="text-[9px] opacity-60">High Bandwidth</span>
              </button>

              <button
                onClick={() => { playKeyClick(); setConstellation("cell-4g"); }}
                className={`py-2 px-1.5 rounded-xl border text-center text-[10px] font-bold cursor-pointer transition-all ${
                  constellation === "cell-4g"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-850 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                    : "bg-zinc-900 hover:bg-zinc-850 text-zinc-500 border-zinc-800"
                }`}
              >
                GSM LTE FALLBACK<br />
                <span className="text-[9px] opacity-60">Cellular Tower</span>
              </button>
            </div>
          </div>

          {/* Voice compression specs */}
          <div className="flex flex-col gap-2 mt-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
              Voice Codec Bandwidth Configuration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { playKeyClick(); setCodecConfig("opus"); }}
                className={`py-2.5 px-3 rounded-xl border text-left text-xs font-bold cursor-pointer transition-all ${
                  codecConfig === "opus"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : "bg-zinc-900 hover:bg-zinc-850 text-zinc-500 border-zinc-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>OPUS CODEC</span>
                  <span className="text-[10px] opacity-80">RECOMMENDED</span>
                </div>
                <div className="text-[9px] font-normal text-zinc-400 mt-1">
                  6 kbps stream, wideband voice, requires Starlink / high S/N ratio.
                </div>
              </button>

              <button
                onClick={() => { playKeyClick(); setCodecConfig("codec2"); }}
                className={`py-2.5 px-3 rounded-xl border text-left text-xs font-bold cursor-pointer transition-all ${
                  codecConfig === "codec2"
                    ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
                    : "bg-zinc-900 hover:bg-zinc-850 text-zinc-500 border-zinc-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>CODEC2 VOC</span>
                  <span className="text-[9px] font-black bg-amber-900/60 px-1 py-0.2 rounded text-[8px]">MIL-GRID SPECIAL</span>
                </div>
                <div className="text-[9px] font-normal text-zinc-400 mt-1">
                  700 bps ultra-restricted, ideal for solar storm / direct Iridium SBD.
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: SBD FIFO Buffer Packer (Payload compositional, Store-and-forward queue) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Short Burst Data (SBD) FIFO Buffer
            </h2>
          </div>
          <span className="text-[9px] bg-zinc-900 text-zinc-500 border border-zinc-850 px-2 py-0.5 rounded font-black tracking-widest leading-none">
            MAX PAYLOAD: 340 BYTES
          </span>
        </div>

        {/* Add telemetry message form */}
        <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black flex justify-between">
              <span>Compose Custom Telemetry/Coordinate Report Payload</span>
              <span className={`text-[9px] ${rawText.length > 300 ? "text-rose-400" : "text-emerald-400"}`}>
                Length: {rawText.length} / 340 chars
              </span>
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex format: GPS TRACK: 44.5 E 23.3 N | STATUS HIGH SECURITY"
                value={rawText}
                onChange={(e) => setRawText(e.target.value.slice(0, 340))}
                className="bg-zinc-950 text-white placeholder-zinc-700 p-2.5 rounded-xl border border-zinc-850 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 outline-none flex-1 text-xs font-mono"
              />
              <button
                onClick={handleAddPacket}
                className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 uppercase shadow-lg shadow-indigo-500/10"
              >
                <span>Encoder Pack</span>
              </button>
            </div>
            <div className="text-[9px] text-zinc-500 leading-normal italic">
              *En appuyant sur "Encoder Pack", le texte sera envoyé et sauvegardé en base de données SQLite.
            </div>
          </div>
        </div>

        {/* Pending FIFO display table */}
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase px-1">
            <span>Uplink Packet Queue Stream ({sbdQueue.length} records)</span>
          </div>

          <div className="bg-zinc-950 rounded-2xl border border-zinc-900 max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-900 divide-y divide-zinc-900">
            {sbdQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-650 tracking-wider">
                QUEUE COMPLETELY CLEAR. NO SBD UPLINKS BUFFERED.
              </div>
            ) : (
              sbdQueue.map((packet: any) => (
                <div key={packet.id} className="p-3 hover:bg-zinc-900/40 transition-colors text-[11px] flex flex-col gap-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${packet.status.includes("QUEUED") ? "bg-amber-400 animate-pulse" : "bg-emerald-450"}`} />
                      {packet.id}
                    </span>
                    <span className="text-zinc-600 font-normal">{packet.timestamp}</span>
                  </div>

                  <div className="text-zinc-400 font-sans leading-tight mt-0.5">
                    {packet.payloadText}
                  </div>

                  <div className="bg-zinc-900/80 p-1 px-2 mt-1 rounded text-[9px] text-zinc-500 font-mono select-all truncate">
                    Hex binary: <span className="text-indigo-400/80">{packet.payloadHex}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 justify-between text-[9px] text-zinc-550 border-t border-zinc-900/80 pt-1">
                    <span>Frame Size: <strong className="text-zinc-400">{packet.sizeBytes} Bytes</strong> (L-Band Slot Size)</span>
                    <span className={`font-black ${packet.status.includes("QUEUED") ? "text-amber-400" : "text-emerald-500 animate-pulse"}`}>
                      {packet.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Trigger Transmission Block */}
          {sbdQueue.some((p: any) => p.status.includes("QUEUE")) && (
            <button
              onClick={executeSbdUplinkTransmission}
              disabled={isTransmitting}
              className={`w-full py-3 px-4 rounded-xl font-bold cursor-pointer transition-all border text-center flex items-center justify-center gap-1.5 uppercase text-xs ${
                isTransmitting
                  ? "bg-indigo-950 text-indigo-400 border-indigo-750 animate-pulse cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-750 to-[#4338ca] hover:from-indigo-700 hover:to-indigo-500 text-white border-indigo-800 shadow-[0_4px_15px_rgba(99,102,241,0.15)]"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {isTransmitting
                  ? "Envoi SBD par satellite Iridium NEXT en cours..."
                  : "Uplink SBD - Transmettre paquet(s) en attente sur orbite L-Band"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
