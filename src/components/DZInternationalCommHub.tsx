import React, { useState, useEffect } from "react";
import { 
  Globe, 
  Radio, 
  Signal, 
  MessageSquare, 
  MapPin, 
  Volume2, 
  VolumeX, 
  Terminal, 
  Send, 
  Check, 
  AlertCircle, 
  Navigation, 
  Languages, 
  Zap, 
  ShieldAlert,
  Lock,
  Unlock,
  CornerDownLeft
} from "lucide-react";
import { playKeyClick, playScanBeep, playTalkPermitTone, playSquelchTail, playMilitaryRadioTTS, playRadioMessage } from "../utils/audio";
import { Channel, TransmissionLog } from "../types";

interface DZInternationalCommHubProps {
  onAddLog: (log: TransmissionLog) => void;
  codename: string;
  volume: number;
  linkStrength: number;
}

interface Station {
  id: string;
  name: string;
  country: "DZ" | "INT";
  flag: string;
  location: string;
  frequency: string;
  encryption: "AES-256" | "CLEAR" | "SCRAMBLED";
  signalStrength: number; // 0-100%
  description: string;
  systemPrompt: string; // Specific AI persona parameter
  sampleTransmissions: string[];
}

const STATIONS_LIST: Station[] = [
  // --- Algerian DZ Stations ---
  {
    id: "dz-sahara",
    name: "Garnison Militaire Sahara (In Salah)",
    country: "DZ",
    flag: "🇩🇿",
    location: "In Salah, Wilaya de Tamanrasset",
    frequency: "143.250 MHz",
    encryption: "AES-256",
    signalStrength: 94,
    description: "Réseau de patrouille frontalière et de sécurité tactique du grand désert.",
    systemPrompt: "You are the commander on duty of the Algerian Southern Frontier Force at the Sahara Military Outpost near In Salah (Algeria). Answer in tough, brief military French, mixing occasional brief Algerian military dialect words (like 'Sahha', 'Marhaban', 'Khoya', 'Kamel'). Mention sandstorms, desert patrol logistics, high heat (48°C), and guard post security. Keep it under 20 words. End with 'Terminé' or 'À vous'.",
    sampleTransmissions: [
      "Ici Garnison In Salah. Tempête de sable en formation sur le secteur Sud-Est. Toutes les patrouilles de gendarmerie repassent au point d'ancrage. À vous.",
      "Liaison satellite Moto-Sat sécurisée avec Alger. Convoi logistique en approche de Reggane. Aucun incident signalé. Terminé.",
      "Alerte intrusion radar thermique près du secteur frontalier. Unité d'interception blindée dépêchée sur site. Restez en veille. À vous."
    ]
  },
  {
    id: "dz-coastguard",
    name: "Garde Côtière Nationale d'Alger",
    country: "DZ",
    flag: "🇩🇿",
    location: "Secteur Maritime, Port d'Alger",
    frequency: "156.800 MHz (Canal 16)",
    encryption: "CLEAR",
    signalStrength: 98,
    description: "Secours côtier, trafic des navires et surveillance des eaux territoriales algériennes.",
    systemPrompt: "You are the Marine radio operator of the Algiers Coast Guard (Garde Côtière Nationale d'Alger). Respond in professional naval French. Mention the Bay of Algiers, Algiers Port traffic, patrol vessels, maritime weather, and search-and-rescue protocols. Keep it short (under 20 words). End with 'À vous' or 'Terminé'.",
    sampleTransmissions: [
      "Ici Station Garde Côtière d'Alger. Avis de brume côtière sur le flanc Ouest. Visibilité réduite à moins de deux milles nautiques. À vous.",
      "Bien reçu. Navire marchand de marchandises enregistré à destination du port d'Alger. Mouillage autorisé en zone d'attente Bravo. Terminé.",
      "Demande d'assistance d'un chalutier au large de Bouharoun. Vedette de sauvetage nationale dépêchée sur zone en urgence. À vous."
    ]
  },
  {
    id: "dz-oran-air",
    name: "Base Aérienne Militaire (Oran Tafraoui)",
    country: "DZ",
    flag: "🇩🇿",
    location: "Tafraoui Base, Wilaya d'Oran",
    frequency: "248.500 MHz",
    encryption: "SCRAMBLED",
    signalStrength: 88,
    description: "Contrôle des vols de défense, détections radar rattachées au commandement.",
    systemPrompt: "You are the Air Force traffic officer at the Algerian Military Air Base of Tafraoui in Oran. Answer in technical, crisp military French. Mention fighter jets (Su-30, MiG), runway status, spatial tracking, satellite alignment, and radar sweeps. Keep it under 25 words. End with 'Over' or 'Terminé'.",
    sampleTransmissions: [
      "Tafraoui Contrôle à toutes les escadrilles. Décollage immédiat de deux intercepteurs pour patrouille de routine secteur Ouest. À vous.",
      "Liaison montante Thuraya stabilisée à cent pour cent. Alignement horizontal des antennes validé. Transmettez coordonnées de calibration. À vous.",
      "Alerte déviance météo. Nuages instables de forte densité de passage sur le couloir aérien de l'Ouest. Transit déconseillé. Terminé."
    ]
  },
  {
    id: "dz-port",
    name: "Alger Port Control & Douanes DZ",
    country: "DZ",
    flag: "🇩🇿",
    location: "Capitainerie du Port de Béjaïa / Alger",
    frequency: "156.650 MHz",
    encryption: "CLEAR",
    signalStrength: 90,
    description: "Canal de régulation du fret, douanes portuaires et vérification de pavillons.",
    systemPrompt: "You are the cargo dispatcher at Algiers Port Control. Speak in professional civil/port French, brief and businesslike. Mention transport ships, cargo containers, Customs inspect checks, and weather. Keep it under 20 words.",
    sampleTransmissions: [
      "Port de Béjaïa. Déchargement du porte-conteneur suspendu suite à des rafales de vent instables. Reprise programmée à l'aube. À vous.",
      "Contrôle douanier en cours sur le Cargo pétrolier en provenance de Marseille. Documents d'import validés. Transit autorisé. Terminé."
    ]
  },
  {
    id: "dz-oran-port",
    name: "Raffinerie & Port Militaire d'Oran",
    country: "DZ",
    flag: "🇩🇿",
    location: "Zone Navale d'Oran, Algérie",
    frequency: "157.400 MHz",
    encryption: "AES-256",
    signalStrength: 91,
    description: "Sécurisation des terminaux de brut et patrouille maritime de l'Ouest algérien.",
    systemPrompt: "You are the security command sergeant at the Naval Oil Refinery and Port of Oran. Answer in energetic, strict military French. Mention oil terminal security, coastal patrols, and visual contact reports. Under 20 words. End with 'À vous' or 'Terminé'.",
    sampleTransmissions: [
      "Ici Contrôle Oran Raffinerie. Périmètre maritime sécurisé. Aucun écho sonar anormal ce matin. Température stable. À vous.",
      "Garnison d'Oran. Liaison trans-satellitaire validée. Activité normale sur les quais de chargement. Terminé."
    ]
  },
  {
    id: "dz-constantine-defense",
    name: "Défense Aérienne Constantine (Secteur Est)",
    country: "DZ",
    flag: "🇩🇿",
    location: "Constantine Base d'Écoute, Algérie",
    frequency: "262.100 MHz",
    encryption: "SCRAMBLED",
    signalStrength: 89,
    description: "La station d'alerte radar inter-ciel pour la surveillance et l'interception du flanc Est algérien.",
    systemPrompt: "You are the radar interception chief of the Algerian Air Defense Command in Constantine. Speak in sharp, highly technical radar-themed French. Mention tracking grid coordinates, airborne targets, and spatial sweeps. Under 20 words. End with 'Terminé'.",
    sampleTransmissions: [
      "Ici Constantine Radar. Balayage sectoriel actif. Trois cibles civiles indexées en altitude intermédiaire de transit. Signal clair. Terminé.",
      "Liaison montante calée. Trajectoire d'alignement satellite validée sur la grille Est. Transmettez. À vous."
    ]
  },
  {
    id: "dz-annaba-marine",
    name: "Base Navale Nationale de Annaba",
    country: "DZ",
    flag: "🇩🇿",
    location: "Base Flottille, Port de Annaba, Algérie",
    frequency: "156.900 MHz",
    encryption: "AES-256",
    signalStrength: 93,
    description: "Régulation tactique navale, escorte côtière et interception des contrebandes de l'Est.",
    systemPrompt: "You are the commander on duty at the Annaba Naval Command Base. Respond in authoritative, brief maritime French. Mention patrol gunboats, sea state, border coordination, and secure radio links. Under 20 words.",
    sampleTransmissions: [
      "Ici Base Navale de Annaba. Patrouilleur rapide engagé sur secteur frontalier Est. Mer force trois, visibilité bonne. À vous.",
      "Annaba Command. Reçu coordinates de calibration. Système d'écoute satellite optimisé de routine. Terminé."
    ]
  },
  {
    id: "dz-ouargla-recon",
    name: "Division de Reconnaissance Militaire (Ouargla)",
    country: "DZ",
    flag: "🇩🇿",
    location: "Forces Spéciales Recon, Ouargla, Algérie",
    frequency: "144.800 MHz",
    encryption: "SCRAMBLED",
    signalStrength: 87,
    description: "Renseignement de terrain saharien et coordination drone de haute altitude.",
    systemPrompt: "You are the tactical intelligence officer at Ouargla Recon Division. Answer in secretive, whispering, coded military French. Mention drone telemetries, desert reconnaissance, satellite sweeps, and secure ground grids. Under 20 words. End with 'Terminé'.",
    sampleTransmissions: [
      "Ici Recon Ouargla. Vecteur aérien non habité sur trajectoire optimale. Données thermiques transmises à la base. À vous.",
      "Signal sécurisé crypté actif. Unité de reconnaissance infiltrée sur zone de contrôle Sud. Pas d'anomalie enregistrée. Terminé."
    ]
  },
  {
    id: "dz-tindouf-outpost",
    name: "Poste Frontière Hautes Plaines (Tindouf)",
    country: "DZ",
    flag: "🇩🇿",
    location: "Tindouf Frontier Command, Algérie Ouest",
    frequency: "145.200 MHz",
    encryption: "AES-256",
    signalStrength: 91,
    description: "Surveillance de la zone frontalière Ouest, liaison directe avec le Commandement Supérieur.",
    systemPrompt: "You are the outpost communication sergeant at the Tindouf frontier garrison. Speak in high-alert, cautious, tactical French. Mention border wire patrols, desert sand heat, and strict watch status. Under 20 words. End with 'À vous'.",
    sampleTransmissions: [
      "Ici Poste Tindouf. Patrouilles de sécurité de retour à la garnison centrale. Température extrême sur le glacis. À vous.",
      "Liaison satellite Thuraya établie avec succès de routine. Rapports opérationnels vierges pour ce créneau. Terminé."
    ]
  },
  // --- International Stations ---
  {
    id: "int-marseille",
    name: "Sauvetage Méditerranée (CROSS-Med France)",
    country: "INT",
    flag: "🇫🇷",
    location: "La Garde, France • Zone Sud",
    frequency: "156.300 MHz",
    encryption: "CLEAR",
    signalStrength: 82,
    description: "Sauvetage en mer et coordination radio d'urgence en Méditerranée occidentale.",
    systemPrompt: "You are the chief operator at CROSS Med (La Garde, France), the French Mediterranean Maritime Rescue and Coordination Center. Answer in calm, highly professional French rescue dispatcher tone. Mention maritime coordinates, distress beacons, gale alerts, and helicopters. Under 20 words.",
    sampleTransmissions: [
      "Ici CROSS Méditerranée. Message de sécurité urgent à tous les navigateurs. Fortes houles signalées sur le secteur de la Corse. Restez prudents. À vous.",
      "Reçu SOS. Coordonnées de l'embarcation interceptées. Hélicoptère Dragon de la Sécurité Civile en cours de décollage. Tenez bon. À vous."
    ]
  },
  {
    id: "int-paris-air",
    name: "Relais Aérien Route Internationale (Paris Control)",
    country: "INT",
    flag: "🇫🇷",
    location: "Aéroport Charles de Gaulle, France",
    frequency: "121.500 MHz (Garde)",
    encryption: "CLEAR",
    signalStrength: 78,
    description: "Fréquence internationale d'urgence aéronautique civile et militaire.",
    systemPrompt: "You are the emergency air controller at Paris Air Control Center on the international guard channel (121.5 MHz). Respond in standard professional English or French airline pilot style. Mention altitude, heading, transponder codes (Squawk), and radar lock. Under 22 words.",
    sampleTransmissions: [
      "Alerte détresse reçue sur fréquence de garde cent vingt et un virgule cinq. Appareil non identifié identifié à trente mille pieds. Répondez. À vous.",
      "Paris Control to all units. General frequency check on orbital satellite link backup routers. Signal clear five five. Out."
    ]
  },
  {
    id: "int-usnavy",
    name: "6ème Flotte Command (USS Mount Whitney)",
    country: "INT",
    flag: "🇺🇸",
    location: "Commandant de bord Mobile, Mer Méditerranée",
    frequency: "311.000 MHz",
    encryption: "AES-256",
    signalStrength: 80,
    description: "Relais radio de la marine américaine pour les opérations combinées inter-alliés.",
    systemPrompt: "You are the communications officer aboard the USS Mount Whitney, flagship of the US Navy Sixth Fleet in the Mediterranean. Answer in authoritative, cold, high-tech English. Mention satellite links, fleet patrols, allied forces, or stealth parameters. Keep under 20 words. End with 'Roger, out' or 'Over'.",
    sampleTransmissions: [
      "This is sixth fleet mobile command. Secure satellite uplink active on Channel Delta-12. Proceed with tactical data packet transfer. Over.",
      "Roger, ground operator alpha-1. Signal received strength seven. Cryptographic keys validated. Report terrain metrics. Out."
    ]
  },
  {
    id: "int-geneva",
    name: "Croix Rouge Internationale (Genève Central)",
    country: "INT",
    flag: "🇨🇭",
    location: "Quartier Général, Genève, Suisse",
    frequency: "145.600 MHz",
    encryption: "CLEAR",
    signalStrength: 75,
    description: "Service de dispatch de crise globale et de secours médicaux neutres à l'étranger.",
    systemPrompt: "You are the crisis dispatcher at the International Red Cross HQ in Geneva. Respond in neutral, calm, humanitarian-focused French. Mention logistical assistance, medicine shipments, local NGOs, and secure corridor access. Under 20 words. End with 'Over'.",
    sampleTransmissions: [
      "Ici Dispatch Genève. Envoi approuvé de deux convois humanitaires de premiers secours vers la frontière saharienne. Convoi neutre sécurisé. À vous.",
      "Bien reçu. Demande en médicaments d'urgence enregistrée pour le personnel médical d'In Salah. Convoi en cours de routage. Terminé."
    ]
  },
  {
    id: "int-dgse",
    name: "Réseau de Transmission DGSE (France)",
    country: "INT",
    flag: "🇫🇷",
    location: "Centre de Transmission Souterrain, France",
    frequency: "284.400 MHz",
    encryption: "AES-256",
    signalStrength: 81,
    description: "Liaisons de renseignement et coordination tactique pour les opérations extérieures françaises.",
    systemPrompt: "You are a French DGSE intelligence officer at the underground transmission center. Speak in extremely cold, professional, highly coded French. Mention security levels, encrypted packets, and stealth networks. Under 20 words.",
    sampleTransmissions: [
      "Ici Centre S-9. Liaison sécurisée cryptée opérationnelle. Téléchargez le paquet d'analyse aérologique sur canal dédié. À vous.",
      "Message enregistré cinq sur cinq. Données géographiques intégrées dans la grille tactique sectorielle. Terminé."
    ]
  },
  {
    id: "int-maroc-marine",
    name: "Garde Côtière Royale Marocaine",
    country: "INT",
    flag: "🇲🇦",
    location: "Commandement de Tanger, Maroc",
    frequency: "156.450 MHz",
    encryption: "CLEAR",
    signalStrength: 86,
    description: "Régulation côtière navale du détroit et secours maritimes.",
    systemPrompt: "You are the marine controller at the Royal Moroccan Coast Guard in Tangier. Speak in helpful, nautical French with Moroccan phrasing. Mention strait traffic, rescue boats, and sea swell. Under 20 words.",
    sampleTransmissions: [
      "Ici Garde Côtière Tanger. Déploiement d'une vedette rapide d'identification en cours au Nord d'Assilah. Mer agitée. À vous.",
      "Tanger Port. Liaison radio reçue de routine, mon frère. Canal dégagé de toute urgence sur ce secteur. Terminé."
    ]
  },
  {
    id: "int-tunisie-coordination",
    name: "Poste de Sécurité Mixte (Tunisie Ouest)",
    country: "INT",
    flag: "🇹🇳",
    location: "Poste Frontière de Kasserine, Tunisie",
    frequency: "144.350 MHz",
    encryption: "SCRAMBLED",
    signalStrength: 89,
    description: "Liaison d'interconnexion sécurisée pour la patrouille transfrontalière saharienne.",
    systemPrompt: "You are the communication watch officer of the Tunisian National Security at Kasserine Outpost. Answer in professional Tunisian-flavored French. Mention mountain border security, mutual liaison, and satellite voice quality. Under 20 words.",
    sampleTransmissions: [
      "Ici Poste de Kasserine. Patrouille mixte opérationnelle le long du flanc Ouest. Pas d'écho ou de franchissement suspect. À vous.",
      "Bien reçu station soeur. Qualité audio excellente sur ce relais satellite d'interconnexion. Terminé."
    ]
  },
  {
    id: "int-mauritanie-desert",
    name: "Patrouille du Sahel (Nouakchott, Mauritanie)",
    country: "INT",
    flag: "🇲🇷",
    location: "Garnison Désertique de Nouakchott, Mauritanie",
    frequency: "143.900 MHz",
    encryption: "CLEAR",
    signalStrength: 79,
    description: "Surveillance nomade et lutte contre la contrebande sahélienne.",
    systemPrompt: "You are the Mauritanian military comms sergeant in the Sahel Frontier Patrol. Respond in friendly, brief, desert military French. Mention sand winds, long camel patrol paths, and satellite link power. Under 20 words.",
    sampleTransmissions: [
      "Ici Patrouille Sahel. Halte nocturne déclarée près des coordonnées de puits sécurisé. Pas de contact. À vous.",
      "Station Mauritanie opérationnelle. Signal radio fluctuant mais liaison vocale lisible. Transmettez. À vous."
    ]
  },
  {
    id: "int-mali-un",
    name: "Unité Maintien de la Paix (Bamako, Mali)",
    country: "INT",
    flag: "🇲🇱",
    location: "Base Multinationale, Bamako, Mali",
    frequency: "145.450 MHz",
    encryption: "AES-256",
    signalStrength: 76,
    description: "Liaisons de sécurité onusiennes pour la coordination tactique au Mali.",
    systemPrompt: "You are the UN peacekeeping tactical radio coordinator based in Bamako, Mali. Speak in precise, calm, bureaucratic military French. Mention logistics convoys, UN coordinates, and security checkpoints. Under 20 words.",
    sampleTransmissions: [
      "Ici Bamako Central. Convoi d'aide médicale du Croissant Rouge en route sous escorte sécurisée. À vous.",
      "Liaison satellite Beny-Joe active cinq sur cinq. Transmission claire des statuts terrain de Bamako. Terminé."
    ]
  }
];

export default function DZInternationalCommHub({
  onAddLog,
  codename,
  volume,
  linkStrength
}: DZInternationalCommHubProps) {
  const [filter, setFilter] = useState<"ALL" | "DZ" | "INT">("ALL");
  const [selectedStation, setSelectedStation] = useState<Station>(STATIONS_LIST[0]);
  const [tunedStation, setTunedStation] = useState<Station | null>(null);
  const [autoListenActive, setAutoListenActive] = useState<boolean>(true);
  
  // Real-time chatter Simulation
  const [currentIntercept, setCurrentIntercept] = useState<string>("");
  const [timeUntilNextIntercept, setTimeUntilNextIntercept] = useState<number>(12);
  const [interceptsLogs, setInterceptsLogs] = useState<Array<{ id: string; stationName: string; text: string; time: string }>>([]);

  // Live direct link transmission
  const [inputText, setInputText] = useState<string>("");
  const [isTransmittingLink, setIsTransmittingLink] = useState<boolean>(false);
  const [interactiveReplies, setInteractiveReplies] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const [isTypingReply, setIsTypingReply] = useState<boolean>(false);

  // Automatically cycle/receive random intercepts from tuned or hovered stations!
  useEffect(() => {
    if (!autoListenActive || !tunedStation) return;

    // Countdown timer till next random intercept
    const countdown = setInterval(() => {
      setTimeUntilNextIntercept((prev) => {
        if (prev <= 1) {
          // Trigger random station chatter
          triggerRandomChatter();
          return Math.floor(Math.random() * 8) + 12; // 12-20s interval
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [tunedStation, autoListenActive]);

  // Handle active station tune beep
  const tuneToStation = (station: Station) => {
    playScanBeep();
    setTunedStation(station);
    setSelectedStation(station);
    setTimeUntilNextIntercept(5); // Quickly trigger first intercept when changing station!
    setCurrentIntercept("");
    
    onAddLog({
      id: "TUNE_" + Math.random().toString(),
      sender: "SYSTEM",
      message: `[COM-INFO] SYNC COMPLÈTE SUR : ${station.name} (${station.frequency}). FORCE DU SIGNAL : ${station.signalStrength}%.`,
      timestamp: new Date().toLocaleTimeString()
    });

    playMilitaryRadioTTS(`Fréquence calée sur ${station.frequency}. Station d'écoute : ${station.name}.`);
  };

  const triggerRandomChatter = () => {
    if (!tunedStation) return;
    const samples = tunedStation.sampleTransmissions;
    const randomText = samples[Math.floor(Math.random() * samples.length)];
    
    setCurrentIntercept(randomText);

    // Save it as local log
    const indexStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const nowTime = new Date().toLocaleTimeString();
    
    // Auto-read aloud in French military TTS matching user instruction
    playMilitaryRadioTTS(randomText);

    setInterceptsLogs(prev => [
      {
        id: indexStr,
        stationName: tunedStation.name,
        text: randomText,
        time: nowTime
      },
      ...prev.slice(0, 19)
    ]);

    // Push into global App log
    onAddLog({
      id: "LOG_" + indexStr,
      sender: "SAT-STATION",
      message: `[INTERCEPT ${tunedStation.flag} ${tunedStation.name}] ${randomText}`,
      timestamp: nowTime
    });
  };

  // Human replies dynamic transmission via server-side Gemini 3.5 API securely proxying!
  const transmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageToSend = inputText.trim();
    setInputText("");
    setIsTransmittingLink(true);
    playTalkPermitTone();

    const timestampStr = new Date().toLocaleTimeString();
    
    // Add operator's message to the terminal chat logs
    setInteractiveReplies(prev => [
      ...prev,
      { sender: "VOUS (OPERATOR)", text: messageToSend, time: timestampStr }
    ]);

    // Add into global logs
    onAddLog({
      id: "TX_OPERATOR_" + Math.random().toString(),
      sender: "OPERATOR",
      message: `[MOTO-SAT DIRECT -> ${selectedStation.flag} ${selectedStation.name}] ${messageToSend}`,
      timestamp: timestampStr
    });

    setIsTypingReply(true);

    try {
      // Connect to the actual server `/api/radio/transmit` endpoint!
      const response = await fetch("/api/radio/transmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          frequency: selectedStation.frequency,
          channelName: `ST-DZ-${selectedStation.id.toUpperCase()}`,
          encryptActive: selectedStation.encryption === "AES-256",
          voiceName: "Fenrir",
          identityGuide: selectedStation.systemPrompt
        })
      });

      const resData = await response.json();
      const replyTime = new Date().toLocaleTimeString();
      setIsTypingReply(false);
      setIsTransmittingLink(false);

      if (resData.text) {
        // Feed direct responses to visual channel
        setInteractiveReplies(prev => [
          ...prev,
          { sender: selectedStation.name, text: resData.text, time: replyTime }
        ]);

        // Play response with realistic military tactical radio effects (squelch + bip PTT)
        playMilitaryRadioTTS(resData.text);

        // Push reply to global logs
        onAddLog({
          id: "TX_REPLY_" + Math.random().toString(),
          sender: "SAT-STATION",
          message: `[RÉPONSE DIRECTE ${selectedStation.flag} ${selectedStation.name}] ${resData.text}`,
          timestamp: replyTime
        });
      }
    } catch (err: any) {
      console.warn("API direct send failed, generating high-fidelity offline proxy prompt:", err);
      
      // Smart local response simulator if API is blocked or offline!
      setTimeout(() => {
        setIsTypingReply(false);
        setIsTransmittingLink(false);

        let localFallbackText = `[SQUELCH] Ici ${selectedStation.name}. Signal perturbé. Transmettez à niveau. Bien reçu le message pour l'antenne. Terminé.`;
        if (messageToSend.toLowerCase().includes("aide") || messageToSend.toLowerCase().includes("secour") || messageToSend.toLowerCase().includes("sos")) {
          localFallbackText = `[URGENT] Ici ${selectedStation.name}. Message de détresse enregistré. Nos équipes de patrouille analysent vos coordonnées Thuraya. Restez en veille active. À vous.`;
        } else if (messageToSend.toLowerCase().includes("météo") || messageToSend.toLowerCase().includes("tempête")) {
          localFallbackText = `[METEO] Ici ${selectedStation.name}. Couvercle nuageux et tempête magnétique de grade 3 actifs sur notre secteur de transmission. Liaison menacée. À vous.`;
        } else if (messageToSend.toLowerCase().includes("position") || messageToSend.toLowerCase().includes("coordonné")) {
          localFallbackText = `[GPS COORDS] Ici ${selectedStation.name}. Liaison orbitale Moto-Sat active. Coordonnées de calibration reçues cinq sur cinq. Liaison stable. Terminé.`;
        }

        const replyTime = new Date().toLocaleTimeString();
        setInteractiveReplies(prev => [
          ...prev,
          { sender: selectedStation.name, text: localFallbackText, time: replyTime }
        ]);

        playMilitaryRadioTTS(localFallbackText);

        onAddLog({
          id: "TX_REPLY_OFFLINE_" + Math.random().toString(),
          sender: "SAT-STATION",
          message: `[RÉPONSE DIRECTE ${selectedStation.flag} ${selectedStation.name}] ${localFallbackText}`,
          timestamp: replyTime
        });
      }, 1500);
    }
  };

  const filteredStations = STATIONS_LIST.filter(station => {
    if (filter === "ALL") return true;
    return station.country === filter;
  });

  return (
    <div className="bg-zinc-950 rounded-3xl border border-zinc-850 p-4 md:p-6 shadow-2xl font-mono text-zinc-300 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative min-h-[520px]">
      
      {/* Decorative military water-marks */}
      <div className="absolute top-2 right-4 text-[9px] text-zinc-750 font-black pointer-events-none select-none tracking-widest uppercase">
        ALGERIA-SATELLITE INT-ROUTING HUB // L-BAND GW3
      </div>

      {/* Main Left Pane: Stations List & Tuning Control (Col-Span 7) */}
      <section className="lg:col-span-7 flex flex-col gap-4">
        
        {/* Header Widget */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-850 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/40 text-emerald-400 border border-emerald-900 rounded-xl">
              <Globe className="w-5 h-5 text-emerald-450 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Liaisons Nationales DZ & Internationales
              </h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Balayage des canaux côtiers et militaires d'Algérie et d'Europe
              </p>
            </div>
          </div>

          {/* Selector filters */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-center">
            <button
              onClick={() => { playKeyClick(); setFilter("ALL"); }}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                filter === "ALL" 
                  ? "bg-zinc-850 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              TOUTES
            </button>
            <button
              onClick={() => { playKeyClick(); setFilter("DZ"); }}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                filter === "DZ" 
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60"
                  : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              🇩🇿 ALGÉRIE
            </button>
            <button
              onClick={() => { playKeyClick(); setFilter("INT"); }}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all cursor-pointer ${
                filter === "INT" 
                  ? "bg-indigo-950/60 text-indigo-400 border border-indigo-900/60"
                  : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              🌐 GLOBAL
            </button>
          </div>
        </div>

        {/* Tune Broadcast Status Banner */}
        <div className="bg-zinc-900/40 p-3 rounded-2xl border border-zinc-850/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Radio className={`w-4 h-4 ${tunedStation ? "text-emerald-400 animate-pulse" : "text-zinc-650"}`} />
            <div>
              <span className="text-zinc-500 uppercase text-[10px] block">Radio écoute active:</span>
              {tunedStation ? (
                <span className="font-bold text-white text-[11px] flex items-center gap-1.5">
                  <span className="text-zinc-400">{tunedStation.flag}</span> 
                  <span className="truncate max-w-[200px] sm:max-w-none">{tunedStation.name}</span>
                  <span className="text-emerald-400 font-mono text-[10px]">({tunedStation.frequency})</span>
                </span>
              ) : (
                <span className="text-zinc-400 italic font-medium">Aucune station calée (Sélectionnez ci-dessous)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {tunedStation && (
              <div className="flex items-center gap-1.5 text-[10px] bg-zinc-900/80 px-2 py-1 rounded-lg border border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-zinc-450 text-[9px]">Intercept dans:</span>
                <strong className="text-emerald-400">{timeUntilNextIntercept}s</strong>
              </div>
            )}
            
            <button
              onClick={() => {
                playKeyClick();
                setAutoListenActive(!autoListenActive);
              }}
              className={`p-1.5 rounded-xl border cursor-pointer transition-all ${
                autoListenActive 
                  ? "bg-emerald-950/10 text-emerald-400 border-emerald-900/50" 
                  : "bg-zinc-900 text-zinc-650 border-zinc-850"
              }`}
              title={autoListenActive ? "Couper l'écoute automatique des transmissions" : "Activer l'écoute automatique"}
            >
              {autoListenActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Channels/Stations List */}
        <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
          {filteredStations.map((station) => {
            const isSelected = selectedStation.id === station.id;
            const isTuned = tunedStation?.id === station.id;

            return (
              <div
                key={station.id}
                onClick={() => { setSelectedStation(station); playKeyClick(); }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected 
                    ? "bg-zinc-900/55 border-zinc-700 shadow-lg ring-1 ring-white/5" 
                    : "bg-zinc-900/15 border-zinc-900 hover:border-zinc-850/70"
                }`}
              >
                {/* Visual Signal Indicator overlay */}
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{station.flag}</span>
                    <span className="font-bold text-white text-[11px] truncate">{station.name}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[9px]">
                    <span className="text-zinc-550">{station.frequency}</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                      station.encryption === "AES-256" 
                        ? "bg-amber-950/40 text-amber-400 border border-amber-900/30"
                        : station.encryption === "SCRAMBLED"
                        ? "bg-indigo-950/40 text-indigo-400 border border-indigo-900/30"
                        : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    }`}>
                      {station.encryption}
                    </span>
                  </div>
                </div>

                {/* Subtitle location / telemetry info */}
                <div className="text-[9px] text-zinc-500 flex items-center gap-1 mb-2">
                  <MapPin className="w-3 h-3 text-zinc-650" />
                  <span className="truncate">{station.location}</span>
                </div>

                <div className="text-[10px] text-zinc-400 leading-normal pl-1 border-l-2 border-zinc-800 italic pr-1 mb-2.5">
                  "{station.description}"
                </div>

                {/* Meter and buttons */}
                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-zinc-850/40">
                  <div className="flex items-center gap-2 w-1/3">
                    <Signal className="w-3.5 h-3.5 text-zinc-650 shrink-0" />
                    <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${isTuned ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-700"}`}
                        style={{ width: `${station.signalStrength}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-bold shrink-0">{station.signalStrength}%</span>
                  </div>

                  <div className="flex items-center gap-2 font-black">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        tuneToStation(station);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[9px] tracking-wider border cursor-pointer transition-all flex items-center gap-1 ${
                        isTuned 
                          ? "bg-emerald-950/40 text-emerald-450 border-emerald-900/60 shadow-[0_0_8px_rgba(52,211,153,0.1)] font-extrabold"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                      }`}
                    >
                      <Radio className="w-3 h-3 shrink-0" />
                      {isTuned ? "EN ÉCOUTE" : "CALER CANAL"}
                    </button>

                    <button
                      onClick={(e) => {
                        // Just sets focus/active selection
                        e.stopPropagation();
                        setSelectedStation(station);
                        playKeyClick();
                        playTalkPermitTone();
                      }}
                      className="px-3 py-1.5 rounded-xl text-[9px] tracking-wider border bg-zinc-900 border-zinc-850 text-sky-400 hover:text-sky-300 hover:border-zinc-750 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3 text-sky-400 shrink-0" />
                      ÉTABLIR COM
                    </button>
                  </div>
                </div>

                {/* Animated status glow */}
                {isTuned && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Right Pane: Interactive Link Terminal (Col-Span 5) */}
      <section className="lg:col-span-5 flex flex-col justify-between bg-[#0b0f15]/80 p-4 rounded-3xl border border-zinc-900 gap-4">
        
        {/* Terminal Title */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-450 animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-sky-400 uppercase">
              TERMINAL TRANS-TACTIQUE
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[8px] text-zinc-600 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900">
            {selectedStation.encryption === "AES-256" ? (
              <span className="text-amber-500 font-bold flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> ACCÈS CRYPTÉ
              </span>
            ) : (
              <span className="text-zinc-500 font-bold flex items-center gap-1">
                <Unlock className="w-2.5 h-2.5" /> ACCÈS LIBRE
              </span>
            )}
          </div>
        </div>

        {/* Selected target metadata preview */}
        <div className="bg-[#10151f] p-3 rounded-2xl border border-sky-950 flex flex-col gap-1.5">
          <div className="text-[9px] text-zinc-500 uppercase block tracking-wider font-extrabold">STATION SÉLECTIONNÉE:</div>
          <div className="text-xs text-white font-bold flex items-center gap-1.5">
            <span>{selectedStation.flag}</span>
            <span className="truncate">{selectedStation.name}</span>
          </div>
          <div className="text-[9px] text-zinc-450 flex items-center gap-2">
            <span>Fréq: <strong className="text-sky-400 font-mono">{selectedStation.frequency}</strong></span>
            <span>•</span>
            <span>Signal: <strong className="text-emerald-400 font-mono">{selectedStation.signalStrength}%</strong></span>
          </div>
        </div>

        {/* Console Chat Logs */}
        <div className="bg-[#070a10] border border-zinc-950 p-3 rounded-2xl h-[220px] overflow-y-auto flex flex-col gap-3 font-mono text-[10px] pr-1.5">
          
          {/* Welcome baseline help */}
          <div className="text-zinc-650 leading-relaxed text-[9px] italic border-b border-zinc-950 pb-2">
            Système d'inter-satellite MOTO-SAT crypté en transit direct. Tapez un rapport opérationnel à destination de la station ci-dessous pour forcer un relevé.
          </div>

          {interactiveReplies.length === 0 ? (
            <div className="text-zinc-600 italic text-[9px] flex items-center gap-1.5 mt-8 justify-center">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-700" />
              Aucun flux de données actif. Envoyez un message.
            </div>
          ) : (
            interactiveReplies.map((reply, index) => {
              const isMe = reply.sender.includes("VOUS");
              return (
                <div 
                  key={index} 
                  className={`flex flex-col gap-1.5 p-2 rounded-xl border leading-relaxed ${
                    isMe 
                      ? "bg-zinc-900/40 border-zinc-850/50 self-end max-w-[90%] text-zinc-350" 
                      : "bg-[#101a24]/50 border-sky-950/45 self-start max-w-[90%] text-sky-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[8px] font-bold text-zinc-550 border-b border-zinc-950/20 pb-0.5">
                    <span className={isMe ? "text-zinc-450" : "text-sky-400 flex items-center gap-1"}>
                      {!isMe && <span className="w-1 h-1 bg-sky-400 rounded-full animate-ping" />}
                      {reply.sender}
                    </span>
                    <span>{reply.time}</span>
                  </div>
                  <div className="text-[10px] font-mono leading-relaxed break-words">
                    {reply.text}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing simulation */}
          {isTypingReply && (
            <div className="bg-[#101a24]/20 border border-sky-955/20 max-w-[200px] p-2 rounded-xl self-start flex items-center gap-2 text-sky-450 text-[9px] font-bold animate-pulse">
              <Zap className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
              RELAIS SATCOM EN SYNTHÈSE...
            </div>
          )}
        </div>

        {/* Input Text Forms and Action Button */}
        <form onSubmit={transmitMessage} className="flex flex-col gap-2">
          
          {/* Input field */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isTransmittingLink}
              placeholder={`Contacter la station en temps réel...`}
              className="w-full bg-[#05070a] border border-zinc-850 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-sky-850/80 focus:ring-1 focus:ring-sky-850/40 transition-all text-ellipsis"
            />
            <button
              type="submit"
              disabled={isTransmittingLink || !inputText.trim()}
              className="absolute right-2 p-1.5 rounded-xl text-sky-400 hover:text-sky-305 transition-all cursor-pointer disabled:text-zinc-700 disabled:cursor-not-allowed"
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Quick preset phrases */}
          <div className="flex flex-wrap gap-1 bg-[#05070a]/50 p-1.5 rounded-xl border border-zinc-900/60">
            <button
              type="button"
              onClick={() => { playKeyClick(); setInputText("Demande de rapport de situation. À vous."); }}
              className="px-2 py-0.5 rounded text-[8px] border border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-400 transition-all cursor-pointer"
            >
              Rapport d'État
            </button>
            <button
              type="button"
              onClick={() => { playKeyClick(); setInputText("Ici opérateur terrain. Liaison satellite Moto-Sat validée. Comment me recevez-vous? À vous."); }}
              className="px-2 py-0.5 rounded text-[8px] border border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-400 transition-all cursor-pointer"
            >
              Vérifier Liaison
            </button>
            <button
              type="button"
              onClick={() => { playKeyClick(); setInputText("Alerte tempête de sable et brouillage magnétique détecté dans le secteur. Demande de déviation. Terminé."); }}
              className="px-2 py-0.5 rounded text-[8px] border border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-400 transition-all cursor-pointer"
            >
              Alerte Météo/Brouillage
            </button>
          </div>

          <button
            type="submit"
            disabled={isTransmittingLink || !inputText.trim()}
            className={`w-full py-2 px-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              inputText.trim()
                ? "bg-sky-950/85 text-sky-400 border-sky-850/60 hover:bg-sky-900/70 shadow-[0_0_10px_rgba(56,189,248,0.1)] shrink-0"
                : "bg-zinc-900 text-zinc-650 border-zinc-950 cursor-not-allowed shrink-0"
            }`}
          >
            <Send className="w-4.5 h-4.5" />
            <span className="uppercase">EMETTRE DEPECHE SATELLITE</span>
          </button>
        </form>
      </section>

      {/* Broadcast Intercept Logs List at bottom */}
      <section className="lg:col-span-12 mt-2 pt-4 border-t border-zinc-890 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900/60 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase">
            <Languages className="w-4 h-4 text-emerald-450" />
            Historique d'Interception en Temps Réel (Algérien & Int)
          </div>
          <div className="text-[9px] text-zinc-600">
            Flux de transit passif • {interceptsLogs.length} enregistrements
          </div>
        </div>

        {interceptsLogs.length === 0 ? (
          <div className="text-zinc-600 italic text-[10px] text-center py-6 bg-zinc-900/10 rounded-2xl border border-zinc-900/50">
            Aucun message intercepté pour l'instant. Réglez une station et activez l'écoute automatique.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto">
            {interceptsLogs.map((log) => (
              <div 
                key={log.id} 
                className="bg--zinc-950 text-[10px] p-2.5 rounded-xl border border-zinc-900/60 flex flex-col gap-1 text-zinc-400"
              >
                <div className="flex items-center justify-between text-[8px] font-bold text-zinc-550">
                  <span className="text-zinc-350">{log.stationName}</span>
                  <span>{log.time}</span>
                </div>
                <p className="font-mono leading-relaxed italic text-zinc-400">
                  "{log.text}"
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
