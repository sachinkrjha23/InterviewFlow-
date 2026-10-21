const TONES = {
  teal: { stroke: "stroke-teal", text: "text-teal-deep" },
  amber: { stroke: "stroke-amber", text: "text-amber-deep" },
  rose: { stroke: "stroke-rose", text: "text-rose-deep" },
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Timer({ timeLeft, totalTime }) {
  const ratio = totalTime > 0 ? Math.max(0, Math.min(1, timeLeft / totalTime)) : 0;
  const tone = TONES[ratio > 0.5 ? "teal" : ratio > 0.25 ? "amber" : "rose"];

  return (
    <div role="timer" aria-label={`${timeLeft} seconds left`} className="relative h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={RADIUS} className="fill-none stroke-line" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          className={`fill-none transition-[stroke-dashoffset] duration-1000 ease-linear ${tone.stroke}`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-lg font-medium ${tone.text}`}>
        {timeLeft}s
      </span>
    </div>
  );
}

export default Timer;