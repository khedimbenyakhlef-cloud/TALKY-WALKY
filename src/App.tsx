import React, { useState, useEffect, useRef } from "react";
import { Channel, CHANNELS_LIST, Satellite, TransmissionLog } from "./types";
import ManualTransceiver from "./components/ManualTransceiver";
import SateliteRadar from "./components/SateliteRadar";
import TransmissionLogs from "./components/TransmissionLogs";
import ControlPanel from "./components/ControlPanel";
import NetworkScanner from "./components/NetworkScanner";
import SbdSatelliteGateway from "./components/SbdSatelliteGateway";
import CloudAsteriskOps from "./components/CloudAsteriskOps";
import NetworkTacticalMap from "./components/NetworkTacticalMap";
import DZInternationalCommHub from "./components/DZInternationalCommHub";
import { 
  Radio, 
  Orbit, 
  Compass, 
  Rss, 
  HelpCircle, 
  Waves, 
  Cpu, 
  Globe,
  Server,
  ShieldCheck,
  Map,
  Wifi
} from "lucide-react";
import { io } from "socket.io-client";
import { playRadioMessage, playKeyClick, playMilitaryRadioTTS, getAudioContext } from "./utils/audio";
import { 
  initPeerConnection, 
  addLocalStream, 
  createOffer, 
  handleOffer, 
  handleAnswer, 
  handleIceCandidate 
} from "./utils/webrtc";

export default function App() {
  const [activeChannel, setActiveChannel] = useState<Channel>(CHANNELS_LIST[0]);
  const [encryptActive, setEncryptActive] = useState(true);
  const [activeSatId, setActiveSatId] = useState("thuraya-2");
  const [alignmentAngle, setAlignmentAngle] = useState(180); // Users manually point this
  const [squelchLevel, setSquelchLevel] = useState(3);
  const [volume, setVolume] = useState(0.8);
  const [sosBeacon, setSosBeacon] = useState(false);
  const [scrambleLevel, setScrambleLevel] = useState(0);
  const [logs, setLogs] = useState<TransmissionLog[]>([]);
  const [satelliteData, setSatelliteData] = useState<Satellite[]>([]);
  const [activeVoiceName, setActiveVoiceName] = useState("Fenrir");
  const [activeLayerTab, setActiveLayerTab] = useState<"handset" | "gateway" | "voip" | "map" | "dz-int">("handset");
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showSplash, setShowSplash] = useState(true);

  // Splash screen timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  // Monitor real-world PWA online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Socket.IO human-to-human Walkie-Talkie sync states
  const [socket, setSocket] = useState<any>(null);
  const [codename, setCodename] = useState<string>("");
  const [channelUsers, setChannelUsers] = useState<Array<{ userId: string; name: string }>>([]);

  // WebRTC P2P direct audio link references
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const peerAudioNodesRef = useRef<Record<string, any>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicAvailable, setIsMicAvailable] = useState(false);

  // Request voice microphone entry on start for instant P2P
  useEffect(() => {
    async function initMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsMicAvailable(true);
        console.log("WebRTC microphoned link initialized successfully.");
      } catch (err) {
        console.warn("User microphoned line rejected or unavailable:", err);
        setIsMicAvailable(false);
      }
    }
    initMic();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Determine Target Angle based on current selection
  const getSatelliteTargetAngle = (id: string): number => {
    switch (id) {
      case "thuraya-2": return 44;
      case "thuraya-3": return 135;
      case "iridium-12": return 280;
      case "thor-relay-x": return 330;
      default: return 90;
    }
  };

  // Calculate Link Strength based on how closely user's directional antenna aligned with the sat target
  const targetSatAngle = getSatelliteTargetAngle(activeSatId);
  const angleDiff = Math.abs(alignmentAngle - targetSatAngle);
  const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
  // Link strength is 100% when perfectly pointed, dropping to 10% (pure static block) if pointed completely backward
  const linkStrength = Math.max(10, Math.round(100 - normalizedDiff * 1.6));

  // Fetch updated orbital status on setup
  useEffect(() => {
    const fetchSats = async () => {
      try {
        const response = await fetch("/api/radio/status");
        if (response.ok) {
          const data = await response.json();
          setSatelliteData(data.satellites);
        }
      } catch (err) {
        // Fallback default satellite array if server is loading
        setSatelliteData([
          { id: "thuraya-2", name: "Thuraya-2 (GCC Direct)", status: "GEOSYNCHRONOUS", lon: 44.0, power: "98%", orbitType: "GEO" },
          { id: "thuraya-3", name: "Thuraya-3 (Asia-Pac)", status: "GEOSYNCHRONOUS", lon: 98.5, power: "95%", orbitType: "GEO" },
          { id: "iridium-12", name: "Iridium-12 (LEO Relay)", status: "LOW_EARTH_ORBIT", alt: "780km", power: "87%", orbitType: "LEO" },
          { id: "thor-relay-x", name: "Thoraya-X Tactical Relay", status: "MOLNIYA_ORBIT", alt: "39,000km", power: "100%", orbitType: "HEO" }
        ]);
      }
    };
    fetchSats();
  }, []);

  // Synchronously route remote peer stream to highpass and lowpass filters for that raw radio voice style!
  const routePeerAudioStream = (peerId: string, remoteStream: MediaStream, volumeVal: number) => {
    try {
      // 1. Keep silent/hidden audio element to bypass Chrome garbage collection
      let audioEl = document.getElementById(`webrtc-audio-${peerId}`) as HTMLAudioElement;
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = `webrtc-audio-${peerId}`;
        audioEl.autoplay = true;
        audioEl.style.display = "none";
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = remoteStream;
      audioEl.muted = false; // Directly unmuted for robust playback
      audioEl.volume = volumeVal;
      audioEl.play().catch(e => console.warn("Failed to autoplay audio:", e));

      // 2. Clear old nodes
      if (peerAudioNodesRef.current[peerId]) {
        try {
          peerAudioNodesRef.current[peerId].source.disconnect();
          peerAudioNodesRef.current[peerId].hpFilter.disconnect();
          peerAudioNodesRef.current[peerId].lpFilter.disconnect();
          peerAudioNodesRef.current[peerId].gainNode.disconnect();
        } catch (e) {}
        delete peerAudioNodesRef.current[peerId];
      }

      // 3. Setup context and custom radio filter chain
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(remoteStream);

      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.setValueAtTime(320, ctx.currentTime);

      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = "lowpass";
      lpFilter.frequency.setValueAtTime(3000, ctx.currentTime);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(volumeVal * 1.8, ctx.currentTime); // Crisp amplifications

      source.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(gainNode);
      gainNode.connect(ctx.destination);

      peerAudioNodesRef.current[peerId] = { source, hpFilter, lpFilter, gainNode };
      console.log(`Successfully routed active WebRTC audio link for peer: ${peerId}`);
    } catch (err) {
      console.warn(`Routing stream via Web Audio node errored, falling back directly to DOM audio playback for ${peerId}:`, err);
      let audioEl = document.getElementById(`webrtc-audio-${peerId}`) as HTMLAudioElement;
      if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = volumeVal;
      }
    }
  };

  // Keep volume controls synchronized dynamically across live peer lines
  useEffect(() => {
    Object.keys(peerAudioNodesRef.current).forEach((pId) => {
      const node = peerAudioNodesRef.current[pId];
      if (node && node.gainNode) {
        try {
          node.gainNode.gain.setValueAtTime(volume * 1.8, getAudioContext().currentTime);
        } catch (e) {}
      }
    });

    // Also update any raw fallback elements that aren't routed to Web Audio
    channelUsers.forEach((u) => {
      const audioEl = document.getElementById(`webrtc-audio-${u.userId}`) as HTMLAudioElement;
      if (audioEl && !audioEl.muted) {
        audioEl.volume = volume;
      }
    });
  }, [volume, channelUsers]);

  // Connect and manage Socket.IO operations and peer WebRTC links
  const startWebRtcWithPeer = async (s: any, peerId: string, isInitiator: boolean) => {
    if (!s) return;
    try {
      if (peerConnectionsRef.current[peerId]) {
        try {
          peerConnectionsRef.current[peerId].close();
        } catch (e) {}
      }

      const pc = initPeerConnection(s, peerId, (remoteStream) => {
        console.log("WebRTC P2P direct voice path established with unit:", peerId);
        routePeerAudioStream(peerId, remoteStream, volume);
      });

      peerConnectionsRef.current[peerId] = pc;

      // Add local microphone tracks to peer connection
      if (localStreamRef.current) {
        addLocalStream(pc, localStreamRef.current);
      } else {
        try {
          const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = freshStream;
          setLocalStream(freshStream);
          setIsMicAvailable(true);
          addLocalStream(pc, freshStream);
        } catch (e) {
          console.warn("Could not capture dynamic callback mic stream:", e);
        }
      }

      if (isInitiator) {
        console.log("WebRTC: Emitting connection proposal offer to unit", peerId);
        await createOffer(pc, s, peerId);
      }
    } catch (err) {
      console.warn("WebRTC startup failed with peer ID:", peerId, err);
    }
  };

  const closeWebRtcWithPeer = (peerId: string) => {
    if (peerConnectionsRef.current[peerId]) {
      try {
        peerConnectionsRef.current[peerId].close();
      } catch (e) {}
      delete peerConnectionsRef.current[peerId];
    }
    if (peerAudioNodesRef.current[peerId]) {
      try {
        peerAudioNodesRef.current[peerId].source.disconnect();
        peerAudioNodesRef.current[peerId].hpFilter.disconnect();
        peerAudioNodesRef.current[peerId].lpFilter.disconnect();
        peerAudioNodesRef.current[peerId].gainNode.disconnect();
      } catch (e) {}
      delete peerAudioNodesRef.current[peerId];
    }
    const audioEl = document.getElementById(`webrtc-audio-${peerId}`);
    if (audioEl) {
      audioEl.remove();
    }
  };

  useEffect(() => {
    const s = io(window.location.origin);
    setSocket(s);

    s.on("identity", (data: { userId: string; codename: string }) => {
      setCodename(data.codename);
    });

    s.on("channel-users", (users: Array<{ userId: string; name: string }>) => {
      setChannelUsers(users);
      // Initiate WebRTC pairing for existing channel users
      users.forEach((u) => {
        if (u.userId !== s.id) {
          const isInitiator = s.id < u.userId;
          startWebRtcWithPeer(s, u.userId, isInitiator);
        }
      });
    });

    s.on("user-joined", (data: { userId: string; name: string }) => {
      setChannelUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, name: data.name }];
      });
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          id: Math.random().toString(),
          sender: "SYSTEM",
          message: `[COM-INFO] OPERATOR ${data.name} HAS SYNCED CORRESPONDENCE ON THIS FREQUENCY. OVER.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      // Connect to the new user who joined
      if (s.id) {
        const isInitiator = s.id < data.userId;
        startWebRtcWithPeer(s, data.userId, isInitiator);
      }
    });

    s.on("user-left", (data: { userId: string; name: string }) => {
      setChannelUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          id: Math.random().toString(),
          sender: "SYSTEM",
          message: `[COM-INFO] OPERATOR ${data.name} SECURED TRANSCEIVER & LOGGED OFF CHANNEL. OVER.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      closeWebRtcWithPeer(data.userId);
    });

    // WebRTC signaling receivers
    s.on("webrtc-offer", async (data: { from: string; offer: any }) => {
      console.log("WebRTC: Received offer from", data.from);
      let pc = peerConnectionsRef.current[data.from];
      if (!pc) {
        const freshStream = localStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        if (freshStream) {
          localStreamRef.current = freshStream;
          setLocalStream(freshStream);
          setIsMicAvailable(true);
        }
        pc = initPeerConnection(s, data.from, (remoteStream) => {
          routePeerAudioStream(data.from, remoteStream, volume);
        });
        peerConnectionsRef.current[data.from] = pc;
        if (freshStream) {
          addLocalStream(pc, freshStream);
        }
      }
      await handleOffer(pc, data.offer, s, data.from);
    });

    s.on("webrtc-answer", async (data: { from: string; answer: any }) => {
      console.log("WebRTC: Received answer from", data.from);
      const pc = peerConnectionsRef.current[data.from];
      if (pc) {
        await handleAnswer(pc, data.answer);
      }
    });

    s.on("ice-candidate", async (data: { from: string; candidate: any }) => {
      console.log("WebRTC: Received ICE candidate from", data.from);
      const pc = peerConnectionsRef.current[data.from];
      if (pc) {
        await handleIceCandidate(pc, data.candidate);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [volume]);

  // Listen for voice and SOS broadcasts
  useEffect(() => {
    if (!socket) return;

    const handleVoicePacket = (data: { from: string; name: string; audio: string; text?: string }) => {
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          id: Math.random().toString(),
          sender: "OPERATOR",
          message: `[RECV FROM ${data.name}] INCOMING AUDIO VOICE TRANSMISSION RECEIVED ON MESH NET. OVER.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      
      // Speak actual user's message text if present, or announce arriving transmission
      if (data.text) {
        playMilitaryRadioTTS(data.text);
      } else {
        playMilitaryRadioTTS(`Transmission radio entrante de l'opérateur ${data.name}.`);
      }

      // Delay playing base64 audio packet slightly so they don't overlap with the alerts
      setTimeout(() => {
        playRadioMessage(data.audio, linkStrength);
      }, 2000);
    };

    const handleSosPacket = (data: { from: string; name: string; enabled: boolean }) => {
      if (data.enabled) {
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: Math.random().toString(),
            sender: "SYSTEM",
            message: `[🚨 EMERGENCY SOS] SYSTEM BROADCAST FROM OPERATOR ${data.name}! BEACON ENGAGED. OVER.`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
        setSosBeacon(true);
        playMilitaryRadioTTS(`Alerte d'urgence S.O.S! L'opérateur ${data.name} a engagé la balise de détresse active sur la fréquence. À vous.`);
      } else {
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: Math.random().toString(),
            sender: "SYSTEM",
            message: `[🚨 EMERGENCY SOS] OPERATOR ${data.name} HAS SHUTDOWN DISTRESS DISTORTION SIGNAL. OVER.`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
        setSosBeacon(false);
        playMilitaryRadioTTS(`Information réseau. L'opérateur ${data.name} a coupé le signal de détresse S.O.S. Fréquence dégagée. Terminé.`);
      }
    };

    socket.on("voice-packet", handleVoicePacket);
    socket.on("sos-packet", handleSosPacket);

    return () => {
      socket.off("voice-packet", handleVoicePacket);
      socket.off("sos-packet", handleSosPacket);
    };
  }, [socket, linkStrength]);

  // Synchronize joining channels on frequency switches
  useEffect(() => {
    if (socket) {
      // Clean up all existing active connections when changing frequencies
      Object.keys(peerConnectionsRef.current).forEach((pId) => {
        closeWebRtcWithPeer(pId);
      });
      socket.emit("join-channel", activeChannel.name);
    }
  }, [socket, activeChannel]);

  const handleAddLog = (newLog: TransmissionLog) => {
    setLogs((prev) => [...prev, newLog]);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-950 text-white p-4 md:p-8 select-none flex flex-col justify-between">
      
      {/* Splash Screen */}
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-zinc-950 text-white flex flex-col items-center justify-center font-mono p-6">
          <div className="relative py-12 px-8 max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-center shadow-2xl gap-6 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="p-4 bg-zinc-940 border border-emerald-900/60 rounded-3xl relative animate-pulse">
              <Radio className="w-12 h-12 text-emerald-400" />
              <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
                TALKY WALKY
              </h1>
              <h2 className="text-2xl font-bold tracking-widest text-emerald-400 -mt-1.5 uppercase">
                BENY-JOE
              </h2>
            </div>

            <div className="h-[2px] w-1/2 bg-gradient-to-r from-transparent via-emerald-800 to-transparent" />

            <div className="flex flex-col gap-1.5 leading-relaxed text-zinc-400">
              <p className="text-sm font-semibold text-zinc-200">
                Système de Communication Satellite & Radio Tactique
              </p>
              <p className="text-xs text-emerald-450 italic">
                Fondé par Khedim Benyakhlef dit Beny Joe, Algérie
              </p>
            </div>

            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>SECURE CRYPTO LINK ESTABLISHED</span>
              </div>
              <div className="w-48 bg-zinc-950 h-1.5 rounded-full border border-zinc-850 p-[1px] overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%', transition: 'width 3s' }} />
              </div>
            </div>
            
            <button 
              onClick={() => setShowSplash(false)}
              className="mt-4 text-[10px] px-4 py-1.5 bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-800 rounded-lg text-zinc-400 transition-all uppercase cursor-pointer tracking-wider"
            >
              Passer l'introduction • S'identifier
            </button>
          </div>
        </div>
      )}

      {/* Top Professional Mission Dashboard Header */}
      <header className="max-w-7xl mx-auto w-full mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-emerald-450 rounded-2xl shadow-lg ring-1 ring-white/5">
            <Globe className="w-6 h-6 text-emerald-400 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent uppercase">
              TALKY WALKY BENY-JOE
            </h1>
            <p className="text-xs text-zinc-500 font-mono tracking-wider uppercase mt-0.5">
              Système de Communication Satellite & Radio Tactique — Fondé par Khedim Benyakhlef dit Beny Joe, Algérie
            </p>
          </div>
        </div>
        
        {/* Orbital Link Indicators */}
        <div className="flex flex-wrap items-center gap-4 bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/80 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-zinc-500">Uplink Gateway:</span>
            <span className="text-zinc-300">Alger Ground (DZ-Sat-1)</span>
          </div>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <Orbit className="w-4 h-4 text-indigo-400" />
            <span className="text-zinc-500">Active Node:</span>
            <span className="text-indigo-400 uppercase font-bold">{activeSatId}</span>
          </div>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-1">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-300 font-bold">GEMINI 3.5 CORE ENGINE</span>
          </div>
        </div>
      </header>

      {/* PWA State and Offline Engine Telemetry */}
      <div className="max-w-7xl mx-auto w-full mb-6 py-2.5 px-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 text-[10px] font-bold uppercase tracking-wider">
            PWA PLATFORM
          </span>
          <span className="text-zinc-400">Engine status:</span>
          <span className={`font-bold flex items-center gap-1.5 ${isOnline ? "text-emerald-400" : "text-amber-500 animate-pulse"}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-500 animate-ping"}`} />
            {isOnline ? "ONLINE SECURED" : "OFFLINE FALLBACK ACTIVATED"}
          </span>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 text-zinc-500 text-[11px]">
          <span>Offline Asset Cache: <strong className="text-zinc-350">ACTIVE (sw.js v1)</strong></span>
          <span className="hidden sm:inline">|</span>
          <span>Local DB Store: <strong className="text-zinc-350">SYNCHRONIZED</strong></span>
          <span className="hidden sm:inline">|</span>
          <span>Node Hub: <strong className="text-zinc-350">{typeof window !== "undefined" ? window.location.hostname : "beny-joe.net"}</strong></span>
        </div>
      </div>

      {/* 5-Layer Platform Navigation Tabs */}
      <div className="max-w-7xl mx-auto w-full mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => { playKeyClick(); setActiveLayerTab("handset"); }}
          className={`p-3 rounded-2xl border font-mono font-bold text-xs flex flex-col sm:flex-row items-center gap-2.5 cursor-pointer transition-all ${
            activeLayerTab === "handset"
              ? "bg-sky-950/40 text-sky-400 border-sky-850 shadow-[0_0_12px_rgba(56,189,248,0.15)]"
              : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-400 border-zinc-900/60 hover:border-zinc-800/80"
          }`}
        >
          <Radio className="w-5 h-5 shrink-0 text-sky-400" />
          <div className="text-left leading-tight">
            <div className="text-[11px]">COUCHES 1 & 5</div>
            <div className="text-[9px] font-normal uppercase opacity-75">Handset & Comms Center</div>
          </div>
        </button>

        <button
          onClick={() => { playKeyClick(); setActiveLayerTab("gateway"); }}
          className={`p-3 rounded-2xl border font-mono font-bold text-xs flex flex-col sm:flex-row items-center gap-2.5 cursor-pointer transition-all ${
            activeLayerTab === "gateway"
              ? "bg-indigo-950/40 text-indigo-400 border-indigo-850 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
              : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-400 border-zinc-900/60 hover:border-zinc-800/80"
          }`}
        >
          <Server className="w-5 h-5 shrink-0 text-indigo-400" />
          <div className="text-left leading-tight">
            <div className="text-[11px]">COUCHES 2 & 3</div>
            <div className="text-[9px] font-normal uppercase opacity-75">SBD Transponder Gateway</div>
          </div>
        </button>

        <button
          onClick={() => { playKeyClick(); setActiveLayerTab("voip"); }}
          className={`p-3 rounded-2xl border font-mono font-bold text-xs flex flex-col sm:flex-row items-center gap-2.5 cursor-pointer transition-all ${
            activeLayerTab === "voip"
              ? "bg-emerald-950/40 text-emerald-400 border-emerald-850 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-400 border-zinc-900/60 hover:border-zinc-800/80"
          }`}
        >
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
          <div className="text-left leading-tight">
            <div className="text-[11px]">COUCHE 4</div>
            <div className="text-[9px] font-normal uppercase opacity-75">Asterisk Cloud & Keys</div>
          </div>
        </button>

        <button
          onClick={() => { playKeyClick(); setActiveLayerTab("map"); }}
          className={`p-3 rounded-2xl border font-mono font-bold text-xs flex flex-col sm:flex-row items-center gap-2.5 cursor-pointer transition-all ${
            activeLayerTab === "map"
              ? "bg-rose-950/40 text-rose-455 border-rose-850 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
              : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-400 border-zinc-900/60 hover:border-zinc-800/80"
          }`}
        >
          <Map className="w-5 h-5 shrink-0 text-rose-400" />
          <div className="text-left leading-tight">
            <div className="text-[11px]">COUCHE 5 SUITE</div>
            <div className="text-[9px] font-normal uppercase opacity-75">Tracking Radar & SMS</div>
          </div>
        </button>

        <button
          onClick={() => { playKeyClick(); setActiveLayerTab("dz-int"); }}
          className={`p-3 rounded-2xl border font-mono font-bold text-xs flex flex-col sm:flex-row items-center gap-2.5 cursor-pointer transition-all ${
            activeLayerTab === "dz-int"
              ? "bg-amber-955/40 text-amber-400 border-amber-850 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              : "bg-zinc-900/30 text-zinc-500 hover:text-zinc-400 border-zinc-900/60 hover:border-zinc-800/80"
          }`}
        >
          <Globe className="w-5 h-5 shrink-0 text-amber-400" />
          <div className="text-left leading-tight">
            <div className="text-[11px]">RÉSEAU DZ & INT</div>
            <div className="text-[9px] font-normal uppercase opacity-75">Comms Algérie & Global</div>
          </div>
        </button>
      </div>

      {activeLayerTab === "handset" && (
        /* Main Grid: Responsive 3-Column Bento Layout */
        <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 mb-8 animate-fade-in">
          
          {/* Column 1: Satellite Tracker Compass & Alignment Radar */}
          <section className="lg:col-span-4 flex flex-col gap-5">
            <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800 shadow-xl font-mono text-xs flex flex-col gap-2">
              <div className="text-zinc-400 font-bold uppercase border-b border-zinc-850 pb-1.5 mb-1 flex items-center gap-1.5 text-[11px]">
                <Compass className="w-4.5 h-4.5 text-indigo-400" /> Ground Station Status
              </div>
              <div className="grid grid-cols-2 gap-2 text-zinc-400">
                <div>Telemetry Signal: <span className="text-emerald-400">{linkStrength > 80 ? "EXCELLENT" : linkStrength > 45 ? "STABLE" : "SQUELCHED"}</span></div>
                <div>Distress Loop: <span className={sosBeacon ? "text-rose-500 animate-pulse font-bold" : "text-zinc-500"}>{sosBeacon ? "ACTIVE" : "STANDBY"}</span></div>
                <div>Frequency Range: <span className="text-sky-400">{activeChannel.frequency}</span></div>
                <div>Atmospheric G: <span className="text-zinc-300">0.05dB Standard</span></div>
              </div>
            </div>

            <SateliteRadar
              satellites={satelliteData.length > 0 ? satelliteData : [
                { id: "thuraya-2", name: "Thuraya-2", status: "GEOSYNCHRONOUS", lon: 44.0, power: "98%", orbitType: "GEO" },
                { id: "thuraya-3", name: "Thuraya-3", status: "GEOSYNCHRONOUS", lon: 98.5, power: "95%", orbitType: "GEO" },
                { id: "iridium-12", name: "Iridium-12", status: "LOW_EARTH_ORBIT", alt: "780km", power: "87%", orbitType: "LEO" },
                { id: "thor-relay-x", name: "Thoraya-X Tactical Relay", status: "MOLNIYA_ORBIT", alt: "39,000km", power: "100%", orbitType: "HEO" }
              ]}
              activeSatId={activeSatId}
              onSelectSat={setActiveSatId}
              alignmentAngle={alignmentAngle}
              onAdjustAlignment={setAlignmentAngle}
              linkStrength={linkStrength}
            />

            <NetworkScanner
              activeChannel={activeChannel}
              onSelectChannel={setActiveChannel}
              codename={codename}
              onAddLog={handleAddLog}
              activeVoiceName={activeVoiceName}
              linkStrength={linkStrength}
              socket={socket}
            />
          </section>

          {/* Column 2: Centered 3D Physical Walkie-Talkie Transceiver */}
          <section className="lg:col-span-4 flex justify-center py-4">
            <ManualTransceiver
              activeChannel={activeChannel}
              encryptActive={encryptActive}
              linkStrength={linkStrength}
              volume={volume}
              squelchLevel={squelchLevel}
              sosBeacon={sosBeacon}
              onAddLog={handleAddLog}
              scrambleLevel={scrambleLevel}
              activeVoiceName={activeVoiceName}
              socket={socket}
              codename={codename}
            />
          </section>

          {/* Column 3: Signal Control panel and text communication feeds */}
          <section className="lg:col-span-4 flex flex-col gap-5 h-full">
            <TransmissionLogs
              logs={logs}
              activeFrequency={activeChannel.frequency}
              activeChannel={activeChannel.name}
              encryptActive={encryptActive}
              linkStrength={linkStrength}
              codename={codename}
              channelUsers={channelUsers}
            />

            <ControlPanel
              onChannelSelect={setActiveChannel}
              activeChannelId={activeChannel.id}
              encryptActive={encryptActive}
              onToggleEncrypt={() => setEncryptActive(!encryptActive)}
              squelchLevel={squelchLevel}
              onSquelchChange={setSquelchLevel}
              volume={volume}
              onVolumeChange={setVolume}
              sosBeacon={sosBeacon}
              onToggleSos={() => {
                const nextSos = !sosBeacon;
                setSosBeacon(nextSos);
                if (socket) {
                  socket.emit("sos-broadcast", { channel: activeChannel.name, enabled: nextSos });
                }
              }}
              scrambleLevel={scrambleLevel}
              onScrambleChange={setScrambleLevel}
              activeVoiceName={activeVoiceName}
              onVoiceNameSelect={setActiveVoiceName}
            />
          </section>

        </main>
      )}

      {activeLayerTab === "gateway" && (
        <main className="max-w-7xl mx-auto w-full flex-1 mb-8">
          <SbdSatelliteGateway />
        </main>
      )}

      {activeLayerTab === "voip" && (
        <main className="max-w-7xl mx-auto w-full flex-1 mb-8">
          <CloudAsteriskOps />
        </main>
      )}

      {activeLayerTab === "map" && (
        <main className="max-w-7xl mx-auto w-full flex-1 mb-8">
          <NetworkTacticalMap socket={socket} activeChannel={activeChannel} />
        </main>
      )}

      {activeLayerTab === "dz-int" && (
        <main className="max-w-7xl mx-auto w-full flex-1 mb-8">
          <DZInternationalCommHub 
            onAddLog={handleAddLog} 
            codename={codename} 
            volume={volume}
            linkStrength={linkStrength}
          />
        </main>
      )}

      {/* Decorative HUD Elements (Outside device) */}
      <div className="hidden xl:block absolute bottom-8 right-8 text-zinc-750 text-[11px] font-mono border-r border-zinc-900 pr-4 text-right leading-relaxed pointer-events-none">
        <span className="text-zinc-600">SYSTEM_SECURE_MODE:</span> <span className="text-emerald-500/80">ON</span><br />
        <span className="text-zinc-600">UPLINK_STRENGTH:</span> <span className="text-emerald-400">100%</span><br />
        <span className="text-zinc-600">DOWLINK_LATENCY:</span> <span className="text-emerald-500/40">420ms</span>
      </div>
      <div className="hidden xl:block absolute bottom-8 left-8 text-zinc-750 text-[11px] font-mono border-l border-zinc-900 pl-4 leading-relaxed pointer-events-none">
        <span className="text-zinc-600">FIRMWARE:</span> <span className="text-zinc-500">v4.9.2-TACTICAL</span><br />
        <span className="text-zinc-600">HARDWARE_ID:</span> <span className="text-zinc-500">TH-0922-A</span><br />
        <span className="text-zinc-600">OPERATOR_ID:</span> <span className="text-zinc-500">0092-ALPHA</span>
      </div>

      {/* Footer Navigation Credits */}
      <footer className="max-w-7xl mx-auto w-full text-center border-t border-zinc-880 pt-4 font-mono text-[10px] text-zinc-600 flex flex-col sm:flex-row justify-between items-center gap-2 z-10">
        <div>
          TALKY WALKY BENY-JOE • Système de Communication Satellite & Radio Tactique • Fondé par Khedim Benyakhlef dit Beny Joe, Algérie
        </div>
        <div className="flex items-center gap-2">
          <span>Active Orbiters: Local Ground-Station Node [DZ-Sat-1]</span>
          <span className="w-2 h-2 rounded-full bg-emerald-550"></span>
        </div>
      </footer>
    </div>
  );
}
