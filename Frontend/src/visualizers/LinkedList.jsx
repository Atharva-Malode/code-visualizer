import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LinkedListVisualizer (Production-Ready - Robust)
 * ===============================================
 * - Accepts jsonData matching universal schema
 * - Handles ALL linked list formats (singly, doubly, circular)
 * - Robust error handling
 * - Side panel for variables and results
 * - Smooth animations with proper state management
 * - Fixed layout: no vacant space
 * - Handles null/undefined gracefully
 *
 * Props:
 *  - jsonData: visualization JSON
 *  - autoplay: boolean (start automatically) default true
 *  - stepDelay: ms per step (default 1200)
 *  - debug: boolean to show logs
 */
export default function LinkedListVisualizer({
  jsonData,
  autoplay = true,
  stepDelay = 1200,
  debug = false,
}) {
  const [lists, setLists] = useState({});
  const [pointers, setPointers] = useState({});
  const [variables, setVariables] = useState({});
  const [action, setAction] = useState("");
  const [condition, setCondition] = useState(null);
  const [message, setMessage] = useState("");
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [playing, setPlaying] = useState(Boolean(autoplay));
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const steps = jsonData?.steps || [];
  const structures = jsonData?.visualLayout?.structures || [];

  const log = (...args) => (debug ? console.log("[LLViz]", ...args) : null);

  /**
   * Convert raw data to node format
   * Handles both array and object formats
   */
  const normalizeNodeData = (rawData) => {
    if (!Array.isArray(rawData)) {
      log("Warning: Expected array for linked list data, got:", typeof rawData);
      return [];
    }

    return rawData.map((val, idx) => {
      // If already a node object, use as-is but ensure all fields exist
      if (val && typeof val === "object" && "value" in val) {
        return {
          id: `node-${idx}`,
          value: val.value,
          next: val.next !== undefined ? val.next : idx < rawData.length - 1 ? idx + 1 : null,
          prev: val.prev !== undefined ? val.prev : null,
        };
      }

      // If primitive value, convert to node
      return {
        id: `node-${idx}`,
        value: val,
        next: idx < rawData.length - 1 ? idx + 1 : null,
        prev: null,
      };
    });
  };

  // Initialize on jsonData change
  useEffect(() => {
    try {
      const newLists = {};
      const newPointers = {};
      const newVars = {};

      for (const s of structures) {
        const type = (s.type || "").toLowerCase();

        if (type === "linkedlist" || type === "list") {
          const nodes = normalizeNodeData(s.data);
          newLists[s.id] = {
            id: s.id,
            label: s.label || s.id,
            nodes,
            type,
            doubly: s.doubly ?? false,
            circular: s.circular ?? false,
          };

          if (s.pointers && typeof s.pointers === "object") {
            newPointers[s.id] = { ...s.pointers };
          } else {
            newPointers[s.id] = {};
          }
        } else if (type === "variable" || type === "var") {
          newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
        } else if (type === "result") {
          newVars[s.id] = s.value ?? null;
        }
      }

      setLists(newLists);
      setPointers(newPointers);
      setVariables(newVars);
      setCurrentStepIdx(0);
      setPlaying(Boolean(autoplay));
      setError(null);
      setAction("");
      setMessage("");
      setCondition(null);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      log("Initialized lists", newLists);
    } catch (err) {
      log("Error initializing:", err);
      setError(`Initialization error: ${err.message}`);
    }
  }, [jsonData]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Apply state changes from a step
   */
  function applyStateChange(stateChange = {}) {
    if (!stateChange || typeof stateChange !== "object") return;

    try {
      // 1) Pointer updates
      if (stateChange.pointers && typeof stateChange.pointers === "object") {
        setPointers((prev) => {
          const copy = { ...prev };
          for (const [listId, pUpdates] of Object.entries(stateChange.pointers)) {
            copy[listId] = { ...(copy[listId] || {}) };
            for (const [pName, pVal] of Object.entries(pUpdates)) {
              copy[listId][pName] = pVal;
            }
          }
          log("Applied pointers", stateChange.pointers);
          return copy;
        });
      }

      // 2) List node replacements (data updates)
      for (const [key, val] of Object.entries(stateChange)) {
        if (key === "pointers" || key === "variables") continue;

        if (Array.isArray(val) && lists[key]) {
          setLists((prev) => {
            const cp = { ...prev };
            const nodes = normalizeNodeData(val);
            cp[key] = { ...cp[key], nodes };
            log("Updated list nodes for", key);
            return cp;
          });
        }
      }

      // 3) Variables
      if (stateChange.variables && typeof stateChange.variables === "object") {
        setVariables((prev) => ({ ...prev, ...stateChange.variables }));
        log("Applied variables", stateChange.variables);
      }

      // 4) Direct variable changes
      const directVars = {};
      for (const [k, v] of Object.entries(stateChange)) {
        if (k === "pointers" || k === "variables") continue;
        if (!Array.isArray(v) && !lists[k]) {
          directVars[k] = v;
        }
      }
      if (Object.keys(directVars).length) {
        setVariables((prev) => ({ ...prev, ...directVars }));
        log("Applied direct variables", directVars);
      }
    } catch (err) {
      log("Error applying state change:", err);
      setError(`State change error: ${err.message}`);
    }
  }

  /**
   * Run a step
   */
  function runStep(idx) {
    try {
      const step = steps[idx];
      if (!step) return;

      setAction(step.action || "");
      setMessage(step.message || "");
      setCondition(step.condition || null);

      applyStateChange(step.stateChange);
    } catch (err) {
      log("Error running step:", err);
      setError(`Step error: ${err.message}`);
    }
  }

  // Auto-advance
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (currentStepIdx >= steps.length) {
      setPlaying(false);
      return;
    }

    runStep(currentStepIdx);

    if (currentStepIdx < steps.length - 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCurrentStepIdx((s) => s + 1);
      }, stepDelay);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPlaying(false), stepDelay);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, currentStepIdx, steps.length, stepDelay]);

  // Controls
  const handleNext = () => {
    if (currentStepIdx < steps.length - 1) {
      setPlaying(false);
      setCurrentStepIdx((s) => s + 1);
    }
  };

  const handlePrev = () => {
    setPlaying(false);
    const target = Math.max(0, currentStepIdx - 1);

    // Reset to initial state
    const newLists = {};
    const newPointers = {};
    const newVars = {};

    for (const s of structures) {
      const type = (s.type || "").toLowerCase();
      if (type === "linkedlist" || type === "list") {
        const nodes = normalizeNodeData(s.data);
        newLists[s.id] = {
          id: s.id,
          label: s.label || s.id,
          nodes,
          type,
          doubly: s.doubly ?? false,
          circular: s.circular ?? false,
        };
        newPointers[s.id] = s.pointers ? { ...s.pointers } : {};
      } else if (type === "variable" || type === "var" || type === "result") {
        newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
      }
    }

    setLists(newLists);
    setPointers(newPointers);
    setVariables(newVars);

    // Re-apply steps up to target
    for (let i = 0; i < target; i++) {
      const step = steps[i];
      if (step && step.stateChange) {
        applyStateChange(step.stateChange);
      }
    }

    setCurrentStepIdx(target);
  };

  const handleReset = () => {
    setPlaying(false);
    setCurrentStepIdx(0);
    setAction("");
    setMessage("");
    setCondition(null);

    const newLists = {};
    const newPointers = {};
    const newVars = {};

    for (const s of structures) {
      const type = (s.type || "").toLowerCase();
      if (type === "linkedlist" || type === "list") {
        const nodes = normalizeNodeData(s.data);
        newLists[s.id] = {
          id: s.id,
          label: s.label || s.id,
          nodes,
          type,
          doubly: s.doubly ?? false,
          circular: s.circular ?? false,
        };
        newPointers[s.id] = s.pointers ? { ...s.pointers } : {};
      } else if (type === "variable" || type === "var" || type === "result") {
        newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
      }
    }

    setLists(newLists);
    setPointers(newPointers);
    setVariables(newVars);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setTimeout(() => {
      setPlaying(Boolean(autoplay));
    }, 50);
  };

  // Helpers
  const normalizeHighlight = (highlight = []) => {
    if (!Array.isArray(highlight)) return [];
    return highlight
      .map((h) => {
        if (typeof h === "string") return h;
        if (h && typeof h === "object" && h.structure && Number.isInteger(h.index)) {
          return `${h.structure}:${h.index}`;
        }
        return null;
      })
      .filter(Boolean);
  };

  const currentHighlight = normalizeHighlight(steps[currentStepIdx]?.highlight || []);
  const currentStep = steps[currentStepIdx];

  // Get variable entries
  const varEntries = Object.entries(structures)
    .filter(([_, s]) => {
      const t = (s.type || "").toLowerCase();
      return t === "variable" || t === "var" || t === "result";
    })
    .map(([_, s]) => ({
      id: s.id,
      label: s.label || s.id,
      isResult: (s.type || "").toLowerCase() === "result",
    }));

  if (error) {
    return (
      <div className="w-full h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md text-center">
          <div className="text-red-300 font-bold mb-2">⚠️ Visualization Error</div>
          <div className="text-sm text-red-200">{error}</div>
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-semibold"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 shadow-md">
        <div className="text-2xl font-bold text-cyan-400">
          {jsonData?.questionName || "Linked List Visualizer"}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          Step {Math.min(currentStepIdx + 1, steps.length)} / {steps.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: List Display (70%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900/40 rounded-lg border border-cyan-500/20">
          {/* Lists Container */}
          <div className="flex-1 overflow-y-auto space-y-4 p-4 pr-3">
            <AnimatePresence mode="wait">
              {Object.values(lists).length > 0 ? (
                Object.values(lists).map((list) => {
                  const nodes = list.nodes || [];
                  const pointersForList = pointers[list.id] || {};

                  return (
                    <motion.div
                      key={list.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-gray-900 p-4 rounded-lg border border-gray-800 shadow-lg"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-bold text-cyan-400">{list.label}</div>
                        <div className="text-xs text-gray-400">
                          {nodes.length} node{nodes.length !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* Pointers */}
                      {Object.entries(pointersForList).length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-3 pb-3 border-b border-gray-800">
                          <AnimatePresence mode="popLayout">
                            {Object.entries(pointersForList).map(([pName, idx]) => (
                              <motion.div
                                key={pName}
                                layout
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ type: "spring", stiffness: 250, damping: 20 }}
                                className="bg-gradient-to-r from-cyan-900/40 to-cyan-800/20 px-2.5 py-1.5 rounded text-xs text-cyan-200 font-semibold border border-cyan-700/50 shadow-md"
                              >
                                <span className="text-cyan-300">{pName}</span>
                                <span className="text-gray-400 mx-1">→</span>
                                <span className="text-cyan-400 font-bold">
                                  {idx === null || idx === undefined ? "null" : `Node ${idx}`}
                                </span>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Nodes */}
                      <div className="flex flex-wrap gap-3">
                        <AnimatePresence mode="popLayout">
                          {nodes.length > 0 ? (
                            nodes.map((node, idx) => {
                              const hlKey = `${list.id}:${idx}`;
                              const isHighlighted = currentHighlight.includes(hlKey);
                              const isPointed = Object.values(pointersForList || {}).includes(idx);

                              return (
                                <motion.div
                                  layout
                                  key={node.id}
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{
                                    opacity: 1,
                                    scale: isHighlighted ? 1.15 : isPointed ? 1.08 : 1,
                                    y: 0,
                                    boxShadow: isHighlighted
                                      ? "0 0 20px rgba(250, 204, 21, 0.6)"
                                      : isPointed
                                        ? "0 0 15px rgba(34, 211, 238, 0.5)"
                                        : "none",
                                  }}
                                  exit={{ opacity: 0, scale: 0.6, y: -10 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 280,
                                    damping: 22,
                                  }}
                                  className={`w-24 h-24 rounded-lg border-2 p-2 flex flex-col items-center justify-center font-bold transition-colors ${
                                    isHighlighted
                                      ? "bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border-yellow-400 text-yellow-200"
                                      : isPointed
                                        ? "bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-cyan-400 text-cyan-200"
                                        : "bg-gray-800 border-gray-700 text-gray-300"
                                  }`}
                                >
                                  <div className="text-lg truncate w-full text-center">
                                    {String(node.value)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">[{idx}]</div>
                                </motion.div>
                              );
                            })
                          ) : (
                            <div className="text-gray-500 italic text-center py-8 w-full">
                              Empty List
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-gray-500 italic text-center py-12">
                  No linked lists to display
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Message Bar */}
          <motion.div
            key={currentStepIdx}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-gray-800 bg-gray-900/50 px-4 py-3 text-sm text-gray-300 min-h-12 flex items-center"
          >
            {currentStep?.message || jsonData?.endMessage || "Ready"}
          </motion.div>
        </div>

        {/* Right: Sidebar (30%) */}
        <div className="w-80 flex flex-col gap-4 min-w-0 overflow-y-auto">
          {/* Variables Panel */}
          {varEntries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg flex-1 overflow-y-auto"
            >
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
                📊 Variables & Results
              </div>
              <div className="space-y-2.5">
                <AnimatePresence mode="wait">
                  {varEntries.map(({ id, label, isResult }) => (
                    <motion.div
                      key={id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className={`p-3 rounded-lg border transition-all ${
                        isResult
                          ? "bg-green-900/20 border-green-700/40"
                          : "bg-gray-800/50 border-gray-700/50"
                      }`}
                    >
                      <div className="text-xs text-gray-400 font-semibold mb-1">
                        {label}
                        {isResult && " ✓"}
                      </div>
                      <motion.div
                        key={`${id}-${variables[id]}`}
                        initial={{ scale: 1.1, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={`text-sm font-bold font-mono truncate ${
                          isResult ? "text-green-300" : "text-cyan-300"
                        }`}
                      >
                        {variables[id] === null || variables[id] === undefined
                          ? "—"
                          : String(variables[id])}
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Action & Condition */}
          {currentStep && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-lg"
            >
              {currentStep.action && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                    Action
                  </div>
                  <div className="text-sm font-bold text-cyan-300">
                    {currentStep.action}
                  </div>
                </div>
              )}

              {currentStep.condition && (
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                    Condition
                  </div>
                  <div className="text-xs text-gray-300 font-mono mb-1.5">
                    {currentStep.condition.expression}
                  </div>
                  <motion.div
                    animate={{ scale: 1 }}
                    className={`inline-block text-xs font-bold px-2 py-1 rounded ${
                      currentStep.condition.result
                        ? "bg-green-900/40 text-green-300 border border-green-700/50"
                        : "bg-red-900/40 text-red-300 border border-red-700/50"
                    }`}
                  >
                    {currentStep.condition.result ? "✓ TRUE" : "✗ FALSE"}
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-lg"
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={handlePrev}
                disabled={currentStepIdx === 0}
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              >
                ⏮ Prev
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                className={`px-3 py-2 rounded font-semibold text-sm transition-colors ${
                  playing
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }`}
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                onClick={handleNext}
                disabled={currentStepIdx >= steps.length - 1}
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              >
                Next ⏭
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm transition-colors"
              >
                🔄 Reset
              </button>
            </div>

            <motion.div
              className="text-sm text-cyan-400 font-semibold text-center bg-cyan-900/30 px-3 py-2 rounded border border-cyan-700/50"
              key={currentStepIdx}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {currentStepIdx + 1} / {steps.length}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}