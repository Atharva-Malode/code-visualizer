import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * StackVisualizer - Enhanced with YouTube-Style Captions
 * =======================================================
 * - YouTube-style bottom-center captions
 * - Enhanced UI polish and spacing
 * - Better animations and transitions
 * - Improved visual hierarchy
 */

export default function StackVisualizer({ jsonData }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [structures, setStructures] = useState({});
  const [action, setAction] = useState("");
  const [condition, setCondition] = useState(null);
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState(true);
  const [endReached, setEndReached] = useState(false);
  const timerRef = useRef(null);

  const steps = jsonData?.steps || [];
  const allStructures = jsonData?.visualLayout?.structures || [];
  const current = steps[currentStep] || {};

  // Initialize structures
  useEffect(() => {
    const initialState = {};
    allStructures.forEach((s) => {
      const type = (s.type || "").toLowerCase();
      initialState[s.id] = {
        id: s.id,
        type,
        label: s.label || s.id,
        data: Array.isArray(s.data) ? [...s.data] : [],
        value: s.value ?? null,
      };
    });
    setStructures(initialState);
    setCurrentStep(0);
    setPlaying(true);
    setEndReached(false);
  }, [jsonData]);

  // Auto-play
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (currentStep >= steps.length) {
      setEndReached(true);
      setPlaying(false);
      return;
    }

    applyStep(currentStep);

    if (currentStep < steps.length - 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCurrentStep((s) => s + 1);
      }, 1800);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentStep, steps.length]);

  function applyStep(idx) {
    const step = steps[idx];
    if (!step) return;

    setAction(step.action || "");
    setMessage(step.message || "");
    setCondition(step.condition || null);

    if (!step.stateChange) return;

    const { stateChange } = step;

    // Update structures
    setStructures((prev) => {
      const updated = { ...prev };

      for (const [key, value] of Object.entries(stateChange)) {
        if (updated[key]) {
          if (typeof value === "object" && value !== null && value.data !== undefined) {
            updated[key] = {
              ...updated[key],
              data: Array.isArray(value.data) ? [...value.data] : [],
            };
          } else if (typeof value === "object" && value !== null && value.value !== undefined) {
            updated[key] = {
              ...updated[key],
              value: value.value,
            };
          } else if (Array.isArray(value)) {
            updated[key] = {
              ...updated[key],
              data: [...value],
            };
          } else {
            updated[key] = {
              ...updated[key],
              value: value,
            };
          }
        }
      }

      return updated;
    });
  }

  // Extract highlights
  const extractHighlights = (highlight = []) => {
    const result = { array: new Set(), stack: new Set(), queue: new Set() };

    if (!Array.isArray(highlight)) return result;

    for (const h of highlight) {
      if (!h) continue;

      if (typeof h === "string") {
        const [structId, indexStr] = h.split(":");
        const index = parseInt(indexStr);
        if (!isNaN(index)) {
          result.array.add(`${structId}:${index}`);
        }
        continue;
      }

      if (typeof h === "object") {
        const { structure, node } = h;
        if (structure && node !== undefined && node !== null) {
          result.array.add(`${structure}:${node}`);
        }
      }
    }

    return result;
  };

  const highlights = extractHighlights(current.highlight);

  // Categorize structures
  const stacks = Object.values(structures).filter((s) => s.type === "stack");
  const queues = Object.values(structures).filter((s) => s.type === "queue");
  const arrays = Object.values(structures).filter((s) => s.type === "array");
  const variables = Object.values(structures).filter((s) => s.type === "variable");
  const results = Object.values(structures).filter((s) => s.type === "result");

  const isHighlighted = (structId, index) => {
    return highlights.array.has(`${structId}:${index}`);
  };

  // Controls
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setPlaying(false);
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setPlaying(false);
      setCurrentStep((s) => s - 1);
    }
  };

  const handleReset = () => {
    setPlaying(false);
    setCurrentStep(0);
    setEndReached(false);

    const resetState = {};
    allStructures.forEach((s) => {
      const type = (s.type || "").toLowerCase();
      resetState[s.id] = {
        id: s.id,
        type,
        label: s.label || s.id,
        data: Array.isArray(s.data) ? [...s.data] : [],
        value: s.value ?? null,
      };
    });
    setStructures(resetState);

    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setPlaying(true), 100);
  };

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col fixed inset-0 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-cyan-500/20 px-8 py-5 shadow-lg">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div>
            <div className="text-3xl font-black text-cyan-400 tracking-tight">
              {jsonData?.questionName || "Stack Visualizer"}
            </div>
            <div className="text-xs text-gray-400 mt-1.5 font-semibold tracking-widest uppercase">
              {jsonData?.patternType || "Algorithm"} • Step {currentStep + 1}/{steps.length}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-6">
            {stacks.length > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold">Stack Size</div>
                <motion.div
                  key={currentStep}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-cyan-400"
                >
                  {stacks[0]?.data?.length || 0}
                </motion.div>
              </div>
            )}

            {results.length > 0 && (
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold">Result</div>
                <motion.div
                  key={currentStep}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className={`text-2xl font-bold ${
                    results[0]?.value === true
                      ? "text-green-400"
                      : results[0]?.value === false
                        ? "text-red-400"
                        : "text-cyan-400"
                  }`}
                >
                  {results[0]?.value === true ? "✓" : results[0]?.value === false ? "✗" : "—"}
                </motion.div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-5 p-5 overflow-hidden pb-40">
        {/* Left Panel - Input & Variables (18%) */}
        <div className="w-1/5 flex flex-col min-w-0 space-y-4 overflow-y-auto pr-2">
          {/* Input Array */}
          {arrays.length > 0 &&
            arrays.map((arr) => (
              <motion.div
                key={arr.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-cyan-500/30 rounded-xl p-4 shadow-lg hover:border-cyan-500/50 transition-all"
              >
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3.5">
                  {arr.label}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {arr.data && arr.data.length > 0 ? (
                    arr.data.map((v, i) => (
                      <motion.div
                        key={`${arr.id}-${i}`}
                        layout
                        animate={{
                          scale: isHighlighted(arr.id, i) ? 1.15 : 1,
                          boxShadow: isHighlighted(arr.id, i)
                            ? "0 0 20px rgba(234, 179, 8, 0.9)"
                            : "0 4px 12px rgba(0, 0, 0, 0.4)",
                        }}
                        className={`w-full h-10 rounded-lg border-2 font-bold text-sm flex items-center justify-center transition-all ${
                          isHighlighted(arr.id, i)
                            ? "bg-yellow-500/40 border-yellow-400 text-yellow-300 shadow-lg"
                            : "bg-gray-800/60 border-cyan-500/50 text-cyan-300 hover:border-cyan-400"
                        }`}
                      >
                        {String(v)}
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-3 text-gray-600 italic text-xs text-center py-2">
                      —
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

          {/* Variables */}
          {variables.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-cyan-500/30 rounded-xl p-4 shadow-lg hover:border-cyan-500/50 transition-all"
            >
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3.5">
                Variables
              </div>

              <div className="space-y-2.5">
                {variables.map((v) => (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-between items-center text-sm bg-gray-700/30 px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-gray-400 font-medium">{v.label}</span>
                    <motion.span
                      key={`${v.id}-${String(v.value)}`}
                      initial={{ scale: 1.15, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-cyan-300 font-bold font-mono text-sm"
                    >
                      {v.value === null || v.value === undefined ? "—" : String(v.value)}
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-gradient-to-br from-green-900/30 to-gray-900 border-2 border-green-500/40 rounded-xl p-4 shadow-lg hover:border-green-500/60 transition-all mt-auto"
            >
              <div className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">
                Final Result
              </div>

              {results.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="text-center"
                >
                  <div
                    className={`text-2xl font-black font-mono ${
                      r.value === true
                        ? "text-green-400"
                        : r.value === false
                          ? "text-red-400"
                          : "text-cyan-400"
                    }`}
                  >
                    {r.value === true ? "✓ TRUE" : r.value === false ? "✗ FALSE" : String(r.value)}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Center Panel - Stacks & Queues (64%) */}
        <div className="flex-1 flex flex-col min-w-0 space-y-5 overflow-y-auto px-2">
          {/* Info Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-3 gap-4 bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-cyan-500/20 rounded-xl p-4 sticky top-0 z-20 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                  Current Action
                </div>
                <motion.div
                  key={action}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-bold text-cyan-300 mt-0.5"
                >
                  {action || "Initializing"}
                </motion.div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                  Progress
                </div>
                <motion.div
                  key={currentStep}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-sm font-bold text-cyan-300 mt-0.5"
                >
                  {currentStep + 1} / {steps.length}
                </motion.div>
              </div>
            </div>

            {condition && (
              <div className="flex items-center justify-end gap-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    Condition
                  </div>
                  <motion.div
                    className={`text-sm font-bold mt-0.5 ${
                      condition.result ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {condition.result ? "✓ TRUE" : "✗ FALSE"}
                  </motion.div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Stacks */}
          {stacks.map((stack, stackIdx) => (
            <motion.div
              key={stack.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-cyan-400">{stack.label}</div>
                <div className="text-xs text-gray-500 font-mono">
                  [{stack.data?.length || 0}]
                </div>
              </div>

              <div className="relative w-full flex justify-center">
                <div className="w-80 bg-gradient-to-b from-gray-800/80 to-gray-900/80 border-4 border-cyan-500/40 rounded-2xl p-4 shadow-2xl min-h-96 flex flex-col-reverse items-center justify-start overflow-hidden backdrop-blur-sm">
                  <AnimatePresence mode="popLayout">
                    {stack.data && stack.data.length > 0 ? (
                      stack.data.map((value, idx) => (
                        <motion.div
                          key={`${stack.id}-${idx}-${String(value)}`}
                          layout
                          initial={{ opacity: 0, y: -120, scale: 0.5, rotateZ: -15 }}
                          animate={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
                          exit={{ opacity: 0, y: -120, scale: 0.5, rotateZ: 15 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            rotateZ: { duration: 0.3 },
                          }}
                          className={`w-64 h-16 mb-3 rounded-xl border-3 font-bold text-2xl flex items-center justify-center shadow-xl transition-all ${
                            isHighlighted(stack.id, idx)
                              ? "bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 border-yellow-300 text-black scale-110 shadow-2xl"
                              : "bg-gradient-to-br from-cyan-500 to-cyan-700 border-cyan-400 text-white hover:shadow-lg"
                          }`}
                        >
                          {String(value)}
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        exit={{ opacity: 0 }}
                        className="text-gray-600 italic text-center py-40 font-semibold"
                      >
                        Empty Stack
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Side Info */}
                <div className="absolute -right-40 top-1/2 -translate-y-1/2 flex flex-col gap-4 text-xs text-gray-400 font-mono">
                  <div className="text-center">
                    <div className="uppercase text-gray-600 mb-1">Size</div>
                    <div className="text-xl font-bold text-cyan-400">
                      {stack.data?.length || 0}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="uppercase text-gray-600 mb-1">Top Index</div>
                    <div className="text-xl font-bold text-cyan-400">
                      {stack.data?.length ? stack.data.length - 1 : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Queues */}
          {queues.map((queue) => (
            <motion.div
              key={queue.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="text-sm font-bold text-purple-400">{queue.label}</div>

              <div className="w-full bg-gradient-to-r from-gray-800/80 to-gray-900/80 border-4 border-purple-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
                <div className="flex gap-3 items-center justify-start overflow-x-auto pb-2">
                  <div className="text-xs text-purple-400 font-bold min-w-max uppercase tracking-wider">
                    Front
                  </div>

                  {queue.data && queue.data.length > 0 ? (
                    queue.data.map((v, i) => (
                      <motion.div
                        key={`${queue.id}-${i}`}
                        layout
                        initial={{ opacity: 0, x: -50, scale: 0.6 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -50, scale: 0.6 }}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 25,
                        }}
                        className={`h-14 w-14 rounded-lg border-2 font-bold text-sm flex items-center justify-center flex-shrink-0 transition-all ${
                          isHighlighted(queue.id, i)
                            ? "bg-yellow-500/50 border-yellow-400 text-yellow-100 scale-110"
                            : "bg-purple-600/80 border-purple-400 text-white hover:bg-purple-500"
                        }`}
                      >
                        {String(v)}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-gray-600 italic text-sm">Empty</div>
                  )}

                  <div className="text-xs text-purple-400 font-bold min-w-max uppercase tracking-wider">
                    Rear
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right Panel - Controls (18%) */}
        <div className="w-1/5 flex flex-col min-w-0 gap-4 pl-2">
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-cyan-500/30 rounded-xl p-5 shadow-lg hover:border-cyan-500/50 transition-all"
          >
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <motion.button
                onClick={handlePrev}
                disabled={currentStep === 0}
                whileHover={{ scale: currentStep === 0 ? 1 : 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm transition-colors"
              >
                ⏮ Prev
              </motion.button>

              <motion.button
                onClick={() => setPlaying((p) => !p)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${
                  playing
                    ? "bg-red-600/90 hover:bg-red-700 text-white"
                    : "bg-cyan-600/90 hover:bg-cyan-700 text-white"
                }`}
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </motion.button>

              <motion.button
                onClick={handleNext}
                disabled={currentStep >= steps.length - 1}
                whileHover={{ scale: currentStep >= steps.length - 1 ? 1 : 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm transition-colors"
              >
                Next ⏭
              </motion.button>

              <motion.button
                onClick={handleReset}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold text-sm transition-colors"
              >
                🔄 Reset
              </motion.button>
            </div>

            <motion.div
              className="text-sm font-bold text-center bg-cyan-500/20 px-4 py-2.5 rounded-lg border border-cyan-500/30 text-cyan-300"
              key={currentStep}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {currentStep + 1} / {steps.length}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* YouTube-Style Bottom Caption */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6"
          >
            <div className="bg-black/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl px-8 py-4 shadow-2xl max-w-3xl">
              <p className="text-center text-white font-medium leading-relaxed text-sm md:text-base">
                {endReached ? jsonData?.endMessage || "✅ Visualization Complete!" : message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
// import { useState, useEffect, useRef } from "react";
// import { motion, AnimatePresence } from "framer-motion";

// /**
//  * StackVisualizer (Universal JSON Compatible)
//  * - Handles both string and object highlight formats
//  * - Compatible with Gemini 2.5 Flash output
//  * - Works with universal JSON schema
//  */

// export default function StackVisualizer({ jsonData }) {
//   const [currentStep, setCurrentStep] = useState(0);
//   const [structures, setStructures] = useState({});
//   const [action, setAction] = useState("");
//   const [playing, setPlaying] = useState(true);
//   const contentScrollRef = useRef(null);

//   const steps = jsonData.steps || [];
//   const current = steps[currentStep] || {};
//   const allStructures = jsonData.visualLayout?.structures || [];

//   // Parse input safely
//   let inputArray = [];
//   if (Array.isArray(jsonData.sampleInput)) {
//     inputArray = jsonData.sampleInput;
//   } else if (typeof jsonData.sampleInput === "string") {
//     inputArray = jsonData.sampleInput.replaceAll('"', "").split("");
//   } else if (typeof jsonData.sampleInput === "object" && jsonData.sampleInput !== null) {
//     inputArray = Object.entries(jsonData.sampleInput).map(
//       ([key, val]) => `${key}: ${val}`
//     );
//   }

//   // Initialize structures from JSON
//   useEffect(() => {
//     const initialState = {};
//     allStructures.forEach((s) => {
//       initialState[s.id] = { ...s };
//     });
//     setStructures(initialState);
//   }, [jsonData]);

//   // Apply state changes for current step
//   useEffect(() => {
//     if (current.stateChange) {
//       setStructures((prev) => {
//         const newStructs = { ...prev };
//         for (const [key, value] of Object.entries(current.stateChange)) {
//           if (newStructs[key]) {
//             newStructs[key] = { ...newStructs[key], data: value };
//           }
//         }
//         return newStructs;
//       });
//     }
//     if (current.action) setAction(current.action);
//   }, [currentStep]);

//   // Auto-play logic
//   useEffect(() => {
//     if (playing && currentStep < steps.length - 1) {
//       const timer = setTimeout(() => setCurrentStep((p) => p + 1), 1800);
//       return () => clearTimeout(timer);
//     }
//   }, [playing, currentStep, steps.length]);

//   const handleNext = () =>
//     currentStep < steps.length - 1 && setCurrentStep((s) => s + 1);
//   const handlePrev = () => currentStep > 0 && setCurrentStep((s) => s - 1);
//   const handleReset = () => {
//     setCurrentStep(0);
//     setPlaying(true);
//     const resetState = {};
//     allStructures.forEach((s) => (resetState[s.id] = { ...s }));
//     setStructures(resetState);
//   };

//   // Normalize highlight format (handle both string and object)
//   const normalizeHighlight = (highlight) => {
//     if (!highlight) return [];
//     return highlight.map((item) => {
//       if (typeof item === "string") {
//         return item; // Already in "id:index" format
//       } else if (typeof item === "object" && item.structure && item.index !== undefined) {
//         return `${item.structure}:${item.index}`; // Convert object to string
//       }
//       return null;
//     }).filter(Boolean);
//   };

//   const normalizedHighlight = normalizeHighlight(current.highlight || []);

//   // Categorize structures
//   const stacks = Object.values(structures).filter((s) => s.type === "stack");
//   const queues = Object.values(structures).filter((s) => s.type === "queue");
//   const arrays = Object.values(structures).filter((s) => s.type === "array");
//   const variables = Object.values(structures).filter((s) => s.type === "variable");
//   const matrices = Object.values(structures).filter((s) => s.type === "matrix");
//   const results = Object.values(structures).filter((s) => s.type === "result");
//   const linkedLists = Object.values(structures).filter(
//     (s) => s.type === "linkedList" || s.type === "list"
//   );

//   const isFinalStep = currentStep === steps.length - 1;

//   // Highlight logic
//   const isHighlighted = (structId, index) => {
//     return normalizedHighlight.includes(`${structId}:${index}`);
//   };

//   return (
//     <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col justify-between fixed inset-0 overflow-hidden">
//       {/* Header */}
//       <div className="py-4 px-6 text-center text-2xl font-bold tracking-wide text-cyan-400 border-b border-gray-800 bg-gray-900 shadow-md">
//         {jsonData.questionName || "Stack Visualizer"}
//       </div>

//       {/* Scrollable Content Area */}
//       <div
//         ref={contentScrollRef}
//         className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
//         style={{
//           paddingBottom: "220px",
//           scrollBehavior: "smooth",
//         }}
//       >
//         {/* Input Array */}
//         {inputArray.length > 0 && (
//           <motion.div
//             initial={{ opacity: 0, y: -20 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="flex justify-center"
//           >
//             <div className="bg-gray-900 border-2 border-gray-800 rounded-xl p-6 shadow-lg">
//               <div className="text-sm text-cyan-400 font-semibold mb-3 text-center">
//                 Input
//               </div>
//               <div className="flex gap-3 flex-wrap justify-center">
//                 {inputArray.map((ch, i) => (
//                   <motion.div
//                     key={i}
//                     animate={{
//                       scale:
//                         current.stateChange?.i === i ||
//                         current.elements?.includes(i)
//                           ? 1.15
//                           : 1,
//                       boxShadow:
//                         current.stateChange?.i === i ||
//                         current.elements?.includes(i)
//                           ? "0 0 15px rgba(34, 211, 238, 0.8)"
//                           : "none",
//                     }}
//                     transition={{
//                       type: "spring",
//                       stiffness: 300,
//                       damping: 18,
//                     }}
//                     className="w-12 h-12 flex items-center justify-center rounded-lg font-bold text-lg border-2 border-cyan-500 bg-gray-800 text-cyan-300 hover:bg-cyan-600 hover:text-black transition-all"
//                   >
//                     {ch}
//                   </motion.div>
//                 ))}
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {/* Main Content Grid */}
//         <div className="grid grid-cols-12 gap-6 min-h-96">
//           {/* Left Panel - Variables & Action */}
//           <div className="col-span-2 space-y-4">
//             {/* Current Action */}
//             <motion.div
//               layout
//               className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md sticky top-0"
//             >
//               <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
//                 Action
//               </div>
//               <motion.div
//                 key={action}
//                 initial={{ opacity: 0, y: -6 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.3 }}
//                 className="text-base font-semibold text-cyan-300 min-h-8 flex items-center"
//               >
//                 {action || "—"}
//               </motion.div>
//             </motion.div>

//             {/* Condition */}
//             {current.condition && (
//               <motion.div
//                 layout
//                 className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md"
//               >
//                 <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
//                   Condition
//                 </div>
//                 <div className="text-sm text-gray-300 font-mono mb-2">
//                   {current.condition.expression}
//                 </div>
//                 <div
//                   className={`text-sm font-bold ${
//                     current.condition.result
//                       ? "text-green-400"
//                       : "text-red-400"
//                   }`}
//                 >
//                   {current.condition.result ? "✓ True" : "✗ False"}
//                 </div>
//               </motion.div>
//             )}

//             {/* Variables */}
//             {variables.length > 0 && (
//               <motion.div
//                 layout
//                 className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md"
//               >
//                 <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-3">
//                   Variables
//                 </div>
//                 <div className="space-y-2">
//                   {variables.map((v) => (
//                     <motion.div
//                       key={v.id}
//                       layout
//                       className="flex justify-between text-sm border-b border-gray-800 pb-2 last:border-0"
//                     >
//                       <span className="text-gray-400">{v.label || v.id}</span>
//                       <span className="text-cyan-300 font-bold">{v.value}</span>
//                     </motion.div>
//                   ))}
//                 </div>
//               </motion.div>
//             )}
//           </div>

//           {/* Center Panel - Primary Structures (Stacks & Queues) */}
//           <div className="col-span-8 space-y-6">
//             {/* Multiple Stacks */}
//             {stacks.map((stack, stackIdx) => (
//               <motion.div
//                 key={stack.id}
//                 layout
//                 className="flex flex-col items-center gap-2"
//               >
//                 <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
//                   {stack.label || `Stack ${stackIdx + 1}`}
//                 </div>

//                 <div className="relative">
//                   {/* Stack Container */}
//                   <div className="w-56 min-h-80 border-4 border-cyan-500 rounded-xl bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col-reverse items-center justify-start overflow-hidden shadow-2xl p-2">
//                     <AnimatePresence mode="popLayout">
//                       {stack.data && stack.data.length > 0 ? (
//                         stack.data.map((value, idx) => (
//                           <motion.div
//                             key={`${value}-${idx}`}
//                             layout
//                             initial={{ opacity: 0, y: -80, scale: 0.8 }}
//                             animate={{ opacity: 1, y: 0, scale: 1 }}
//                             exit={{ opacity: 0, y: -100, scale: 0.8 }}
//                             transition={{
//                               type: "spring",
//                               stiffness: 300,
//                               damping: 20,
//                             }}
//                             className={`w-40 h-14 mb-2 border-2 font-bold text-lg flex items-center justify-center rounded-lg shadow-lg transition-all ${
//                               isHighlighted(stack.id, idx)
//                                 ? "border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black scale-105"
//                                 : "border-cyan-400 bg-gradient-to-br from-cyan-500 to-cyan-700 text-black"
//                             }`}
//                           >
//                             {value}
//                           </motion.div>
//                         ))
//                       ) : (
//                         <motion.div
//                           initial={{ opacity: 0 }}
//                           animate={{ opacity: 0.5 }}
//                           className="text-gray-500 italic text-center py-16"
//                         >
//                           Empty Stack
//                         </motion.div>
//                       )}
//                     </AnimatePresence>
//                   </div>

//                   {/* Stack Pointer */}
//                   <div className="absolute -right-24 top-0 text-sm text-cyan-400 font-mono">
//                     <div className="mb-1">TOP</div>
//                     <div className="text-lg font-bold text-cyan-300">
//                       {stack.data?.length ? stack.data.length - 1 : "—"}
//                     </div>
//                   </div>

//                   {/* Size Indicator */}
//                   <div className="absolute -left-20 top-0 text-sm text-cyan-400 font-mono">
//                     <div className="mb-1">SIZE</div>
//                     <div className="text-lg font-bold text-cyan-300">
//                       {stack.data?.length || 0}
//                     </div>
//                   </div>
//                 </div>
//               </motion.div>
//             ))}

//             {/* Queues */}
//             {queues.map((queue, qIdx) => (
//               <motion.div
//                 key={queue.id}
//                 layout
//                 className="flex flex-col items-center gap-2"
//               >
//                 <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
//                   {queue.label || `Queue ${qIdx + 1}`}
//                 </div>

//                 <div className="relative w-full">
//                   <div className="bg-gray-900 border-4 border-purple-500 rounded-lg p-4">
//                     <div className="flex gap-2 justify-start overflow-x-auto pb-2">
//                       <div className="text-xs text-purple-400 font-bold min-w-max">
//                         FRONT
//                       </div>
//                       {queue.data && queue.data.length > 0 ? (
//                         queue.data.map((value, idx) => (
//                           <motion.div
//                             key={`q-${idx}`}
//                             layout
//                             initial={{ opacity: 0, x: -20 }}
//                             animate={{ opacity: 1, x: 0 }}
//                             exit={{ opacity: 0, x: -20 }}
//                             className={`w-14 h-14 border-2 font-bold text-sm flex items-center justify-center rounded-lg flex-shrink-0 transition-all ${
//                               isHighlighted(queue.id, idx)
//                                 ? "border-yellow-400 bg-yellow-500 text-black"
//                                 : "border-purple-400 bg-purple-600 text-white"
//                             }`}
//                           >
//                             {value}
//                           </motion.div>
//                         ))
//                       ) : (
//                         <div className="text-gray-500 italic text-sm">
//                           Empty
//                         </div>
//                       )}
//                       <div className="text-xs text-purple-400 font-bold min-w-max self-center">
//                         REAR
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </motion.div>
//             ))}

//             {/* Matrices/Grids */}
//             {matrices.map((matrix) => (
//               <motion.div
//                 key={matrix.id}
//                 layout
//                 className="flex flex-col items-center gap-2"
//               >
//                 <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
//                   {matrix.label || "Matrix"}
//                 </div>

//                 <div className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4">
//                   <div
//                     style={{
//                       display: "grid",
//                       gridTemplateColumns: `repeat(${matrix.cols || 3}, minmax(50px, 1fr))`,
//                       gap: "8px",
//                     }}
//                   >
//                     {matrix.data && matrix.data.map((value, idx) => (
//                       <motion.div
//                         key={`m-${idx}`}
//                         className={`w-14 h-14 border-2 font-bold flex items-center justify-center rounded-lg transition-all ${
//                           isHighlighted(matrix.id, idx)
//                             ? "border-yellow-400 bg-yellow-500 text-black"
//                             : "border-green-400 bg-green-600 text-white"
//                         }`}
//                       >
//                         {value}
//                       </motion.div>
//                     ))}
//                   </div>
//                 </div>
//               </motion.div>
//             ))}
//           </div>

//           {/* Right Panel - Arrays & Results */}
//           <div className="col-span-2 space-y-4">
//             {/* Arrays */}
//             {arrays.map((arr) => (
//               <motion.div
//                 key={arr.id}
//                 layout
//                 className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md"
//               >
//                 <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-3">
//                   {arr.label || arr.id}
//                 </div>
//                 <div className="flex flex-col gap-2">
//                   {arr.data && arr.data.length > 0 ? (
//                     arr.data.map((v, i) => (
//                       <motion.div
//                         key={`arr-${i}`}
//                         layout
//                         className={`w-full h-10 border-2 rounded-md text-sm font-bold flex items-center justify-center transition-all ${
//                           isHighlighted(arr.id, i)
//                             ? "border-yellow-400 bg-yellow-500 text-black"
//                             : "border-cyan-400 bg-gray-800 text-cyan-300"
//                         }`}
//                       >
//                         [{i}] {v}
//                       </motion.div>
//                     ))
//                   ) : (
//                     <div className="text-gray-500 italic text-sm">—</div>
//                   )}
//                 </div>
//               </motion.div>
//             ))}

//             {/* Results */}
//             {results.map((res) => (
//               <motion.div
//                 key={res.id}
//                 layout
//                 className="bg-gray-900 border-2 border-green-700 rounded-lg p-4 shadow-md"
//               >
//                 <div className="text-xs text-green-400 font-bold uppercase tracking-widest mb-2">
//                   {res.label || "Result"}
//                 </div>
//                 <motion.div
//                   key={res.value}
//                   initial={{ opacity: 0, scale: 0.9 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                   className="text-xl font-bold text-green-300 text-center"
//                 >
//                   {res.value}
//                 </motion.div>
//               </motion.div>
//             ))}

//             {/* Step Progress */}
//             <motion.div
//               layout
//               className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md sticky bottom-0"
//             >
//               <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
//                 Progress
//               </div>
//               <motion.div
//                 key={currentStep}
//                 initial={{ y: -6, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ duration: 0.3 }}
//                 className="text-2xl font-bold text-cyan-300"
//               >
//                 {currentStep + 1}/{steps.length}
//               </motion.div>
//             </motion.div>
//           </div>
//         </div>
//       </div>

//       {/* Fixed Bottom Message */}
//       <div className="border-t border-gray-800 bg-gray-900 px-6 py-3 text-center">
//         <motion.div
//           key={currentStep}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 0.3 }}
//           className="text-base font-semibold text-cyan-300 min-h-6"
//         >
//           {isFinalStep
//             ? jsonData.endMessage || "✅ Visualization Complete!"
//             : current.message || "Processing..."}
//         </motion.div>
//       </div>

//       {/* Fixed Bottom Controls */}
//       <div className="flex justify-center items-center gap-4 py-4 px-6 border-t border-gray-800 bg-gray-950 shadow-2xl">
//         <motion.button
//           onClick={handlePrev}
//           disabled={currentStep === 0}
//           whileHover={{ scale: currentStep === 0 ? 1 : 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
//         >
//           ⏮ Prev
//         </motion.button>

//         <motion.button
//           onClick={() => setPlaying((p) => !p)}
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           className={`px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${
//             playing
//               ? "bg-red-600 hover:bg-red-700 text-white"
//               : "bg-cyan-500 hover:bg-cyan-400 text-black"
//           }`}
//         >
//           {playing ? "⏸ Pause" : "▶ Play"}
//         </motion.button>

//         <motion.button
//           onClick={handleNext}
//           disabled={currentStep >= steps.length - 1}
//           whileHover={{ scale: currentStep >= steps.length - 1 ? 1 : 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
//         >
//           Next ⏭
//         </motion.button>

//         <motion.button
//           onClick={handleReset}
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.95 }}
//           className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold transition-all"
//         >
//           🔄 Reset
//         </motion.button>

//         <motion.div
//           className="text-sm text-cyan-400 font-semibold ml-4 bg-cyan-900/30 px-3 py-1 rounded-full"
//           animate={{ scale: 1 }}
//           key={currentStep}
//           initial={{ scale: 1.1 }}
//           transition={{ type: "spring", stiffness: 300 }}
//         >
//           {currentStep + 1} / {steps.length}
//         </motion.div>
//       </div>
//     </div>
//   );
// }