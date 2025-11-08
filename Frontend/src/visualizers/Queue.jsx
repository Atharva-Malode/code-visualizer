import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * QueueVisualizer (Universal + Production-Ready)
 * ================================================
 * - Universal JSON schema compatible
 * - Handles ALL queue-type DSA questions
 * - Corner cases: empty queue, single element, dequeue all, circular queue, priority queue
 * - Multiple pointers support (front, rear, custom)
 * - Multiple structures support (arrays, variables, results)
 * - Cyan color theme matching HomePage
 * - Smooth spring animations throughout
 * - Scrollable content with fixed controls
 */
export default function QueueVisualizer({ jsonData }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [structures, setStructures] = useState({});
  const [pointers, setPointers] = useState({});
  const [variables, setVariables] = useState({});
  const [playing, setPlaying] = useState(true);
  const [action, setAction] = useState("");
  const [condition, setCondition] = useState(null);
  const [message, setMessage] = useState("");
  const [endReached, setEndReached] = useState(false);

  const steps = jsonData?.steps || [];
  const allStructures = jsonData?.visualLayout?.structures || [];
  const contentRef = useRef(null);
  const timerRef = useRef(null);

  // Normalize highlight format (string or object)
  const normalizeHighlight = (highlight = []) => {
    if (!Array.isArray(highlight)) return [];
    return highlight
      .map((h) => {
        if (typeof h === "string") return h; // Already "id:index"
        if (h && typeof h === "object" && h.structure && Number.isInteger(h.index)) {
          return `${h.structure}:${h.index}`;
        }
        return null;
      })
      .filter(Boolean);
  };

  // Initialize structures, pointers, and variables
  useEffect(() => {
    const newStructures = {};
    const newPointers = {};
    const newVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();

      if (type === "queue") {
        newStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
          isCircular: s.isCircular ?? false,
          maxSize: s.maxSize ?? null,
        };
        // Initialize pointers for queue
        if (s.pointers && typeof s.pointers === "object") {
          newPointers[s.id] = { ...s.pointers };
        } else {
          newPointers[s.id] = {};
        }
      } else if (type === "array") {
        newStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
        };
      } else if (type === "variable" || type === "var") {
        newVariables[s.id] = typeof s.value !== "undefined" ? s.value : s.data ?? null;
      } else if (type === "result") {
        newVariables[s.id] = s.value ?? null;
      } else if (type === "matrix") {
        newStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
          rows: s.rows ?? 0,
          cols: s.cols ?? 0,
        };
      }
    }

    setStructures(newStructures);
    setPointers(newPointers);
    setVariables(newVariables);
    setCurrentStep(0);
    setEndReached(false);
    setPlaying(true);
    setAction("");
    setCondition(null);
    setMessage("");
  }, [jsonData]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const current = steps[currentStep] || {};

  // Auto-play logic
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (currentStep >= steps.length) {
      setPlaying(false);
      return;
    }

    // Apply current step
    applyStep(currentStep);

    // Schedule next step
    if (currentStep < steps.length - 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCurrentStep((s) => s + 1);
      }, 1800);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setEndReached(true);
        setPlaying(false);
      }, 1800);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentStep, steps.length]);

  // Apply step changes
  function applyStep(stepIdx) {
    const step = steps[stepIdx];
    if (!step) return;

    // Update action and message
    setAction(step.action || "");
    setMessage(step.message || "");
    setCondition(step.condition || null);

    // Apply state changes
    if (!step.stateChange) return;

    const { stateChange } = step;

    // Update pointers
    if (stateChange.pointers && typeof stateChange.pointers === "object") {
      setPointers((prev) => {
        const updated = { ...prev };
        for (const [structId, ptrUpdates] of Object.entries(stateChange.pointers)) {
          updated[structId] = { ...updated[structId], ...ptrUpdates };
        }
        return updated;
      });
    }

    // Update structures (queue, array, matrix data)
    for (const [structId, value] of Object.entries(stateChange)) {
      if (structId === "pointers" || structId === "variables") continue;

      if (Array.isArray(value) && structures[structId]) {
        setStructures((prev) => ({
          ...prev,
          [structId]: { ...prev[structId], data: [...value] },
        }));
      }
    }

    // Update variables
    const varUpdates = {};
    for (const [key, value] of Object.entries(stateChange)) {
      if (key === "pointers" || key === "variables") continue;
      if (!Array.isArray(value) && !structures[key]) {
        varUpdates[key] = value;
      }
    }
    if (Object.keys(varUpdates).length > 0) {
      setVariables((prev) => ({ ...prev, ...varUpdates }));
    }

    // Handle nested variables
    if (stateChange.variables && typeof stateChange.variables === "object") {
      setVariables((prev) => ({ ...prev, ...stateChange.variables }));
    }
  }

  // Controls
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setPlaying(false);
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    const target = Math.max(0, currentStep - 1);
    setPlaying(false);
    
    // Reset to initial state
    const resetStructures = {};
    const resetPointers = {};
    const resetVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();
      if (type === "queue" || type === "array" || type === "matrix") {
        resetStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
        };
        if (s.pointers && typeof s.pointers === "object") {
          resetPointers[s.id] = { ...s.pointers };
        }
      } else if (type === "variable" || type === "var" || type === "result") {
        resetVariables[s.id] = typeof s.value !== "undefined" ? s.value : s.data ?? null;
      }
    }

    setStructures(resetStructures);
    setPointers(resetPointers);
    setVariables(resetVariables);

    // Replay steps up to target
    for (let i = 0; i < target; i++) {
      applyStep(i);
    }

    setCurrentStep(target);
  };

  const handleReset = () => {
    setPlaying(false);
    setCurrentStep(0);

    const resetStructures = {};
    const resetPointers = {};
    const resetVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();
      if (type === "queue" || type === "array" || type === "matrix") {
        resetStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
        };
        if (s.pointers && typeof s.pointers === "object") {
          resetPointers[s.id] = { ...s.pointers };
        }
      } else if (type === "variable" || type === "var" || type === "result") {
        resetVariables[s.id] = typeof s.value !== "undefined" ? s.value : s.data ?? null;
      }
    }

    setStructures(resetStructures);
    setPointers(resetPointers);
    setVariables(resetVariables);
    setEndReached(false);
    setAction("");
    setMessage("");
    setCondition(null);

    if (timerRef.current) clearTimeout(timerRef.current);

    setTimeout(() => setPlaying(true), 100);
  };

  // Filter structures by type
  const queues = Object.entries(structures)
    .filter(([_, s]) => (s.type || "").toLowerCase() === "queue")
    .map(([id, s]) => ({ id, ...s }));

  const arrays = Object.entries(structures)
    .filter(([_, s]) => (s.type || "").toLowerCase() === "array")
    .map(([id, s]) => ({ id, ...s }));

  const matrices = Object.entries(structures)
    .filter(([_, s]) => (s.type || "").toLowerCase() === "matrix")
    .map(([id, s]) => ({ id, ...s }));

  const results = Object.entries(variables)
    .filter(([id]) => allStructures.find((s) => s.id === id && (s.type || "").toLowerCase() === "result"))
    .map(([id, val]) => ({
      id,
      label: allStructures.find((s) => s.id === id)?.label || id,
      value: val,
    }));

  const regularVariables = Object.entries(variables)
    .filter(([id]) => allStructures.find((s) => s.id === id && (s.type || "").toLowerCase() !== "result"))
    .map(([id, val]) => ({
      id,
      label: allStructures.find((s) => s.id === id)?.label || id,
      value: val,
    }));

  const currentHighlight = normalizeHighlight(current.highlight || []);

  const isHighlighted = (structId, idx) => currentHighlight.includes(`${structId}:${idx}`);

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col fixed inset-0 overflow-hidden">
      {/* Header */}
      <div className="py-4 px-6 text-center text-2xl font-bold tracking-wide text-cyan-400 border-b border-gray-800 bg-gray-900 shadow-md">
        {jsonData?.questionName || "Queue Visualizer"}
        <div className="text-sm text-gray-400 mt-1">
          Step {Math.min(currentStep + 1, steps.length)} / {steps.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left Panel: Structures (70%) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Scrollable Content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto space-y-6 pr-3 pb-2"
          >
            {/* Info Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-12 gap-4 sticky top-0 bg-gray-950/95 py-4 rounded-lg border-2 border-cyan-500/30 px-4 z-10 shadow-lg backdrop-blur-sm"
            >
              <div className="col-span-4">
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
                  Current Action
                </div>
                <motion.div
                  key={action}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="text-base font-semibold text-cyan-300 bg-cyan-900/30 px-3 py-2 rounded-lg border border-cyan-700"
                >
                  {action || "—"}
                </motion.div>
              </div>

              <div className="col-span-4">
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
                  Step Message
                </div>
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="text-sm font-semibold text-cyan-200 bg-gray-800/50 px-3 py-2 rounded-lg line-clamp-2"
                >
                  {message || "Processing..."}
                </motion.div>
              </div>

              <div className="col-span-4">
                {condition && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
                      Condition
                    </div>
                    <div className="text-xs text-gray-300 font-mono mb-1 bg-gray-800/50 px-3 py-1 rounded-lg">
                      {condition.expression}
                    </div>
                    <motion.div
                      animate={{ scale: condition.result ? 1.05 : 1 }}
                      className={`text-xs font-bold px-3 py-1 rounded-lg inline-block ${
                        condition.result
                          ? "bg-green-900/50 text-green-300 border border-green-600"
                          : "bg-red-900/50 text-red-300 border border-red-600"
                      }`}
                    >
                      {condition.result ? "✓ True" : "✗ False"}
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Queues */}
            {queues.map((queue) => (
              <motion.div
                key={queue.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg"
              >
                <div className="text-lg font-bold text-cyan-400 mb-3">
                  {queue.label || queue.id}
                </div>

                {/* Pointers Display */}
                {Object.entries(pointers[queue.id] || {}).length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-4 pb-3 border-b border-gray-800">
                    {Object.entries(pointers[queue.id] || {}).map(([pName, idx]) => (
                      <motion.div
                        key={pName}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 250, damping: 20 }}
                        className="bg-gradient-to-r from-cyan-900/40 to-cyan-800/20 px-2.5 py-1.5 rounded text-xs text-cyan-200 font-semibold border border-cyan-700/50 shadow-md"
                      >
                        <span className="text-cyan-300">{pName}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="text-cyan-400 font-bold">
                          {idx === null || idx === undefined ? "null" : `[${idx}]`}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Queue Elements */}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <div className="text-xs text-cyan-400 font-bold">FRONT</div>
                  <AnimatePresence mode="popLayout">
                    {queue.data && queue.data.length > 0 ? (
                      queue.data.map((val, idx) => {
                        const isHL = isHighlighted(queue.id, idx);
                        return (
                          <motion.div
                            key={`${queue.id}-${idx}-${val}`}
                            layout
                            initial={{ opacity: 0, scale: 0.8, x: -20 }}
                            animate={{
                              opacity: 1,
                              scale: isHL ? 1.15 : 1,
                              x: 0,
                              boxShadow: isHL
                                ? "0 0 20px rgba(250, 204, 21, 0.6)"
                                : "none",
                            }}
                            exit={{ opacity: 0, scale: 0.6, x: -20 }}
                            transition={{ type: "spring", stiffness: 280, damping: 22 }}
                            className={`w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg transition-colors ${
                              isHL
                                ? "bg-yellow-500/20 border-yellow-400 text-yellow-200"
                                : "bg-gray-800 border-cyan-500 text-cyan-300"
                            }`}
                          >
                            <div>{val}</div>
                            <div className="text-xs text-gray-500 mt-1">[{idx}]</div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <motion.div
                        key="empty-queue"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-gray-500 italic text-sm py-8"
                      >
                        Queue is empty
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="text-xs text-cyan-400 font-bold">REAR</div>
                </div>

                {/* Circular/Max Size Indicators */}
                {queue.isCircular && (
                  <div className="mt-3 text-xs text-purple-300 bg-purple-900/30 border border-purple-700/50 rounded px-2 py-1">
                    🔄 Circular Queue
                  </div>
                )}
                {queue.maxSize && (
                  <div className="mt-2 text-xs text-cyan-300 bg-cyan-900/20 border border-cyan-700/50 rounded px-2 py-1">
                    Max Size: {queue.maxSize}
                  </div>
                )}
              </motion.div>
            ))}

            {/* Arrays */}
            {arrays.map((arr) => (
              <motion.div
                key={arr.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg"
              >
                <div className="text-lg font-bold text-cyan-400 mb-3">
                  {arr.label || arr.id}
                </div>
                <div className="flex flex-wrap gap-3">
                  <AnimatePresence mode="popLayout">
                    {arr.data && arr.data.length > 0 ? (
                      arr.data.map((val, idx) => {
                        const isHL = isHighlighted(arr.id, idx);
                        return (
                          <motion.div
                            key={`${arr.id}-${idx}`}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{
                              opacity: 1,
                              scale: isHL ? 1.12 : 1,
                            }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ type: "spring", stiffness: 280, damping: 22 }}
                            className={`w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center font-bold transition-colors ${
                              isHL
                                ? "bg-yellow-500/20 border-yellow-400 text-yellow-200"
                                : "bg-gray-800 border-cyan-500 text-cyan-300"
                            }`}
                          >
                            <div>{val}</div>
                            <div className="text-xs text-gray-500 mt-1">[{idx}]</div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="text-gray-500 italic">—</div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}

            {/* Matrices */}
            {matrices.map((matrix) => (
              <motion.div
                key={matrix.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg"
              >
                <div className="text-lg font-bold text-cyan-400 mb-3">
                  {matrix.label || matrix.id}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${matrix.cols || 3}, minmax(50px, 1fr))`,
                    gap: "8px",
                  }}
                >
                  {matrix.data && matrix.data.map((val, idx) => {
                    const isHL = isHighlighted(matrix.id, idx);
                    return (
                      <motion.div
                        key={`m-${idx}`}
                        animate={{
                          scale: isHL ? 1.1 : 1,
                        }}
                        className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center font-bold transition-colors ${
                          isHL
                            ? "bg-yellow-500/20 border-yellow-400 text-yellow-200"
                            : "bg-gray-800 border-cyan-500 text-cyan-300"
                        }`}
                      >
                        {val}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Message Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border-t border-gray-800 bg-gray-900/80 px-4 py-3 text-sm text-gray-300 min-h-12 flex items-center"
          >
            {endReached
              ? jsonData?.endMessage || "✅ Visualization Complete!"
              : ""}
          </motion.div>
        </div>

        {/* Right Sidebar: Variables & Controls (30%) */}
        <div className="w-80 flex flex-col gap-4 min-w-0">
          {/* Variables & Results Panel */}
          {(regularVariables.length > 0 || results.length > 0) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg flex-1 overflow-y-auto"
            >
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
                📊 Variables
              </div>

              <div className="space-y-2.5">
                {regularVariables.map(({ id, label, value }) => (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
                  >
                    <div className="text-xs text-gray-400 font-semibold mb-1">
                      {label}
                    </div>
                    <motion.div
                      key={value}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="text-sm font-bold font-mono text-cyan-300"
                    >
                      {value === null || value === undefined ? "—" : String(value)}
                    </motion.div>
                  </motion.div>
                ))}

                {/* Results */}
                {results.map(({ id, label, value }) => (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg bg-green-900/20 border border-green-700/40"
                  >
                    <div className="text-xs text-green-400 font-semibold mb-1">
                      {label} ✓
                    </div>
                    <motion.div
                      key={value}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="text-sm font-bold font-mono text-green-300"
                    >
                      {value === null || value === undefined ? "—" : String(value)}
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg"
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              <motion.button
                onClick={handlePrev}
                disabled={currentStep === 0}
                whileHover={{ scale: currentStep === 0 ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              >
                ⏮ Prev
              </motion.button>

              <motion.button
                onClick={() => setPlaying((p) => !p)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  playing
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }`}
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </motion.button>

              <motion.button
                onClick={handleNext}
                disabled={currentStep >= steps.length - 1}
                whileHover={{ scale: currentStep >= steps.length - 1 ? 1 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              >
                Next ⏭
              </motion.button>

              <motion.button
                onClick={handleReset}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm transition-colors"
              >
                🔄 Reset
              </motion.button>
            </div>

            <motion.div
              className="text-sm text-cyan-400 font-semibold text-center bg-cyan-900/30 px-3 py-2 rounded-lg border border-cyan-700/50"
              animate={{ scale: 1 }}
              key={currentStep}
              initial={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {currentStep + 1} / {steps.length}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}