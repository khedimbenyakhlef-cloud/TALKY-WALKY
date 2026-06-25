import React, { useState, useEffect } from "react";
import { Cpu, ShieldAlert, Key, Terminal, RefreshCw, FileText, Database, HardDrive, CheckCircle2 } from "lucide-react";
import { playKeyClick, playScanBeep } from "../utils/audio";

interface SipUser {
  id: string;
  name: string;
  status: "REGISTERED" | "IDLE" | "OFFLINE";
  ping: number;
  codec: string;
}

export default function CloudAsteriskOps() {
  const [jwtKey, setJwtKey] = useState("JWT_TK_082d49e7b23c");
  const [rotationCounter, setRotationCounter] = useState(24); // hours left in 24h key rotation
  const [sipUsers, setSipUsers] = useState<SipUser[]>([]);
  
  // Certificate state
  const [certDeviceName, setCertDeviceName] = useState("MOTO-FIELD-01");
  const [certBitLength, setCertBitLength] = useState("2048");
  const [signingLog, setSigningLog] = useState<string>("");
  const [issuedCert, setIssuedCert] = useState<string>("");
  const [isSigning, setIsSigning] = useState(false);

  // PostgreSQL simulated reads/writes
  const [postgresRecordCount, setPostgresRecordCount] = useState(1482);
  const [s3AudioCount, setS3AudioCount] = useState(239);
  const [simulatedLoad, setSimulatedLoad] = useState(12);
  const [isRealAsterisk, setIsRealAsterisk] = useState(false);
  const [activeChannels, setActiveChannels] = useState(2);

  const fetchAsteriskStatus = async () => {
    try {
      const response = await fetch("/api/asterisk/status");
      const resData = await response.json();
      if (resData.success && resData.data) {
        setSimulatedLoad(resData.data.load);
        setActiveChannels(resData.data.channelsCount);
        setSipUsers(resData.data.endpoints);
        setIsRealAsterisk(resData.mode === "real");
      }
    } catch (err) {
      console.warn("Could not retrieve Asterisk status:", err);
    }
  };

  useEffect(() => {
    fetchAsteriskStatus();
    const interval = setInterval(() => {
      fetchAsteriskStatus();
      setRotationCounter((prev) => (prev <= 1 ? 24 : prev - 1));
      setPostgresRecordCount((prev) => prev + Math.floor(Math.random() * 3));
      setS3AudioCount((prev) => prev + (Math.random() > 0.85 ? 1 : 0));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleRotateKey = () => {
    playScanBeep();
    const hex = Math.random().toString(16).substring(2, 14);
    setJwtKey(`JWT_TK_${hex}`);
    setRotationCounter(24);
  };

  const handleGenerateCertificate = () => {
    if (!certDeviceName.trim()) return;
    setIsSigning(true);
    playKeyClick();
    setIssuedCert("");
    setSigningLog("CRYPTOGRAPHIC INITIATION:\n");

    setTimeout(() => {
      setSigningLog((prev) => prev + `[STATUS] Resolving device id: ${certDeviceName}...\n`);
    }, 400);

    setTimeout(() => {
      setSigningLog((prev) => prev + `[STATUS] Generating RSA ${certBitLength}-bit Prime Factors (p, q)...\n`);
    }, 1000);

    setTimeout(() => {
      setSigningLog((prev) => prev + `[STATUS] Applying SHA-256 Digest Signature algorithm...\n`);
    }, 1600);

    setTimeout(() => {
      const serialNum = Math.floor(Math.random() * 90000 + 10000);
      const uuid = Math.random().toString(36).substring(2, 10).toUpperCase();

      const certText = `-----BEGIN CERTIFICATE-----
MIIEpTCCAw2gAwIBAgIU${uuid}WDcca3M4NDgyODAy
MA0GCSqGSIb3DQEBCwUAMGwxCzAJBgNVBAYTAkZSMQwwCgYDVQQIDANJZkQxDjAM
BgNVBAcMBUZpZWxkMRIwEAYDVQQKDAlNT1RPLVNBVDEUMBIGA1UEAwwL${certDeviceName.toUpperCase()}
MB4XDTI2MDUyODExNDgyNFoXDTM2MDUyODExNDgyNFowbDELMAkGA1UEBhMCRlIx
DDAKBgNVBAgMA0lmRDEOMAwGA1UEBwwFRmllbGQxEjAQBgNVBAoMCU1PVE8tU0FU
MREwDwYDVQQDDAhIUSA4OTIyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAwU9h6K8vK9Xh+g3B9g9l9+j8b3y44X/K3h2C1vX/b2vH6+k3B9hE6h3Bv/I3
${uuid.substring(0, 4)}Y0hBq2kXN8XJ6mN8f7y7vK9fX8w9bM9N2bV9bM9N2bV9bM9f3wDwA
-----END CERTIFICATE-----`;

      setIssuedCert(certText);
      setIsSigning(false);
      playScanBeep();
    }, 2500);
  };

  return (
    <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 shadow-2xl relative font-mono text-zinc-300 grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT COLUMN: VoIP SIP Register Panel (Asterisk Console) */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-900">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Asterisk PBX / VoIP Endpoint Matrix
          </h2>
        </div>

        {/* SIP Clients registrars */}
        <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-1.5 border-b border-zinc-900">
            <span className="font-extrabold text-[9px] uppercase">
              ACTIFS SIP ENDPOINTS ({activeChannels} Active Channels)
            </span>
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider border ${
              isRealAsterisk 
                ? "bg-emerald-950 text-emerald-400 border-emerald-900" 
                : "bg-zinc-900 text-zinc-500 border-zinc-850"
            }`}>
              {isRealAsterisk ? "LIVE ARI PBX" : "SIMULATED PBX"}
            </span>
          </div>

          <div className="flex flex-col gap-2 p-1 max-h-[220px] overflow-y-auto divide-y divide-zinc-900 scrollbar-thin">
            {sipUsers.map((user) => (
              <div key={user.id} className="pt-2 pb-2.5 first:pt-0 flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="font-bold text-white truncate text-[11px]">{user.name}</span>
                  <span className="text-[10px] text-zinc-550 leading-none mt-1">Codec: {user.codec}</span>
                </div>
                
                <div className="flex items-center gap-2.5">
                  {user.status === "REGISTERED" ? (
                    <>
                      <span className="text-emerald-500 font-bold text-[10px] flex items-center gap-1 bg-[#091509] border border-emerald-900/60 px-1.5 py-0.5 rounded leading-none uppercase">
                        ONLINE
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono text-right">{user.ping}ms</span>
                    </>
                  ) : user.status === "IDLE" ? (
                    <>
                      <span className="text-amber-500 font-semibold text-[10px] flex items-center gap-1 bg-[#1c1809] border border-amber-900/60 px-1.5 py-0.5 rounded leading-none">
                        STANDBY
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">LTE Fallback ({user.ping}ms)</span>
                    </>
                  ) : (
                    <span className="text-rose-500 font-semibold text-[10px] flex items-center gap-1 bg-[#1a0e0e] border border-rose-950/60 px-1.5 py-0.5 rounded leading-none">
                      UNAVAILABLE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security & JWT Token Rotation timeline and controls */}
        <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-1 border-b border-zinc-900">
            <span className="font-extrabold text-[9px] uppercase">LNK SECURITY SCHEME</span>
            <span className="text-[10px] text-zinc-400">Rotates every 24h</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-550 mr-1.5 select-none">Active JWT Server Secret:</span>
              <span className="text-indigo-400 font-bold text-xs bg-zinc-950 px-2 py-0.8 rounded border border-zinc-900 select-all">{jwtKey}</span>
            </div>
            <button
              onClick={handleRotateKey}
              className="p-1 px-2.5 rounded bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 transition-all font-black text-[9px] text-zinc-400 cursor-pointer flex items-center gap-1 uppercase"
            >
              <RefreshCw className="w-3 h-3 text-[9px]" /> Rotate Now
            </button>
          </div>

          {/* Timeline slider representation */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Time before auto-refresh</span>
              <span className="text-amber-400 font-bold">{rotationCounter}h left</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded-full border border-zinc-900 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                style={{ width: `${(rotationCounter / 24) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Field Device Certificate Provisioning Portal */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-900">
          <Terminal className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Field Device X.509 Crypt Signer (Anti-Spoofing)
          </h2>
        </div>

        {/* Certificate Signing Form */}
        <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Assigned Device Name / ID:
              </label>
              <input
                type="text"
                value={certDeviceName}
                onChange={(e) => setCertDeviceName(e.target.value)}
                placeholder="Ex: FIELD-MOTO-08"
                className="bg-zinc-950 text-white placeholder-zinc-800 p-2 rounded-xl text-xs border border-zinc-850 outline-none focus:border-emerald-500/80"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                RSA Crypt Key Depth:
              </label>
              <select
                value={certBitLength}
                onChange={(e) => setCertBitLength(e.target.value)}
                className="bg-zinc-950 text-white p-2 rounded-xl text-xs border border-zinc-850 outline-none cursor-pointer"
              >
                <option value="1024">RSA 1024-bit (Low Bandwidth)</option>
                <option value="2048">RSA 2048-bit (Standard Shield)</option>
                <option value="4096">RSA 4096-bit (Maximum Heavy Fortress)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateCertificate}
            disabled={isSigning || !certDeviceName}
            className={`w-full py-2.5 rounded-xl font-bold cursor-pointer transition-all border text-center flex items-center justify-center gap-1.5 uppercase text-xs ${
              isSigning
                ? "bg-emerald-950 text-emerald-400 border-emerald-900 animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700 shadow-md shadow-emerald-500/10"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>
              {isSigning ? "Signing Encryption Packet..." : "Sign & Deploy Module Certificate"}
            </span>
          </button>
        </div>

        {/* Form terminal feedback for certificate issuing */}
        {(signingLog || issuedCert) && (
          <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-2xl p-3 text-[10px] text-zinc-400 flex flex-col gap-2 relative overflow-hidden max-h-[160px] overflow-y-auto scrollbar-thin">
            {!issuedCert && signingLog && (
              <pre className="text-zinc-500 leading-normal animate-pulse select-none font-mono">
                {signingLog}
              </pre>
            )}

            {issuedCert && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-emerald-400 font-extrabold uppercase mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  CERTIFICATE ISSUED SUCCESSFULLY (X.509 ASN.1 standard)
                </div>
                <pre className="bg-zinc-900/50 p-2 rounded border border-zinc-900 text-zinc-350 select-all overflow-x-auto leading-relaxed select-text">
                  {issuedCert}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Database PostgreSQL + S3 metrics tracker */}
        <div className="bg-[#0f1118]/80 border border-indigo-900/20 p-3 rounded-2xl grid grid-cols-3 gap-2 text-center select-none font-mono text-[10px]">
          <div className="flex flex-col gap-0.5 border-r border-zinc-900 last:border-0 p-1">
            <span className="text-zinc-550 flex items-center justify-center gap-1">
              <Database className="w-3 h-3 text-indigo-400" /> PostgreSQL Logs
            </span>
            <span className="text-xs font-black text-white mt-1">
              {postgresRecordCount} rows
            </span>
            <span className="text-[8px] text-emerald-500 font-bold uppercase shrink-0">DB COMMITTED</span>
          </div>

          <div className="flex flex-col gap-0.5 border-r border-zinc-900 last:border-0 p-1">
            <span className="text-zinc-550 flex items-center justify-center gap-1">
              <HardDrive className="w-3 h-3 text-sky-450" /> AWS S3 Records
            </span>
            <span className="text-xs font-black text-white mt-1">
              {s3AudioCount} encs
            </span>
            <span className="text-[8px] text-emerald-500 font-bold uppercase shrink-0">ARCHIVE SECURED</span>
          </div>

          <div className="flex flex-col gap-0.5 p-1 last:border-0">
            <span className="text-zinc-550 flex items-center justify-center gap-1">
              <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin-slow" /> Server CPU Load
            </span>
            <span className="text-xs font-black text-white mt-1 text-amber-400">
              {simulatedLoad}%
            </span>
            <span className="text-[8px] text-zinc-650 font-bold uppercase shrink-0">BALANCER OK</span>
          </div>
        </div>
      </div>
    </div>
  );
}
