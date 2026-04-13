import { useEffect, useRef } from "react";
import { Terminal, Circle } from "lucide-react";

export default function FeedbackTerminal({ logs, agentStatus }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getStatusColor = (status) => {
    switch (status) {
      case "running": return "text-emerald-400";
      case "completed": return "text-blue-400";
      case "stopped": return "text-red-400";
      default: return "text-zinc-500";
    }
  };

  const getLogColor = (log) => {
    if (log.type === "error") return "text-red-400";
    if (log.type === "status") return "text-blue-400";
    if (log.type === "epoch") return "text-emerald-400";
    if (log.type === "batch") return "text-zinc-500";
    return "text-zinc-300";
  };

  return (
    <div data-testid="feedback-terminal" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-zinc-500" />
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400">
            Agent Output
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            className={`glow-dot fill-current ${getStatusColor(agentStatus)}`}
          />
          <span className={`font-mono text-xs ${getStatusColor(agentStatus)}`}>
            {agentStatus || "idle"}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        data-testid="terminal-output"
        className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="text-zinc-600 p-2">
            Eğitim başlatıldığında loglar burada görünecek...
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`px-2 py-0.5 ${
                i % 2 === 0 ? "bg-zinc-900/50" : "bg-zinc-950"
              } ${getLogColor(log)} animate-slide-up`}
            >
              <span className="text-zinc-600 mr-2 select-none">
                {String(i + 1).padStart(3, "0")}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
