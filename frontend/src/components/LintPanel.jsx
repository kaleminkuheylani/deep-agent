import { AlertTriangle, XCircle, Info } from "lucide-react";

export default function LintPanel({ lintResults }) {
  if (!lintResults) return null;

  const { errors = [], warnings = [], info = [] } = lintResults;
  const all = [
    ...errors.map((e) => ({ ...e, severity: "error" })),
    ...warnings.map((w) => ({ ...w, severity: "warning" })),
    ...info.map((i) => ({ ...i, severity: "info" })),
  ];

  const getIcon = (severity) => {
    switch (severity) {
      case "error":
        return <XCircle size={12} className="text-red-400 shrink-0" />;
      case "warning":
        return <AlertTriangle size={12} className="text-yellow-400 shrink-0" />;
      default:
        return <Info size={12} className="text-blue-400 shrink-0" />;
    }
  };

  const getColor = (severity) => {
    switch (severity) {
      case "error": return "text-red-400";
      case "warning": return "text-yellow-400";
      default: return "text-blue-400";
    }
  };

  return (
    <div data-testid="lint-panel" className="border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-800">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400">
          Diagnostics
        </span>
        {errors.length > 0 && (
          <span className="font-mono text-[10px] text-red-400">
            {errors.length} error
          </span>
        )}
        {warnings.length > 0 && (
          <span className="font-mono text-[10px] text-yellow-400">
            {warnings.length} warn
          </span>
        )}
        {info.length > 0 && (
          <span className="font-mono text-[10px] text-blue-400">
            {info.length} info
          </span>
        )}
        {all.length === 0 && (
          <span className="font-mono text-[10px] text-emerald-400">
            Temiz
          </span>
        )}
      </div>
      <div className="max-h-[120px] overflow-y-auto">
        {all.length === 0 ? (
          <div className="px-3 py-2 text-xs text-zinc-600 font-mono">
            Hata bulunamadı.
          </div>
        ) : (
          all.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-1 text-xs font-mono ${
                i % 2 === 0 ? "bg-zinc-900/30" : ""
              }`}
            >
              {getIcon(item.severity)}
              <span className="text-zinc-500">[{item.rule}]</span>
              <span className="text-zinc-500">Ln {item.line}</span>
              <span className={getColor(item.severity)}>{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
