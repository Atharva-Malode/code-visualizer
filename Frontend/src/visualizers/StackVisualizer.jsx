import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

/**
 * StackVisualizer - Enhanced with YouTube-Style Captions
 * =======================================================
 * - YouTube-style bottom-center captions
 * - Enhanced UI polish and spacing
 * - Better animations and transitions
 * - Improved visual hierarchy
 * - Added: Solution button navigation
 */

export default function StackVisualizer({ jsonData, originalPrompt }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [structures, setStructures] = useState({});
  const [action, setAction] = useState("");
  const [condition, setCondition] = useState(null);
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState(true);
  const [endReached, setEndReached] = useState(false);
  const timerRef = useRef(null);
  const navigate = useNavigate();

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

  const handleSolution = () => {
    navigate("/solution", {
      state: {
        data: jsonData,
        originalPrompt: originalPrompt,
      },
    });
  };

  const showSolutionButton = !playing;

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

            {showSolutionButton && (
              <motion.button
                onClick={handleSolution}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold py-2.5 rounded-lg transition-all duration-300 mb-4"
              >
                📚 View Solution
              </motion.button>
            )}

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