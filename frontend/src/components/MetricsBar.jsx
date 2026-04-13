import { TrendingDown, TrendingUp, Activity, Zap } from "lucide-react";

export default function MetricsBar({ metrics, currentEpoch, totalEpochs }) {
  const latest = metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;

  const cards = [
    {
      label: "EPOCH",
      value: currentEpoch ? `${currentEpoch}/${totalEpochs || "?"}` : "--",
      icon: Activity,
      color: "text-blue-400",
    },
    {
      label: "TRAIN LOSS",
      value: latest ? latest.train_loss.toFixed(4) : "--",
      icon: TrendingDown,
      color: "text-red-400",
    },
    {
      label: "ACCURACY",
      value: latest ? `${(latest.train_acc * 100).toFixed(1)}%` : "--",
      icon: TrendingUp,
      color: "text-emerald-400",
    },
    {
      label: "LR",
      value: latest ? latest.lr?.toFixed(6) || "--" : "--",
      icon: Zap,
      color: "text-yellow-400",
    },
  ];

  return (
    <div data-testid="metrics-bar" className="grid grid-cols-4 border-b border-zinc-800">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`flex flex-col p-3 ${
            i < 3 ? "border-r border-zinc-800" : ""
          } bg-zinc-900/50`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <card.icon size={12} className={card.color} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {card.label}
            </span>
          </div>
          <span className={`font-mono text-lg tracking-tighter ${card.color}`}>
            {card.value}
          </span>
        </div>
      ))}
    </div>
  );
}
