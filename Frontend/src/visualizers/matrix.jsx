import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

/**
 * MatrixVisualizer (Production-Ready)
 * ====================================
 * - Universal JSON schema compatible
 * - Handles ALL matrix DSA problems
 * - Grid-based traversal (BFS, DFS, Spiral, etc.)
 * - DP table visualization
 * - Path tracking and reconstruction
 * - Queue/Stack/Array integration
 * - Cyan theme (consistent with other visualizers)
 * - Corner cases: empty matrix, single cell, sparse grids
 * - Multiple matrices support (comparison)
 * - Scrollable content with fixed controls
 * - Added: Solution button navigation
 */
export default function MatrixVisualizer({ jsonData, originalPrompt }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [structures, setStructures] = useState({});
  const [pointers, setPointers] = useState({});
  const [variables, setVariables] = useState({});
  const [action, setAction] = useState("");
  const [condition, setCondition] = useState(null);
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState(true);
  const [endReached, setEndReached] = useState(false);

  const steps = jsonData?.steps || [];
  const allStructures = jsonData?.visualLayout?.structures || [];
  const contentRef = useRef(null);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // Normalize highlight format (string or object)
  const normalizeHighlight = (highlight = []) => {
    if (!Array.isArray(highlight)) return [];
    return highlight
      .map((h) => {
        if (typeof h === "string") return h; // "matrix1:0" or "matrix1:r2c1"
        if (h && typeof h === "object" && h.structure && h.index !== undefined) {
          return `${h.structure}:${h.index}`;
        }
        return null;
      })
      .filter(Boolean);
  };

  // Initialize structures
  useEffect(() => {
    const newStructures = {};
    const newPointers = {};
    const newVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();

      if (type === "matrix") {
        newStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
          rows: s.rows ?? (s.data?.length || 0),
          cols: s.cols ?? (s.data?.[0]?.length || 0),
        };
        if (s.pointers && typeof s.pointers === "object") {
          newPointers[s.id] = { ...s.pointers };
        }
      } else if (type === "stack" || type === "queue" || type === "array") {
        newStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
        };
        if (s.pointers && typeof s.pointers === "object") {
          newPointers[s.id] = { ...s.pointers };
        }
      } else if (type === "variable" || type === "var") {
        newVariables[s.id] = typeof s.value !== "undefined" ? s.value : s.data ?? null;
      } else if (type === "result") {
        newVariables[s.id] = s.value ?? null;
      }
    }

    setStructures(newStructures);
    setPointers(newPointers);
    setVariables(newVariables);
    setStepIndex(0);
    setEndReached(false);
    setPlaying(true);
    setAction("");
    setMessage("");
    setCondition(null);
  }, [jsonData]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const current = steps[stepIndex] || {};

  // Auto-play
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (stepIndex >= steps.length) {
      setPlaying(false);
      return;
    }

    applyStep(stepIndex);

    if (stepIndex < steps.length - 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setStepIndex((s) => s + 1);
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
  }, [playing, stepIndex, steps.length]);

  // Apply step changes
  function applyStep(idx) {
    const step = steps[idx];
    if (!step) return;

    setAction(step.action || "");
    setMessage(step.message || "");
    setCondition(step.condition || null);

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

    // Update structures (matrix, queue, array data)
    for (const [structId, value] of Object.entries(stateChange)) {
      if (structId === "pointers" || structId === "variables") continue;

      if (Array.isArray(value) && structures[structId]) {
        setStructures((prev) => ({
          ...prev,
          [structId]: {
            ...prev[structId],
            data: Array.isArray(value[0]) ? value : [...value],
          },
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

    if (stateChange.variables && typeof stateChange.variables === "object") {
      setVariables((prev) => ({ ...prev, ...stateChange.variables }));
    }
  }

  // Controls
  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setPlaying(false);
      setStepIndex((s) => s + 1);
    }
  };

  const handlePrev = () => {
    const target = Math.max(0, stepIndex - 1);
    setPlaying(false);

    const resetStructures = {};
    const resetPointers = {};
    const resetVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();
      if (type === "matrix" || type === "stack" || type === "queue" || type === "array") {
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

    for (let i = 0; i < target; i++) {
      applyStep(i);
    }

    setStepIndex(target);
  };

  const handleReset = () => {
    setPlaying(false);
    setStepIndex(0);

    const resetStructures = {};
    const resetPointers = {};
    const resetVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();
      if (type === "matrix" || type === "stack" || type === "queue" || type === "array") {
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

  const handleSolution = () => {
    navigate("/solution", {
      state: {
        data: jsonData,
        originalPrompt: originalPrompt,
      },
    });
  };

  const showSolutionButton = !playing;

  // Filter structures
  const matrices = Object.entries(structures)
    .filter(([_, s]) => (s.type || "").toLowerCase() === "matrix")
    .map(([id, s]) => ({ id, ...s }));

  const stackOrQueues = Object.entries(structures)
    .filter(([_, s]) => {
      const t = (s.type || "").toLowerCase();
      return t === "stack" || t === "queue";
    })
    .map(([id, s]) => ({ id, ...s }));

  const helperArrays = Object.entries(structures)
    .filter(([_, s]) => (s.type || "").toLowerCase() === "array")
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

  const isHighlighted = (matrixId, row, col) => {
    // Support multiple highlight formats:
    // 1. "matrixId:flatIndex" where flatIndex = row * cols + col
    // 2. "matrixId:r{row}c{col}" (explicit row/col format)
    const matrix = structures[matrixId];
    if (!matrix) return false;

    const cols = matrix.cols || matrix.data[0]?.length || 0;
    const flatIndex = row * cols + col;
    const key1 = `${matrixId}:${flatIndex}`;
    const key2 = `${matrixId}:r${row}c${col}`;

    return currentHighlight.includes(key1) || currentHighlight.includes(key2);
  };

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col fixed inset-0 overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left Panel: Matrices (70%) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Scrollable Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto space-y-6 pr-3 pb-2">
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
                  key={stepIndex}
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

            {/* Matrices */}
            {matrices.length > 0 ? (
              matrices.map((matrix) => (
                <MatrixRenderer
                  key={matrix.id}
                  matrix={matrix}
                  isHighlighted={isHighlighted}
                />
              ))
            ) : (
              <div className="text-gray-500 italic text-center py-12">
                No matrices to display
              </div>
            )}

            {/* Helper Arrays */}
            {helperArrays.map((arr) => (
              <motion.div
                key={arr.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg mx-auto"
              >
                <div className="text-lg font-bold text-cyan-400 mb-3">
                  {arr.label || arr.id}
                </div>
                <div className="flex flex-wrap gap-3">
                  {arr.data && arr.data.length > 0 ? (
                    arr.data.map((val, idx) => {
                      const isHL = currentHighlight.includes(`${arr.id}:${idx}`);
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
                </div>
              </motion.div>
            ))}

            {/* Stack/Queue */}
            {stackOrQueues.map((sq) => (
              <motion.div
                key={sq.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg mx-auto"
              >
                <div className="text-lg font-bold text-cyan-400 mb-3">
                  {sq.label || sq.id}
                </div>
                <div
                  className={`flex ${
                    sq.type === "stack" ? "flex-col-reverse" : "flex-row flex-wrap"
                  } gap-2 justify-start`}
                >
                  <AnimatePresence mode="popLayout">
                    {sq.data && sq.data.length > 0 ? (
                      sq.data.map((val, idx) => {
                        const isHL = currentHighlight.includes(`${sq.id}:${idx}`);
                        return (
                          <motion.div
                            key={`${sq.id}-${idx}-${val}`}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{
                              opacity: 1,
                              scale: isHL ? 1.15 : 1,
                              boxShadow: isHL
                                ? "0 0 15px rgba(34, 211, 238, 0.6)"
                                : "none",
                            }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ type: "spring", stiffness: 280, damping: 22 }}
                            className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-sm transition-colors ${
                              isHL
                                ? "bg-yellow-500/20 border-yellow-400 text-yellow-200"
                                : "bg-gray-800 border-cyan-500 text-cyan-300"
                            }`}
                          >
                            {Array.isArray(val) ? val.join(",") : val}
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="text-gray-500 italic text-sm py-4">
                        {sq.type === "stack" ? "Stack" : "Queue"} is empty
                      </div>
                    )}
                  </AnimatePresence>
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

        {/* Right Sidebar (30%) */}
        <div className="w-80 flex flex-col gap-4 min-w-0 overflow-y-auto">
          {/* Variables & Results */}
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
                disabled={stepIndex === 0}
                whileHover={{ scale: stepIndex === 0 ? 1 : 1.05 }}
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
                disabled={stepIndex >= steps.length - 1}
                whileHover={{ scale: stepIndex >= steps.length - 1 ? 1 : 1.05 }}
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

            {showSolutionButton && (
              <motion.button
                onClick={handleSolution}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 rounded-lg transition-all duration-300 mb-3"
              >
                📚 View Solution
              </motion.button>
            )}

            <motion.div
              className="text-sm text-cyan-400 font-semibold text-center bg-cyan-900/30 px-3 py-2 rounded-lg border border-cyan-700/50"
              animate={{ scale: 1 }}
              key={stepIndex}
              initial={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {stepIndex + 1} / {steps.length}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * MatrixRenderer - Clean matrix grid rendering
 * Handles highlighting, animations, and multiple matrix types
 */
function MatrixRenderer({ matrix, isHighlighted }) {
  if (!matrix.data || matrix.data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg mx-auto"
      >
        <div className="text-center text-gray-500 italic py-8">
          {matrix.label || "Matrix"} is empty
        </div>
      </motion.div>
    );
  }

  const rows = matrix.data.length;
  const cols = matrix.data[0]?.length || 0;
  const cellSize = cols > 8 ? 50 : 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg mx-auto"
    >
      <div className="text-lg font-bold text-cyan-400 mb-4">
        {matrix.label || "Matrix"} ({rows}×{cols})
      </div>

      <div className="overflow-x-auto flex justify-center">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gap: "8px",
          }}
        >
          <AnimatePresence mode="popLayout">
            {matrix.data.map((row, r) =>
              row.map((val, c) => {
                const isHL = isHighlighted(matrix.id, r, c);

                return (
                  <motion.div
                    key={`${matrix.id}-${r}-${c}`}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{
                      opacity: 1,
                      scale: isHL ? 1.15 : 1,
                      backgroundColor: isHL
                        ? "rgba(234, 179, 8, 0.4)"
                        : "rgba(30, 41, 59, 0.6)",
                      borderColor: isHL
                        ? "rgb(234, 179, 8)"
                        : "rgb(34, 211, 238)",
                    }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                    }}
                    className={`
                      flex items-center justify-center
                      rounded-lg border-2 font-bold
                      text-center transition-all
                      ${
                        isHL
                          ? "text-yellow-200 shadow-lg shadow-yellow-500/50"
                          : "text-cyan-200 shadow-md"
                      }
                    `}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      fontSize: cellSize > 50 ? "16px" : "14px",
                    }}
                  >
                    {val}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dimensions info */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        Rows: {rows} | Cols: {cols}
      </div>
    </motion.div>
  );
}