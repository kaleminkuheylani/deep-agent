import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 p-2 font-mono text-xs">
      <div className="text-zinc-400 mb-1">Epoch {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(4)}
        </div>
      ))}
    </div>
  );
};

export default function TrainingCharts({ metrics }) {
  if (!metrics || metrics.length === 0) {
    return (
      <div data-testid="charts-empty" className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">
        Eğitim verileri bekleniyor...
      </div>
    );
  }

  return (
    <div data-testid="training-charts" className="flex flex-col gap-4 p-3 h-full overflow-y-auto">
      {/* Loss Chart */}
      <div className="border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400 mb-3">
          Loss
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={metrics}>
            <CartesianGrid vertical={false} horizontal={false} />
            <XAxis
              dataKey="epoch"
              tick={{ fontSize: 10, fill: "#71717A" }}
              tickLine={false}
              axisLine={{ stroke: "#3F3F46" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717A" }}
              tickLine={false}
              axisLine={{ stroke: "#3F3F46" }}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="train_loss"
              stroke="#EF4444"
              strokeWidth={1.5}
              dot={false}
              name="Train Loss"
            />
            <Line
              type="monotone"
              dataKey="val_loss"
              stroke="#F87171"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              name="Val Loss"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Accuracy Chart */}
      <div className="border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400 mb-3">
          Accuracy
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={metrics}>
            <CartesianGrid vertical={false} horizontal={false} />
            <XAxis
              dataKey="epoch"
              tick={{ fontSize: 10, fill: "#71717A" }}
              tickLine={false}
              axisLine={{ stroke: "#3F3F46" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#71717A" }}
              tickLine={false}
              axisLine={{ stroke: "#3F3F46" }}
              domain={[0, 1]}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="train_acc"
              stroke="#10B981"
              strokeWidth={1.5}
              dot={false}
              name="Train Acc"
            />
            <Line
              type="monotone"
              dataKey="val_acc"
              stroke="#34D399"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              name="Val Acc"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics Table */}
      <div className="border border-zinc-800 bg-zinc-950/50">
        <div className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-400 px-3 py-2 border-b border-zinc-800">
          Epoch Detayları
        </div>
        <div className="overflow-y-auto max-h-[200px]">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left px-3 py-1.5">#</th>
                <th className="text-left px-3 py-1.5">T.Loss</th>
                <th className="text-left px-3 py-1.5">T.Acc</th>
                <th className="text-left px-3 py-1.5">V.Loss</th>
                <th className="text-left px-3 py-1.5">V.Acc</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr
                  key={i}
                  className={`${
                    i % 2 === 0 ? "bg-zinc-900/30" : ""
                  } text-zinc-300`}
                >
                  <td className="px-3 py-1 text-zinc-500">{m.epoch}</td>
                  <td className="px-3 py-1 text-red-400">{m.train_loss?.toFixed(4)}</td>
                  <td className="px-3 py-1 text-emerald-400">{m.train_acc?.toFixed(4)}</td>
                  <td className="px-3 py-1 text-red-300">{m.val_loss?.toFixed(4)}</td>
                  <td className="px-3 py-1 text-emerald-300">{m.val_acc?.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
