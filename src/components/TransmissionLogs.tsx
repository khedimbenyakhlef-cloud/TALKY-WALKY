import { TransmissionLog } from "../types";
import { Clock, Radio, User, ShieldCheck, ShieldAlert, Wifi } from "lucide-react";
import React, { useRef, useEffect } from "react";

interface TransmissionLogsProps {
  logs: TransmissionLog[];
  activeFrequency: string;
  activeChannel: string;
  encryptActive: boolean;
  linkStrength: number;
  codename: string;
  channelUsers: Array<{ userId: string; name: string }>;
}

export default function TransmissionLogs({
  logs,
  activeFrequency,
  activeChannel,
  encryptActive,
  linkStrength,
  codename,
  channelUsers
}: TransmissionLogsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll communication logs to the bottom
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-900 flex flex-col h-[320px] shadow-lg text-white font-mono">
      {/* LCD/CRT Status header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5 mb-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Radio className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
          <span className="text-zinc-400 font-bold">{activeChannel}</span>
          <span className="text-zinc-650">|</span>
          <span className="text-emerald-400 font-medium">{activeFrequency}</span>
        </div>
        <div className="flex items-center gap-2">
          {encryptActive ? (
            <span className="flex items-center gap-1 text-[9px] bg-emerald-950/80 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded uppercase font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              AES-256
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] bg-red-950/80 text-red-400 border border-red-900 px-1.5 py-0.5 rounded uppercase font-bold animate-pulse">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              CLEAR
            </span>
          )}
          
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Wifi className="w-3 h-3 text-zinc-400" />
            <span>{linkStrength}% Link</span>
          </div>
        </div>
      </div>

      {/* Connected Operators Mesh list */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 mb-2 border-b border-zinc-900/50 text-[10px] text-zinc-500 overflow-x-auto min-h-[22px] scrollbar-thin">
        <span className="font-semibold uppercase tracking-wider text-[8px] text-zinc-650 font-sans">MESH NET:</span>
        {channelUsers.length <= 1 ? (
          <span className="text-zinc-650 uppercase text-[9px]">SOLO SATCOM CHANNEL</span>
        ) : (
          channelUsers.map((user) => (
            <span 
              key={user.userId} 
              className={`px-1.5 py-0.5 rounded border uppercase font-bold text-[8px] flex items-center gap-1 whitespace-nowrap ${
                user.name === codename 
                  ? "bg-emerald-950 text-emerald-400 border-emerald-900/60" 
                  : "bg-zinc-900 text-zinc-350 border-zinc-800"
              }`}
            >
              <span className={`w-1 h-1 rounded-full ${user.name === codename ? "bg-emerald-450 animate-pulse" : "bg-indigo-400 animate-pulse"}`}></span>
              {user.name} {user.name === codename ? "(YOU)" : ""}
            </span>
          ))
        )}
      </div>

      {/* Message Logs Feed */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 custom-scroll"
      >
        {logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-650 gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
            <p className="text-[10px] text-center uppercase tracking-wider leading-relaxed">
              Radio link idle...<br />
              Hold & Translate with Push-To-Talk
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const isOperator = log.sender === "OPERATOR";
            const isSystem = log.sender === "SYSTEM";

            return (
              <div 
                key={log.id} 
                className={`flex flex-col gap-1 max-w-[85%] ${
                  isOperator ? "self-end items-end" : "self-start items-start"
                }`}
              >
                {/* Meta header */}
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
                  {isOperator ? (
                    <>
                      <span className="text-[10px] font-bold text-emerald-500">OPERATOR (Ground)</span>
                      <User className="w-2.5 h-2.5 text-emerald-500" />
                    </>
                  ) : isSystem ? (
                    <span className="text-[10px] font-bold text-yellow-500 uppercase">SYS RECV SYSTEM LOGGER</span>
                  ) : (
                    <>
                      <Radio className="w-2.5 h-2.5 text-emerald-450" />
                      <span className="text-[10px] font-bold text-emerald-450">SAT-STATION IX</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{log.timestamp}</span>
                </div>

                {/* Message Balloon */}
                <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed border ${
                  isOperator 
                    ? "bg-zinc-900 text-zinc-100 border-zinc-800 rounded-tr-none" 
                    : isSystem
                    ? "bg-zinc-900 text-yellow-400 border-zinc-800 rounded-tl-none font-bold"
                    : "bg-emerald-950/30 text-emerald-100 border-emerald-900/40 rounded-tl-none"
                }`}>
                  <p>{log.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
