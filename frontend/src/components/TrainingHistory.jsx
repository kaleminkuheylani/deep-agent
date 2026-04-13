import { useState, useEffect } from "react";
import { Clock, ChevronRight } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TrainingHistory({ onSelectSession }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API}/training/history`);
        setSessions(res.data || []);
      } catch (err) {
        console.error("History fetch error:", err);
      }
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return "text-emerald-400 bg-emerald-400/10";
      case "running":
        return "text-blue-400 bg-blue-400/10";
      case "stopped":
        return "text-red-400 bg-red-400/10";
      default:
        return "text-zinc-400 bg-zinc-400/10";
    }
  };

  return (
    <div data-testid="training-history" className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <Clock size={14} className="text-zinc-500" />
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400">
          Geçmiş
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          {sessions.length}
        </span>
      </div>
      <div className="overflow-y-auto max-h-[200px]">
        {sessions.length === 0 ? (
          <div className="px-3 py-4 text-xs text-zinc-600 font-mono">
            Henüz eğitim yok
          </div>
        ) : (
          sessions.slice(0, 10).map((s, i) => (
            <button
              key={s.id || i}
              onClick={() => onSelectSession?.(s)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors ${
                i % 2 === 0 ? "bg-zinc-900/20" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-zinc-300 truncate">
                  {s.config?.model_name || "Model"}
                </div>
                <div className="font-mono text-[10px] text-zinc-600">
                  {s.config?.epochs || "?"} epochs
                </div>
              </div>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 ${getStatusBadge(
                  s.status
                )}`}
              >
                {s.status}
              </span>
              <ChevronRight size={12} className="text-zinc-600" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
