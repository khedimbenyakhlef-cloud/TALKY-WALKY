import React, { useState, useEffect, useRef } from "react";
import { Channel, TransmissionLog } from "../types";
import { 
  Wifi, 
  Battery, 
  Lock, 
  MapPin, 
  Radio, 
  Mic, 
  Power, 
  Volume2, 
  AlertOctagon, 
  Activity, 
  ChevronRight, 
  Hash, 
  CornerDownLeft, 
  Compass
} from "lucide-react";
import { 
  playTalkPermitTone, 
  playSquelchTail, 
  playKeyClick, 
  playRadioMessage,
  updateRadioStatic,
  stopRadioStatic,
  playMilitaryRadioTTS
} from "../utils/audio";

interface ManualTransceiverProps {
  activeChannel: Channel;
  encryptActive: boolean;
  linkStrength: number;
  volume: number;
  squelchLevel: number;
  sosBeacon: boolean;
  onAddLog: (log: TransmissionLog) => void;
  scrambleLevel: number;
  activeVoiceName: string;
  socket: any;
  codename: string;
}

export default function ManualTransceiver({
  activeChannel,
  encryptActive,
  linkStrength,
  volume,
  squelchLevel,
  sosBeacon,
  onAddLog,
  scrambleLevel,
  activeVoiceName,
  socket,
  codename
}: ManualTransceiverProps) {
  // Transceiver hardware states
  const [powerOn, setPowerOn] = useState(true);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [keypadInput, setKeypadInput] = useState("");
  const [isReceiving, setIsReceiving] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(94);
  const [gpsLocked, setGpsLocked] = useState(true);
  const [activeVoiceWave, setActiveVoiceWave] = useState<number[]>([]);
  const [lastReceivedAudio, setLastReceivedAudio] = useState<string | null>(null);
  const [webrtcFingerprint, setWebrtcFingerprint] = useState<string>("STABILIZING_DTLS_TUNNEL...");
  const [echoLoopback, setEchoLoopback] = useState(true);

  useEffect(() => {
    let active = true;
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      // Force cert creation
      pc.createDataChannel("secure-tactical-telemetry");

      pc.createOffer().then((offer) => {
        if (!active) return;
        const sdpStr = offer.sdp || "";
        const match = sdpStr.match(/a=fingerprint:\s*(\S+)\s+(\S+)/i);
        if (match && match[2]) {
          setWebrtcFingerprint(`${match[1].toUpperCase()}-${match[2].toUpperCase().slice(0, 22)}...`);
        } else {
          setWebrtcFingerprint("SHA256-4F:31:8B:CA:91:DE:0E...");
        }
        pc.close();
      }).catch((e) => {
        console.warn("RTCPeerConnection offer rejected:", e);
        setWebrtcFingerprint("SHA256-4F:31:AA:BC:92:DF:1A...");
      });
    } catch (err) {
      console.warn("RTCPeerConnection construct state failed:", err);
      setWebrtcFingerprint("SHA256-A8:C3:FF:B2:99:EE:12...");
    }

    return () => {
      active = false;
    };
  }, []);
  
  // Synchronize environmental atmospheric squelch static noise loop
  useEffect(() => {
    updateRadioStatic(squelchLevel, volume * 100, powerOn);
    return () => {
      if (!powerOn) {
        stopRadioStatic();
      }
    };
  }, [squelchLevel, volume, powerOn]);
  
  // Speech Recognition & Web Recorder Refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize Speech Recognition locally in Chrome or Safari if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "fr-FR"; // support French as per user query!
      
      rec.onstart = () => {
        setIsTransmitting(true);
        setDisplayText("TRANSMITTING...");
        playTalkPermitTone();
        startVoiceGraph();
      };
      
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          submitTransmission(transcript);
        }
      };
      
      rec.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        if (err.error !== "no-speech") {
          setDisplayText("LINK ERROR - RETRY");
        }
      };
      
      rec.onend = () => {
        setIsTransmitting(false);
        playSquelchTail();
        stopVoiceGraph();
      };
      
      recognitionRef.current = rec;
    }
  }, [activeChannel, encryptActive]);

  // Voice wave oscillator rendering for PTT feedback
  const startVoiceGraph = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Initialize real-time physical walkie-talkie voice recorder
      try {
        const recorderOptions = { mimeType: "audio/webm" };
        const mediaRecorder = new MediaRecorder(stream, recorderOptions);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrlStr = reader.result as string;
            const base64Audio = dataUrlStr.split(",")[1];
            if (base64Audio && socket) {
              socket.emit("voice-broadcast", {
                channel: activeChannel.name,
                audio: base64Audio
              });
            }
            if (echoLoopback && base64Audio) {
              setTimeout(() => {
                setDisplayText("ECHO LOOPBACK...");
                playMilitaryRadioTTS("Boucle d'écho active. Transmission audio reçue de l'opérateur.");
                setTimeout(() => {
                  playRadioMessage(base64Audio, linkStrength);
                  setTimeout(() => setDisplayText("ONLINE"), 3000);
                }, 2800);
              }, 1200);
            }
          };
          reader.readAsDataURL(audioBlob);
        };
        
        mediaRecorder.start();
      } catch (recError) {
        console.warn("MediaRecorder init failed, falling back safely to virtual transmitter:", recError);
      }
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const waveData = new Uint8Array(analyser.frequencyBinCount);
      
      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(waveData);
        // Map frequency segments to integers for layout rendering
        const scaled = Array.from(waveData).slice(0, 16).map(v => Math.max(2, Math.round(v / 28)));
        setActiveVoiceWave(scaled);
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      
      draw();
    } catch (e) {
      // Fallback random synthesizer wave graphic if mic is disallowed inside sandbox
      const interval = setInterval(() => {
        const fake = Array.from({ length: 12 }, () => Math.floor(Math.random() * 8) + 1);
        setActiveVoiceWave(fake);
      }, 100);
      (window as any)._fakeWaveInterval = interval;
    }
  };

  const stopVoiceGraph = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if ((window as any)._fakeWaveInterval) {
      clearInterval((window as any)._fakeWaveInterval);
    }
    setActiveVoiceWave([]);
  };

  // Submit recorded/typed package to orbital satellite terminal
  const submitTransmission = async (text: string) => {
    if (!text.trim()) return;
    
    // Add ground message to list
    onAddLog({
      id: Math.random().toString(),
      sender: "OPERATOR",
      message: text,
      timestamp: new Date().toLocaleTimeString()
    });
    
    setIsReceiving(true);
    setDisplayText("UPLINK COMMITTING...");

    // Identity prompt decorators matching selectable voices
    const identityGuides: Record<string, string> = {
      Fenrir: "You are \"Commander Fenrir\" - a senior military SATCOM operations supervisor. Call sign OMEGA-LEADER. Speak in strict, authoritative, brief military terms. Keep it highly realistic and under 20 words.",
      Kore: "You are \"Ground Dispatch Kore\" - an automated satellite dispatch interface assistant. Calm, polite, extremely efficient, with rapid information feedback. Keep words concise.",
      Zephyr: "You are \"Security Automated Beacon Zephyr\" - a telemetry analysis machine. Speak with machine logs style, using variables and status codes, very robotic, extremely dry.",
      Charon: "You are \"Deep Space Relay Charon\" - operating on extremely high-attenuation orbital paths. Speaks slowly, repeats critical words, acts like transmissions take severe signal loss."
    };
    
    try {
      const response = await fetch("/api/radio/transmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          frequency: activeChannel.frequency,
          channelName: activeChannel.name,
          encryptActive: encryptActive,
          satelliteDistance: linkStrength < 40 ? "COHERENCE_CRITICAL" : "OK",
          voiceName: activeVoiceName,
          identityGuide: identityGuides[activeVoiceName] || ""
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setIsReceiving(false);
      setDisplayText("ONLINE");

      // Log Satellite response
      onAddLog({
        id: Math.random().toString(),
        sender: "SAT-STATION",
        message: data.text,
        timestamp: new Date().toLocaleTimeString(),
        isFallback: data.useSynthFallback
      });

      // Play sound using either Gemini high-end TTS or local Web Speech synthesis API as back-up
      if (data.audio) {
        setDisplayText("SAT TRANSMITTING...");
        setLastReceivedAudio(data.audio); // Save to voicemail!
        await playRadioMessage(data.audio, linkStrength);
        setTimeout(() => setDisplayText("ONLINE"), 3000);
      } else if (data.useSynthFallback) {
        // Fallback Web TTS
        setDisplayText("SYNTH VOICE LINK...");
        playMilitaryRadioTTS(data.text);
        setTimeout(() => {
          setDisplayText("ONLINE");
        }, 4000);
      }
      
    } catch (e: any) {
      console.error(e);
      setIsReceiving(false);
      setDisplayText("SAT LINK RETRY");
      // Add system log
      onAddLog({
        id: Math.random().toString(),
        sender: "SYSTEM",
        message: "[SAT-ERR] CARRIER ATTENUATED. ORIENT ANTENNA UNTIL LINK LOCK. OVER.",
        timestamp: new Date().toLocaleTimeString()
      });
      playSquelchTail();
    }
  };

  // Manual Trigger for PTT when holding PTT button down or space bar
  const startRecording = () => {
    if (!powerOn) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Fallback if already running
        setIsTransmitting(true);
        startVoiceGraph();
        playTalkPermitTone();
      }
    } else {
      // Fallback to manual dial keyboard entry text triggers
      setIsTransmitting(true);
      startVoiceGraph();
      playTalkPermitTone();
    }
  };

  const stopRecording = () => {
    if (!powerOn) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    } else {
      setIsTransmitting(false);
      stopVoiceGraph();
      playSquelchTail();
      // Trigger prompt from current typed input
      if (keypadInput.trim()) {
        submitTransmission(keypadInput);
        setKeypadInput("");
      }
    }
  };

  // Space bar listeners for realistic walkie-talkie operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if focus is not within a text input field to prevent blocking direct typing
      if (e.code === "Space" && !isTransmitting && powerOn && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && isTransmitting && powerOn && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isTransmitting, powerOn, keypadInput, activeChannel, encryptActive]);

  // Listen for socket-driven simulated transmissions
  useEffect(() => {
    if (!socket) return;

    const handleIncomingPreset = (data: { preset: string, text: string }) => {
      setDisplayText(`RX TR-${data.preset === "A" ? "ALPHA" : data.preset === "B" ? "BRAVO" : "RELAIS"}...`);
      playMilitaryRadioTTS(data.text);
      onAddLog({
        id: Math.random().toString(),
        sender: "SAT-STATION",
        message: `[UNIT-${data.preset === "A" ? "ALPHA" : data.preset === "B" ? "BRAVO" : "RELAIS"}] ${data.text}`,
        timestamp: new Date().toLocaleTimeString()
      });
      setTimeout(() => {
        setDisplayText("ONLINE");
      }, 7000);
    };

    socket.on("incoming-preset-transmission", handleIncomingPreset);
    return () => {
      socket.off("incoming-preset-transmission", handleIncomingPreset);
    };
  }, [socket, onAddLog]);

  const handleKeypadPress = (val: string) => {
    if (!powerOn) return;
    playKeyClick();
    if (val === "CLR") {
      setKeypadInput("");
    } else if (val === "ENT") {
      if (keypadInput) {
        submitTransmission(keypadInput);
        setKeypadInput("");
      }
    } else if (val === "#") {
      if (lastReceivedAudio) {
        setDisplayText("PLAYING MEMORY...");
        playRadioMessage(lastReceivedAudio, linkStrength);
        setTimeout(() => setDisplayText("ONLINE"), 3000);
      } else {
        setDisplayText("MEMO EMPTY");
        setTimeout(() => setDisplayText("ONLINE"), 1500);
      }
    } else if (val === "A") {
      if (socket) {
        setDisplayText("TX TR-ALPHA...");
        socket.emit("trigger-preset", { preset: "A", channel: activeChannel.name });
      } else {
        setDisplayText("NO CONN");
        setTimeout(() => setDisplayText("ONLINE"), 1500);
      }
    } else if (val === "B") {
      if (socket) {
        setDisplayText("TX TR-BRAVO...");
        socket.emit("trigger-preset", { preset: "B", channel: activeChannel.name });
      } else {
        setDisplayText("NO CONN");
        setTimeout(() => setDisplayText("ONLINE"), 1500);
      }
    } else if (val === "C") {
      if (socket) {
        setDisplayText("TX TR-RELAIS...");
        socket.emit("trigger-preset", { preset: "C", channel: activeChannel.name });
      } else {
        setDisplayText("NO CONN");
        setTimeout(() => setDisplayText("ONLINE"), 1500);
      }
    } else {
      // Limit size to prevent overflow
      if (keypadInput.length < 24) {
        setKeypadInput((p) => p + val);
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* 3D Walkie-Talkie Frame Chassis (Slate Grey Industrial Design) */}
      <div className="relative w-72 bg-gradient-to-b from-zinc-800 to-zinc-900 border-[3.5px] border-zinc-950 rounded-[40px] px-6 pt-10 pb-8 shadow-[inset_0_4px_12px_rgba(255,255,255,0.15),0_15px_30px_rgba(0,0,0,0.6)] flex flex-col items-center select-none">
        
        {/* Rubber Top Antenna & Knobs */}
        <div className="absolute -top-16 left-12 w-5 h-20 bg-gradient-to-r from-zinc-950 to-zinc-800 rounded-t-lg shadow-md border-b-4 border-zinc-950 z-[-1] transition-transform duration-300">
          <div className="w-full h-2 bg-indigo-500 rounded-t-sm"></div>
        </div>
        <div className="absolute -top-6 right-16 w-8 h-8 bg-zinc-950 rounded-md shadow-inner border-b-2 border-zinc-850 z-[-1] transform rotate-12 flex items-center justify-center">
          <div className="w-1.5 h-full bg-zinc-800 rounded"></div>
        </div>

        {/* Motorola Style Speaker Grill Cuts */}
        <div className="w-full flex justify-between gap-1.5 px-6 mb-4">
          <div className="h-1 bg-zinc-950/80 rounded-full w-full"></div>
          <div className="h-1 bg-zinc-950/80 rounded-full w-full"></div>
          <div className="h-1 bg-zinc-950/80 rounded-full w-full"></div>
          <div className="h-1 bg-zinc-950/80 rounded-full w-full"></div>
          <div className="h-1 bg-zinc-950/80 rounded-full w-full"></div>
        </div>

        {/* BRAND INVO LOGO */}
        <div className="flex items-center justify-center gap-1.5 mb-5 font-mono">
          <div className="w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center text-zinc-300 text-[10px] font-bold">
            M
          </div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-zinc-400">MOTOROLA</span>
          <span className="text-[10px] text-sky-400 font-bold bg-zinc-950/80 px-1 py-0.2 rounded border border-zinc-800">THU-X</span>
        </div>

        {/* Tactical LCD Monochrome Emerald OLED Glowing Screen */}
        <div className={`w-full aspect-[4/3] rounded-2xl border-4 border-zinc-850 shadow-[inset_0_2px_8px_rgba(0,0,0,0.95)] relative p-3 mr-0.5 ml-0.5 flex flex-col font-mono overflow-hidden transition-all duration-300 ${
          powerOn 
            ? "bg-[#0b140b] text-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.28)]" 
            : "bg-zinc-950 text-zinc-900 border-zinc-900 brightness-30"
        }`}>
          {powerOn && (
            <>
              {/* Screen Top Status Line */}
              <div className="flex justify-between items-center text-[9px] font-semibold border-b border-emerald-900/40 pb-1 mb-1.5 text-emerald-500/80">
                <div className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>{linkStrength > 80 ? "S9+" : linkStrength > 50 ? "S5" : "S1"}</span>
                  {encryptActive && <Lock className="w-2.5 h-2.5 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                  <span>GPS 3D</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>{batteryLevel}%</span>
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              {encryptActive && (
                <div className="text-[8px] bg-[#0c1c0c] text-emerald-400/95 font-mono px-1 py-0.5 rounded border border-emerald-900/30 flex justify-between items-center mb-1 leading-none select-text">
                  <span className="font-extrabold uppercase shrink-0 text-emerald-500 text-[7px] mr-1">E2E CRYP:</span>
                  <span className="truncate tracking-tighter" title={webrtcFingerprint}>{webrtcFingerprint}</span>
                </div>
              )}

              {/* Main Information Row */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold tracking-tight truncate max-w-[140px] text-emerald-450">
                      {activeChannel.name}
                    </span>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-900/40 font-bold">
                      CH {activeChannel.id === "sat-tac" ? "01" : activeChannel.id === "sat-emerg" ? "02" : "03"}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium leading-none tracking-tight text-emerald-500/60 mt-0.5 flex justify-between items-center w-full">
                    <span>{activeChannel.frequency} {scrambleLevel > 0 ? `• SCR-L${scrambleLevel}` : ""}</span>
                    <span className="text-[9px] text-emerald-400 font-bold">ID: {codename || "SYNCING"}</span>
                  </div>
                </div>

                {/* Satellite Compass alignment mini pointer or state message */}
                <div className="flex items-center justify-between mt-1 text-[10px] bg-emerald-950/30 p-1.5 rounded border border-emerald-900/30 text-emerald-400">
                  <div className="flex items-center gap-1">
                    <Activity className={`w-3.5 h-3.5 ${isTransmitting ? "animate-pulse text-emerald-300" : ""}`} />
                    <span className="font-bold uppercase tracking-wide">
                      {isTransmitting ? "TX MODE" : isReceiving ? "RX SYNCING..." : displayText || "LINK LOCKED"}
                    </span>
                  </div>
                  <div className="text-[9px] uppercase font-bold opacity-80 text-emerald-500">
                    {linkStrength > 85 ? "L-BAND CONF" : linkStrength > 40 ? "ATTENUATED" : "ALIGN REQUIRED"}
                  </div>
                </div>

                {/* Sub-screen footer: Keypad entry typed buffer or voice waveforms */}
                <div className="h-8 flex items-center justify-between border-t border-emerald-900/30 pt-1 text-xs">
                  {isTransmitting ? (
                    /* Render dynamic voice analysis bars */
                    <div className="flex items-end gap-0.5 h-6 w-full justify-center">
                      {activeVoiceWave.length > 0 ? (
                        activeVoiceWave.map((h, i) => (
                          <div 
                            key={i} 
                            className="bg-emerald-500 w-1 transition-all duration-75"
                            style={{ height: `${h * 4}px` }}
                          />
                        ))
                      ) : (
                        Array.from({ length: 16 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="bg-emerald-500 w-1 animate-pulse"
                            style={{ height: `${2 + Math.random() * 8}px` }}
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    /* Render typed text input if typing */
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400/90 w-full truncate">
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                      <span className="truncate uppercase font-bold text-emerald-300 bg-emerald-950/40 px-1 rounded block w-full border border-emerald-900/20">
                        {keypadInput || "Awaiting Tx/Input..."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          
          {!powerOn && (
            <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-800 font-bold uppercase tracking-widest">
              CHASSIS OFFLINE
            </div>
          )}
        </div>

        {/* Physical PUSH-TO-TALK (PTT) Dual button layout on left edge */}
        <div className="absolute -left-1 w-4.5 top-36 flex flex-col gap-2 z-10">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-4 h-16 rounded-[4px] border-l-2 border-y-2 border-zinc-950 transition-all ${
              isTransmitting 
                ? "bg-emerald-500 scale-x-95 shadow-[0_0_8px_rgba(16,185,129,0.7)]" 
                : "bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
            }`}
            title="PUSH-TO-TALK button (HOLD TO TRANSMIT)"
          />
          <button 
            onClick={() => { playKeyClick(); setPowerOn(!powerOn); }}
            className={`w-3.5 h-7 rounded-l-[4px] border-l border-y border-zinc-950 flex items-center justify-center ${
              powerOn ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-700 hover:bg-zinc-650"
            }`}
            title="POWER SWITCH TACTICAL"
          >
            <Power className="w-2.5 h-2.5 text-white" />
          </button>
        </div>

        {/* Physical Keypad Grid (Geometric Balance design with subheadings) */}
        <div className="grid grid-cols-4 gap-2 mt-6 w-full font-mono">
          {[
            { num: "1", sub: ".,?" },
            { num: "2", sub: "ABC" },
            { num: "3", sub: "DEF" },
            { num: "A", sub: "SYS" },
            { num: "4", sub: "GHI" },
            { num: "5", sub: "JKL" },
            { num: "6", sub: "MNO" },
            { num: "B", sub: "CRY" },
            { num: "7", sub: "PRS" },
            { num: "8", sub: "TUV" },
            { num: "9", sub: "WXY" },
            { num: "C", sub: "ALT" },
          ].map((item) => (
            <button
              key={item.num}
              onClick={() => handleKeypadPress(item.num)}
              className="bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-white rounded-lg p-1.5 flex flex-col items-center justify-center shadow-md active:translate-y-px transition-all cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">{item.num}</span>
              <span className="text-[7px] text-zinc-500 tracking-wider font-semibold mt-0.5">{item.sub}</span>
            </button>
          ))}
          {/* Bottom special action rows */}
          <button
            onClick={() => handleKeypadPress("CLR")}
            className="bg-rose-950/40 hover:bg-rose-950/60 text-rose-400 border border-rose-900/30 rounded-lg p-1.5 flex flex-col items-center justify-center shadow-md active:translate-y-px cursor-pointer"
          >
            <span className="text-xs font-bold leading-none">CLR</span>
            <span className="text-[7px] text-rose-600/60 font-semibold uppercase tracking-widest mt-0.5">BACK</span>
          </button>
          <button
            onClick={() => handleKeypadPress("0")}
            className="bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-white rounded-lg p-1.5 flex flex-col items-center justify-center shadow-md active:translate-y-px cursor-pointer"
          >
            <span className="text-sm font-bold leading-none">0</span>
            <span className="text-[7px] text-zinc-500 font-semibold tracking-wider mt-0.5">+</span>
          </button>
          <button
            onClick={() => handleKeypadPress("ENT")}
            className="bg-emerald-950/40 hover:bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 rounded-lg p-1.5 flex flex-col items-center justify-center shadow-md active:translate-y-px cursor-pointer"
          >
            <span className="text-xs font-bold leading-none">ENT</span>
            <span className="text-[7px] text-emerald-600/60 font-semibold uppercase tracking-widest mt-0.5">SEND</span>
          </button>
          <button
            onClick={() => handleKeypadPress("#")}
            className="bg-zinc-805/80 hover:bg-zinc-700 border border-zinc-700/60 text-white rounded-lg p-1.5 flex flex-col items-center justify-center shadow-md active:translate-y-px cursor-pointer"
            title="Press # to replay the last received satellite voice message (VOICEMAIL)"
          >
            <span className="text-xs font-bold leading-none">#</span>
            <span className="text-[7px] text-emerald-450 font-bold tracking-normal mt-0.5 animate-pulse">MEMO</span>
          </button>
        </div>

        {/* User Action Indicator / Spacebar guide */}
        <div className="mt-5 text-center font-mono text-[10px] text-zinc-500 w-full border-t border-zinc-850 pt-2 flex flex-col items-center">
          <span className="flex items-center gap-1.5 justify-center mb-1">
            <Mic className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />
            <span>SPACEBAR or HOLD PTT button to speak (French/English)</span>
          </span>
          <span className="text-[9px] opacity-75">OR type on numpad, ENT to transmit. Press <strong>#</strong> to REPLAY voicemail.</span>
        </div>
      </div>
    </div>
  );
}
