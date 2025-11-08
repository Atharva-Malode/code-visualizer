export default function StepControls({
  onReset,
  onPrev,
  onNext,
  onPlayPause,
  playing,
  step,
  total,
  disabled,
}) {
  return (
    <div className="flex gap-6 bg-gray-900 rounded-xl px-6 py-3 shadow-lg">
      <button
        onClick={onReset}
        disabled={disabled}
        className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50"
      >
        🔁 Reset
      </button>
      <button
        onClick={onPrev}
        disabled={disabled}
        className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50"
      >
        ⏮️ Prev
      </button>
      <button
        onClick={onPlayPause}
        disabled={disabled}
        className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50"
      >
        {playing ? "⏸️ Pause" : "▶️ Play"}
      </button>
      <button
        onClick={onNext}
        disabled={disabled}
        className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50"
      >
        ⏭️ Next
      </button>
      <div className="ml-2 self-center text-sm text-gray-400">
        Step {step} / {total}
      </div>
    </div>
  );
}
