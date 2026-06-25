import React, { useState, useEffect } from "react";
import { Channel, CHANNELS_LIST, TransmissionLog } from "../types";
import { Radio, Search, Activity, Volume2, ShieldAlert, Cpu } from "lucide-react";
import { playKeyClick, playScanBeep, playRadioMessage, playMilitaryRadioTTS } from "../utils/audio";

// Map each channel to actual Algerian and international station transmissions for high-fidelity audio spectrum sweeps
const CHANNEL_SAMPLE_TRANSMISSIONS: Record<string, string[]> = {
  "sat-tac": [
    "Ici Garnison In Salah. Liaison satellite Moto-Sat sécurisée avec Alger. Convoi logistique en approche de Reggane. Aucun incident signalé. Terminé.",
    "Ici Alger Port Control. Contrôle douanier en cours sur le Cargo pétrolier en provenance de Marseille. Documents d'import validés. Transit autorisé. Terminé.",
    "Ici Unité de Reconnaissance Ouargla. Vecteur de reconnaissance infiltré sur zone de contrôle Sud. Pas d'anomalie enregistrée. Terminé."
  ],
  "sat-emerg": [
    "Ici CROSS Méditerranée. Reçu SOS. Coordonnées de l'embarcation interceptées. Hélicoptère de sauvetage en cours de décollage. Tenez bon. À vous.",
    "Poste Tindouf. Alerte intrusion radar thermique près du secteur frontalier. Unité d'interception blindée dépêchée sur site. Restez en veille. À vous.",
    "Alerte détresse reçue sur fréquence de garde cent vingt et un virgule cinq. Appareil non identifié à trente mille pieds. Répondez. À vous."
  ],
  "vhf-tac": [
    "Ici Base Aérienne de Tafraoui (Oran). Décollage immédiat de deux intercepteurs de routine secteur Ouest. À vous.",
    "Ici Raffinerie Oran. Périmètre maritime sécurisé. Aucun écho sonar anormal ce matin. Température stable. À vous.",
    "Poste Kasserine. Patrouille mixte opérationnelle le long du flanc Ouest. Pas d'écho ou de franchissement suspect. À vous."
  ],
  "uhf-sat": [
    "This is USS Mount Whitney, flagship of the US Navy Sixth Fleet. Secure satellite uplink active on Channel Delta-12. Proceed. Over.",
    "Ici CROSS-Med France. Message de sécurité urgent à tous les navigateurs. Fortes houles signalées sur le secteur de la Corse. Restez prudents. À vous.",
    "Ici Base Navale de Annaba. Patrouilleur rapide engagé sur secteur frontalier Est. Mer force trois, visibilité bonne. À vous."
  ],
  "space-relay": [
    "Ici Dispatch Genève. Envoi approuvé de deux convois humanitaires de premiers secours vers la frontière saharienne. Convoi neutre sécurisé. À vous.",
    "Ici Centre S-9 DGSE. Liaison sécurisée cryptée opérationnelle. Téléchargez le paquet d'analyse aérologique sur canal dédié. À vous.",
    "Bamako Central. Liaison satellite Beny-Joe active cinq sur cinq. Transmission claire des statuts terrain de Bamako. Terminé."
  ]
};

interface NetworkScannerProps {
  activeChannel: Channel;
  onSelectChannel: (channel: Channel) => void;
  codename: string;
  onAddLog: (log: TransmissionLog) => void;
  activeVoiceName: string;
  linkStrength: number;
  socket: any;
}

export default function NetworkScanner({
  activeChannel,
  onSelectChannel,
  codename,
  onAddLog,
  activeVoiceName,
  linkStrength,
  socket
}: NetworkScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [channelActivity, setChannelActivity] = useState<Record<string, number>>({});
  const [activeTrafficChannelId, setActiveTrafficChannelId] = useState<string>("sat-emerg"); // Where current traffic peaks
  const [trafficMessage, setTrafficMessage] = useState<string>("");
  const [isConcernedToUser, setIsConcernedToUser] = useState(false);
  const [hasPlayedIntercept, setHasPlayedIntercept] = useState<Record<string, boolean>>({});

  // Simulate continuous fluctuation of signal activity across bands
  useEffect(() => {
    const interval = setInterval(() => {
      const updated: Record<string, number> = {};
      CHANNELS_LIST.forEach((channel) => {
        if (channel.id === activeTrafficChannelId) {
          // Locked carrier channel has extremely high traffic
          updated[channel.id] = Math.floor(Math.random() * 25) + 75; // 75-100%
        } else {
          // Other channels have random background ambient digital packets
          updated[channel.id] = Math.floor(Math.random() * 25) + 5; // 5-30%
        }
      });
      setChannelActivity(updated);
    }, 1200);

    return () => clearInterval(interval);
  }, [activeTrafficChannelId]);

  // Periodic shifting of main traffic carrier (every 18 seconds, a new channel becomes busy)
  useEffect(() => {
    const shiftInterval = setInterval(() => {
      const idx = Math.floor(Math.random() * CHANNELS_LIST.length);
      const newChannel = CHANNELS_LIST[idx];
      setActiveTrafficChannelId(newChannel.id);
      
      // Randomize traffic message and decide if it concerns YOU
      const concerns = Math.random() > 0.40;
      setIsConcernedToUser(concerns);

      const FrenchTrafficLines = [
        `[INTERCEPT ALPHA] Ici Unité Alpha. Liaison orbitale sécurisée. Mouvements suspects repérés près des coordonnées ouest. Restons en veille active. À vous.`,
        `[INTERCEPT BRAVO] Ici Unité Bravo. Balayage des fréquences terminé. Brouillage magnétique à forte densité localisé dans le secteur d'observation. À vous.`,
        `[INTERCEPT HQ] Contrôle central MOTO-SAT à tous les opérateurs. Alerte tempête électromagnétique imminente. Passage immédiat en fréquence alternée. Terminé.`,
        `[INTERCEPT RELAIS] Relais principal en position géostationnaire stabilisée. Liaison montante opérationnelle à cent pour cent. Signalez toute anomalie. À vous.`
      ];

      const UserDirectedLines = [
        `[ALERTE SECU] Alerte sécurité prioritaire pour l'opérateur de terrain ${codename || "ALPHA-1"}! S'il vous plaît, répondez immédiatement sur ce canal d'écoute pour authentification. À vous.`,
        `[MOTO-LINK] Liaison établie avec l'opérateur ${codename || "ALPHA-1"}. Le terminal central attend votre rapport de transmission de données cryptées. À vous.`,
        `[INTERCEPT DIRECT] Message d'urgence destiné à l'unité ${codename || "ALPHA-1"} : Alignement spatial validé. Transmettez votre code de diagnostic à vous.`
      ];

      const selectedRawText = concerns 
        ? UserDirectedLines[Math.floor(Math.random() * UserDirectedLines.length)]
        : FrenchTrafficLines[Math.floor(Math.random() * FrenchTrafficLines.length)];

      setTrafficMessage(selectedRawText);
    }, 18000);

    return () => clearInterval(shiftInterval);
  }, [codename]);

  // Initial trigger to generate a starting traffic message
  useEffect(() => {
    setIsConcernedToUser(true);
    setTrafficMessage(`[ALERTE MOTO] Liaison radio active. Système d'interception configuré. Restez à l'écoute sur cette fréquence d'appel. À vous.`);
  }, [codename]);

  // Automatically trigger readout of intercepted messages if the user is active on that channel
  useEffect(() => {
    if (activeChannel.id === activeTrafficChannelId && trafficMessage) {
      triggerSpeechForIntercept(activeChannel.id, activeChannel.name);
    }
  }, [trafficMessage, activeChannel.id, activeTrafficChannelId]);

  // Handler for scanning loop
  useEffect(() => {
    if (!isScanning) return;

    let scanIndex = CHANNELS_LIST.findIndex(c => c.id === activeChannel.id);
    if (scanIndex === -1) scanIndex = 0;

    const interval = setInterval(() => {
      // Shift to next channel
      scanIndex = (scanIndex + 1) % CHANNELS_LIST.length;
      const targetChan = CHANNELS_LIST[scanIndex];
      onSelectChannel(targetChan);
      playScanBeep();

      // Check if this channel matches the active carrier
      if (targetChan.id === activeTrafficChannelId) {
        setIsScanning(false);
        playKeyClick();
        
        // Add intercept log
        onAddLog({
          id: Math.random().toString(),
          sender: "SYSTEM",
          message: `[COM-SCANNER] CARRIER ACQUIRED AT ${targetChan.frequency} (${targetChan.name}). AUDIO COHERENCE TUNING LOCKED.`,
          timestamp: new Date().toLocaleTimeString()
        });

        triggerSpeechForIntercept(targetChan.id, targetChan.name);
      } else {
        // Immersive experience: play a short simulated voice transmission snippet from this channel's station sample transmissions
        const samples = CHANNEL_SAMPLE_TRANSMISSIONS[targetChan.id];
        if (samples && samples.length > 0) {
          const snippetMsg = samples[Math.floor(Math.random() * samples.length)];
          playMilitaryRadioTTS(snippetMsg.substring(0, 48) + "...");
        }
      }
    }, 2000); // 2000ms interval allows beautiful micro-snippets of simulated voice as we scan through!

    return () => clearInterval(interval);
  }, [isScanning, activeTrafficChannelId, activeChannel]);

  // Log intercepted simulated traffic and read it out automatically matching user's real-time readout directive
  const triggerSpeechForIntercept = (channelId: string, channelName: string) => {
    const list = CHANNEL_SAMPLE_TRANSMISSIONS[channelId] || [trafficMessage];
    const rawText = list[Math.floor(Math.random() * list.length)];
    const messageId = channelId + "-" + rawText;
    if (hasPlayedIntercept[messageId]) return;
    setHasPlayedIntercept(prev => ({ ...prev, [messageId]: true }));

    // Add intercept log
    onAddLog({
      id: Math.random().toString(),
      sender: "SAT-STATION",
      message: `[COM INTERCEPT - ${channelName}] ${rawText}`,
      timestamp: new Date().toLocaleTimeString()
    });

    // Speak it out loud in crisp military tactical French style!
    playMilitaryRadioTTS(rawText);
  };

  const forceTuningTraffic = (chan: Channel) => {
    playKeyClick();
    onSelectChannel(chan);
    triggerSpeechForIntercept(chan.id, chan.name);
  };

  return (
    <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-900 shadow-xl text-white flex flex-col gap-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wider uppercase text-sky-400">
            Spectrum Traffic Scanner
          </span>
        </div>
        <div className="text-[9px] text-zinc-500 font-bold uppercase">
          Carrier Detector Grid
        </div>
      </div>

      {/* Description */}
      <div className="text-[10px] text-zinc-400 leading-normal bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-900/60">
        Le système détecte des émissions radio intermittentes sur nos fréquences orbitales. 
        Activez l'<span className="text-sky-300 font-bold">Auto-Scan</span> pour vous synchroniser directement et écouter le traffic en temps réel.
      </div>

      {/* Grid of Channels showing Signal Activity Bars */}
      <div className="flex flex-col gap-2 my-1">
        {CHANNELS_LIST.map((chan) => {
          const isCurrent = chan.id === activeChannel.id;
          const isBusyCarrier = chan.id === activeTrafficChannelId;
          const percent = channelActivity[chan.id] || 8;

          return (
            <div 
              key={chan.id}
              onClick={() => forceTuningTraffic(chan)}
              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                isCurrent 
                  ? "bg-sky-950/20 border-sky-900/65 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.1)]" 
                  : "bg-zinc-900/20 border-zinc-900/50 hover:border-zinc-800 text-zinc-400"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Radio className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent ? "text-sky-400" : "text-zinc-650"}`} />
                  <span className="font-bold truncate text-[11px]">{chan.name}</span>
                  <span className="text-[9px] text-zinc-550 shrink-0">({chan.frequency})</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {isBusyCarrier && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-900/40 text-amber-400 text-[8px] font-black animate-pulse flex items-center gap-0.5 uppercase">
                      <Volume2 className="w-2.5 h-2.5" /> TRAFFIC
                    </span>
                  )}
                  <span className={`text-[10px] font-bold ${isBusyCarrier ? "text-sky-400" : "text-zinc-600"}`}>
                    {percent}%
                  </span>
                </div>
              </div>

              {/* Fluctuating RF activity bar */}
              <div className="w-full h-1.5 bg-zinc-900/60 rounded-full overflow-hidden flex items-center">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isBusyCarrier 
                      ? "bg-gradient-to-r from-sky-500 to-sky-450 shadow-[0_0_10px_rgb(56,189,248)]" 
                      : isCurrent 
                      ? "bg-sky-650" 
                      : "bg-zinc-800"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Monitor Controller Buttons */}
      <div className="grid grid-cols-1 gap-2 border-t border-zinc-900 pt-2.5">
        <button
          onClick={() => {
            playKeyClick();
            setIsScanning(!isScanning);
          }}
          className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase ${
            isScanning
              ? "bg-sky-950 text-sky-400 border-sky-800 shadow-[0_0_12px_rgba(56,189,248,0.2)] animate-pulse"
              : "bg-zinc-900 hover:bg-zinc-850 hover:text-white border-zinc-800 text-zinc-300"
          }`}
        >
          <Search className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          <span>{isScanning ? "AUTO-SEEK SWEEPER ACTIVE..." : "RECHERCHER DU TRAFIC (AUTO-SCAN)"}</span>
        </button>
      </div>

      {/* Target Broadcast intercepted content, with reply hints */}
      {activeChannel.id === activeTrafficChannelId && trafficMessage && (
        <div className="bg-[#121c25]/45 border border-sky-900/45 p-3 rounded-2xl flex flex-col gap-2 mt-1 animate-fade-in">
          <div className="flex items-center justify-between text-[10px] font-bold pb-1.5 border-b border-sky-950">
            <span className="text-sky-400 flex items-center gap-1 uppercase">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
              INTERCEPT SURNATUREL LOCK
            </span>
            <span className="text-zinc-500">MOTO-SAT GW [A12]</span>
          </div>
          
          <div className="text-[11px] text-zinc-350 leading-relaxed italic pr-1">
            "{trafficMessage}"
          </div>

          {/* If the message concerns the operator */}
          {isConcernedToUser ? (
            <div className="flex items-start gap-1.5 bg-amber-950/20 border border-amber-900/30 p-2 rounded-xl text-[10px] text-amber-400 mt-1 leading-normal">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-400 animate-pulse flex-shrink-0" />
              <div>
                <span className="font-extrabold uppercase">DÉTECTION DIRECTE POUR VOUS ({codename}):</span> 
                <span className="block mt-0.5 text-zinc-400">Cette communication vous concerne directement ! Pressez le bouton <strong className="text-zinc-100 uppercase">PTT</strong> ou tapez votre réponse ci-contre pour répondre en temps réel.</span>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 bg-zinc-900/45 border border-zinc-850/50 p-2 rounded-xl text-[9px] text-zinc-450 mt-1 leading-normal">
              <Cpu className="w-4 h-4 text-zinc-550 flex-shrink-0" />
              <div>
                <span className="font-semibold uppercase text-zinc-400">CANAL DISCORDANT ACTIF:</span>
                <span className="block text-zinc-500 mt-0.5">Discutez en direct sur cette ligne de transit pour synchroniser la balise géospatiale de l'appareil.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
