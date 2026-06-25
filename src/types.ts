export interface Satellite {
  id: string;
  name: string;
  status: string;
  lon?: number;
  alt?: string;
  power: string;
  orbitType: string;
  azimuth?: number; // target degrees
  elevation?: number; // target degrees
  epoch?: string;
  tleText?: string;
  inclination?: number;
  meanMotion?: number;
  isLiveCelesTrak?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  frequency: string;
  description: string;
  isEncrypted: boolean;
}

export interface TransmissionLog {
  id: string;
  sender: "OPERATOR" | "SAT-STATION" | "SYSTEM";
  message: string;
  timestamp: string;
  audioUrl?: string;
  isFallback?: boolean;
}

export const CHANNELS_LIST: Channel[] = [
  { id: "sat-tac", name: "SAT-TACTICAL", frequency: "1.6164 GHz", description: "L-band Direct Space Link for Ground-to-Space command", isEncrypted: true },
  { id: "sat-emerg", name: "THOR-EMERGENCY", frequency: "1.6265 GHz", description: "Priority distress broadcast & orbital emergency coordination", isEncrypted: false },
  { id: "vhf-tac", name: "MIL-COMM VHF", frequency: "148.450 MHz", description: "VHF ground tactical team-relay (simulated local line-of-sight)", isEncrypted: true },
  { id: "uhf-sat", name: "UHF-SATCOM", frequency: "255.400 MHz", description: "Tactical ultra-high frequency satellite bounce relay", isEncrypted: false },
  { id: "space-relay", name: "INTER-SAT LINK", frequency: "1.6450 GHz", description: "Direct satellite crosslink for long-range cross-hemisphere relay", isEncrypted: true },
];
