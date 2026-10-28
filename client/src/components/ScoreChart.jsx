import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const bandColor = (score) => (score >= 7 ? "#19B889" : score >= 4 ? "#E8A33A" : "#F0506E");

function ScoreChart({ data = [] }) {
  if (data.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">Score by question</h2>
      <p className="sr-only">
        {data.map((d) => `${d.name}: ${d.score} out of 10`).join(". ")}
      </p>
      <div className="mt-4 h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#232B3B" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#9BA5B8", fontSize: 12 }} />
            <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fill: "#9BA5B8", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "#171D2C" }}
              contentStyle={{ backgroundColor: "#111623", color: "#ECEFF5", border: "1px solid #343E52", borderRadius: 8, fontSize: 12 }}
              formatter={(value) => [`${value} / 10`, "Score"]}
            />
            <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((d, i) => (
                <Cell key={i} fill={bandColor(d.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default ScoreChart;