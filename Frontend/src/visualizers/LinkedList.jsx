import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LinkedListVisualizer - Multi-Format Support
 * ==========================================
 * Handles THREE highlight formats:
 * 1. Simple node IDs: "listA_node_0"
 * 2. Object format: { "structure": "linked_list", "node": "node_1", "label": "head_ptr" }
 * 3. Index format: "listA:0"
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
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [playing, setPlaying] = useState(Boolean(autoplay));
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const steps = jsonData?.steps || [];
  const structures = jsonData?.visualLayout?.structures || [];

  const log = (...args) => (debug ? console.log("[LLViz]", ...args) : null);

  /**
   * Parse node ID: "listA_node_0" → { listId: "listA", nodeIdx: 0 }
   * SAFE: Checks if input is string first
   */
  const parseNodeId = (nodeId) => {
    if (typeof nodeId !== "string") {
      return null;
    }

    const match = nodeId.match(/^([a-zA-Z0-9_]+)_node_(\d+)$/);
    if (match) {
      return { listId: match[1], nodeIdx: parseInt(match[2]) };
    }
    return null;
  };

  /**
   * Normalize node data
   */
  const normalizeNodeData = (rawData) => {
    if (!Array.isArray(rawData)) return [];
    return rawData.map((val, idx) => {
      if (typeof val === "object" && val.id) {
        // Format: { "id": "node_1", "value": 1 }
        return {
          id: val.id,
          value: val.value,
          next: idx < rawData.length - 1 ? idx + 1 : null,
          prev: null,
        };
      } else {
        // Format: [1, 2, 3]
        return {
          id: `node-${idx}`,
          value: val && typeof val === "object" ? val.value : val,
          next: idx < rawData.length - 1 ? idx + 1 : null,
          prev: null,
        };
      }
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
            data: s.data, // Keep original data
          };
          newPointers[s.id] = {};
        } else if (type === "pointer" || type === "variable" || type === "var") {
          newPointers[s.id] = null;
        } else if (type === "result") {
          newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
        }
      }

      setLists(newLists);
      setPointers(newPointers);
      setVariables(newVars);
      setCurrentStepIdx(0);
      setPlaying(Boolean(autoplay));
      setError(null);

      if (timerRef.current) clearTimeout(timerRef.current);

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
   * Handles pointer updates with node IDs
   */
  function applyStateChange(stateChange = {}) {
    if (!stateChange || typeof stateChange !== "object") return;

    try {
      const newPointerUpdates = {};
      const newVarUpdates = {};

      for (const [key, value] of Object.entries(stateChange)) {
        // Check if it's a pointer/variable defined in structures
        const structure = structures.find((s) => s.id === key);

        if (structure) {
          const type = (structure.type || "").toLowerCase();

          if (type === "pointer" || type === "variable" || type === "var") {
            // Check if value is an object with nested structure
            if (typeof value === "object" && value !== null && value.value !== undefined) {
              newPointerUpdates[key] = value.value;
            } else if (
              typeof value === "string" &&
              value.match(/^[a-zA-Z0-9_]+_node_\d+$/)
            ) {
              // Node ID like "node_1"
              newPointerUpdates[key] = value;
            } else {
              // Direct value (null, string, number)
              newPointerUpdates[key] = value;
            }
            log(`Pointer/Var ${key} → ${value}`);
          } else if (type === "linkedlist" || type === "list") {
            // List data update
            if (value && value.data) {
              setLists((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  nodes: normalizeNodeData(value.data),
                  data: value.data,
                },
              }));
            }
          }
        }
      }

      // Update pointers state
      if (Object.keys(newPointerUpdates).length > 0) {
        setPointers((prev) => {
          const updated = { ...prev };
          for (const [ptrId, nodeId] of Object.entries(newPointerUpdates)) {
            updated[ptrId] = nodeId;
          }
          return updated;
        });
      }

      // Update variables
      if (Object.keys(newVarUpdates).length > 0) {
        setVariables((prev) => ({
          ...prev,
          ...newVarUpdates,
        }));
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
          data: s.data,
        };
        newPointers[s.id] = {};
      } else if (type === "pointer" || type === "variable" || type === "var") {
        newPointers[s.id] = null;
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
          data: s.data,
        };
        newPointers[s.id] = {};
      } else if (type === "pointer" || type === "variable" || type === "var") {
        newPointers[s.id] = null;
      }
    }

    setLists(newLists);
    setPointers(newPointers);
    setVariables(newVars);

    if (timerRef.current) clearTimeout(timerRef.current);

    setTimeout(() => {
      setPlaying(Boolean(autoplay));
    }, 50);
  };

  /**
   * Parse highlight objects to get which nodes should glow
   * Format: { "structure": "linked_list", "node": "node_1", "label": "head_ptr" }
   */
  const getCurrentHighlightedNodes = useMemo(() => {
    const step = steps[currentStepIdx];
    if (!step || !step.highlight) return new Set();

    const highlightedNodeIds = new Set();

    for (const h of step.highlight) {
      if (typeof h === "string") {
        // Format: "node_1" or "listA_node_0"
        highlightedNodeIds.add(h);
      } else if (typeof h === "object" && h.node) {
        // Format: { "structure": "linked_list", "node": "node_1", "label": "head_ptr" }
        highlightedNodeIds.add(h.node);
      }
    }

    return highlightedNodeIds;
  }, [currentStepIdx, steps]);

  /**
   * Get pointer labels for each node
   */
  const getPointerLabelsForNode = useMemo(() => {
    const pointerLabels = {}; // { "node_1": ["head_ptr", "prev_ptr"], ... }

    // Get all pointer entries
    const pointerStructures = structures.filter((s) => {
      const type = (s.type || "").toLowerCase();
      return type === "pointer" || type === "variable" || type === "var";
    });

    for (const ptrStruct of pointerStructures) {
      const ptrValue = pointers[ptrStruct.id];

      if (ptrValue) {
        // ptrValue could be "node_1" or "node_1" format
        if (!pointerLabels[ptrValue]) {
          pointerLabels[ptrValue] = [];
        }
        pointerLabels[ptrValue].push(ptrStruct.label || ptrStruct.id);
      }
    }

    return pointerLabels;
  }, [pointers, structures]);

  const currentStep = steps[currentStepIdx];

  if (error) {
    return (
      <div className="w-full h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md text-center">
          <div className="text-red-300 font-bold mb-2">⚠️ Error</div>
          <div className="text-sm text-red-200 mb-4">{error}</div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-semibold"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="text-2xl font-bold text-cyan-400">
          {jsonData?.questionName || "Linked List Visualizer"}
        </div>
        <div className="text-xs text-gray-400 mt-1 font-semibold tracking-wider uppercase">
          {jsonData?.patternType || "DSA Algorithm"}
        </div>
        <div className="text-sm text-gray-400 mt-2">
          Step {Math.min(currentStepIdx + 1, steps.length)} / {steps.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden pb-32">
        {/* Left: List Display (70%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900/40 rounded-lg border border-cyan-500/20 overflow-y-auto p-4">
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {Object.values(lists).map((list) => {
                const nodes = list.nodes || [];

                return (
                  <motion.div
                    key={list.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-gray-900 p-4 rounded-lg border border-gray-800"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-bold text-cyan-400">
                        {list.label}
                      </div>
                      <div className="text-xs text-gray-400">
                        {nodes.length} node{nodes.length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Nodes - Horizontal Layout */}
                    <div className="relative">
                      {nodes.length > 0 ? (
                        <div className="flex items-center gap-1 pb-12 pt-10">
                          {nodes.map((node, idx) => {
                            const isHighlighted =
                              getCurrentHighlightedNodes.has(node.id);
                            const pointersHere =
                              getPointerLabelsForNode[node.id] || [];
                            const hasNext =
                              node.next !== null &&
                              node.next !== undefined;
                            const nextPointer = node.next;

                            return (
                              <React.Fragment key={node.id}>
                                {/* Node */}
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.6 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 280,
                                    damping: 22,
                                  }}
                                  className="relative flex-shrink-0"
                                >
                                  {/* Pointer labels above node */}
                                  {pointersHere.length > 0 && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col gap-1 items-center z-20">
                                      {pointersHere.map((pName) => (
                                        <motion.div
                                          key={pName}
                                          initial={{
                                            opacity: 0,
                                            y: -8,
                                            scale: 0.8,
                                          }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                            scale: 1,
                                          }}
                                          exit={{
                                            opacity: 0,
                                            y: -8,
                                            scale: 0.8,
                                          }}
                                          className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border border-yellow-400 whitespace-nowrap"
                                        >
                                          {pName}
                                        </motion.div>
                                      ))}
                                      <div className="w-0.5 h-4 bg-gradient-to-b from-yellow-500 to-transparent" />
                                    </div>
                                  )}

                                  {/* Node box */}
                                  <motion.div
                                    animate={{
                                      scale: isHighlighted ? 1.15 : 1,
                                      boxShadow: isHighlighted
                                        ? "0 0 30px rgba(251, 146, 60, 0.9)"
                                        : pointersHere.length > 0
                                          ? "0 0 20px rgba(234, 179, 8, 0.7)"
                                          : "0 4px 6px rgba(0, 0, 0, 0.3)",
                                    }}
                                    transition={{
                                      type: "spring",
                                      stiffness: 300,
                                      damping: 20,
                                    }}
                                    className={`w-20 h-20 rounded-xl border-2 p-2 flex flex-col items-center justify-center font-bold relative transition-colors ${
                                      isHighlighted
                                        ? "bg-gradient-to-br from-orange-500/50 to-red-600/40 border-orange-400 text-orange-100"
                                        : pointersHere.length > 0
                                          ? "bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border-yellow-400 text-yellow-100"
                                          : "bg-gray-800/80 border-gray-600 text-gray-200"
                                    }`}
                                  >
                                    <div className="text-xl font-bold truncate w-full text-center">
                                      {String(node.value)}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                      [{node.id}]
                                    </div>
                                  </motion.div>
                                </motion.div>

                                {/* Arrow to next */}
                                {hasNext &&
                                  nextPointer === idx + 1 &&
                                  idx < nodes.length - 1 && (
                                    <motion.div
                                      initial={{
                                        opacity: 0,
                                        scaleX: 0,
                                      }}
                                      animate={{
                                        opacity: 1,
                                        scaleX: 1,
                                      }}
                                      exit={{ opacity: 0, scaleX: 0 }}
                                      className="flex items-center flex-shrink-0"
                                    >
                                      <div className="relative w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400">
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-cyan-400 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
                                      </div>
                                    </motion.div>
                                  )}

                                {/* Null terminator */}
                                {(!hasNext || nextPointer === null) && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center flex-shrink-0 ml-2"
                                  >
                                    <div className="w-6 h-0.5 bg-gray-600" />
                                    <div className="w-8 h-8 rounded border-2 border-gray-600 border-dashed flex items-center justify-center text-gray-500 text-xs font-bold">
                                      ∅
                                    </div>
                                  </motion.div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-gray-500 italic text-center py-12">
                          Empty List
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Sidebar (30%) */}
        <div className="w-80 flex flex-col gap-4 min-w-0">
          {/* Variables */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 border border-cyan-500/30 rounded-lg p-4 flex-1 overflow-y-auto"
          >
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
              📊 Variables & Pointers
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {structures.map((s) => {
                  const type = (s.type || "").toLowerCase();
                  if (
                    type !== "variable" &&
                    type !== "var" &&
                    type !== "result" &&
                    type !== "pointer"
                  ) {
                    return null;
                  }

                  const value = pointers[s.id] !== undefined ? pointers[s.id] : variables[s.id];
                  const isResult = type === "result";
                  const isPointer = type === "pointer" || type === "variable" || type === "var";

                  return (
                    <motion.div
                      key={s.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={`p-3 rounded-lg border transition-all ${
                        isResult
                          ? "bg-green-900/20 border-green-700/40"
                          : isPointer
                            ? "bg-yellow-900/20 border-yellow-700/40"
                            : "bg-gray-800/50 border-gray-700/50"
                      }`}
                    >
                      <div className="text-xs text-gray-400 font-semibold mb-1">
                        {s.label || s.id}
                        {isResult && " ✓"}
                      </div>
                      <motion.div
                        key={`${s.id}-${String(value)}`}
                        initial={{ scale: 1.1, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-sm font-bold font-mono truncate ${
                          isResult
                            ? "text-green-300"
                            : isPointer
                              ? "text-yellow-300"
                              : "text-cyan-300"
                        }`}
                      >
                        {value === null || value === undefined
                          ? "—"
                          : String(value)}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Action & Condition */}
          {currentStep && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4"
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

              {currentStep.message && (
                <div>
                  <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                    Step Info
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed">
                    {currentStep.message}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4"
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={handlePrev}
                disabled={currentStepIdx === 0}
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm"
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
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm"
              >
                Next ⏭
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm"
              >
                🔄 Reset
              </button>
            </div>

            <motion.div
              className="text-sm font-semibold text-center bg-cyan-900/30 px-3 py-2 rounded border border-cyan-700/50 text-cyan-400"
              key={currentStepIdx}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              {currentStepIdx + 1} / {steps.length}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* YouTube-Style Bottom Caption */}
      <AnimatePresence mode="wait">
        {currentStep?.message && (
          <motion.div
            key={currentStepIdx}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4"
          >
            <div className="bg-black/85 backdrop-blur-lg border border-cyan-500/40 rounded-xl px-8 py-4 shadow-2xl max-w-3xl">
              <p className="text-center text-white font-medium leading-relaxed text-sm md:text-base">
                {currentStep.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
// import React, { useEffect, useRef, useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";

// /**
//  * LinkedListVisualizer - Enhanced Production Version
//  * ==================================================
//  * Features:
//  * - Horizontal linked list layout with arrows
//  * - Pointer labels displayed directly on nodes
//  * - Smooth animations for any DSA linked list question
//  * - Supports reverse, merge, cycle detection, etc.
//  * - Visual indicators for next pointers and null termination
//  * - Handles singly, doubly, and circular lists
//  * - YouTube-style caption messages
//  */
// export default function LinkedListVisualizer({
//   jsonData,
//   autoplay = true,
//   stepDelay = 1200,
//   debug = false,
// }) {
//   const [lists, setLists] = useState({});
//   const [pointers, setPointers] = useState({});
//   const [variables, setVariables] = useState({});
//   const [action, setAction] = useState("");
//   const [condition, setCondition] = useState(null);
//   const [message, setMessage] = useState("");
//   const [currentStepIdx, setCurrentStepIdx] = useState(0);
//   const [playing, setPlaying] = useState(Boolean(autoplay));
//   const [error, setError] = useState(null);
//   const timerRef = useRef(null);

//   const steps = jsonData?.steps || [];
//   const structures = jsonData?.visualLayout?.structures || [];

//   const log = (...args) => (debug ? console.log("[LLViz]", ...args) : null);

//   /**
//    * Convert raw data to node format - FIXED to handle pointer-based next values
//    */
//   const normalizeNodeData = (rawData) => {
//     if (!Array.isArray(rawData)) {
//       log("Warning: Expected array for linked list data, got:", typeof rawData);
//       return [];
//     }

//     return rawData.map((val, idx) => {
//       if (val && typeof val === "object" && "value" in val) {
//         return {
//           id: `node-${idx}`,
//           value: val.value,
//           // Keep next as provided - it might point to any index or be null
//           next: val.next !== undefined ? val.next : (idx < rawData.length - 1 ? idx + 1 : null),
//           prev: val.prev !== undefined ? val.prev : null,
//         };
//       }

//       // For primitive values, default to sequential linking
//       return {
//         id: `node-${idx}`,
//         value: val,
//         next: idx < rawData.length - 1 ? idx + 1 : null,
//         prev: null,
//       };
//     });
//   };

//   // Initialize on jsonData change
//   useEffect(() => {
//     try {
//       const newLists = {};
//       const newPointers = {};
//       const newVars = {};

//       for (const s of structures) {
//         const type = (s.type || "").toLowerCase();

//         if (type === "linkedlist" || type === "list") {
//           const nodes = normalizeNodeData(s.data);
//           newLists[s.id] = {
//             id: s.id,
//             label: s.label || s.id,
//             nodes,
//             type,
//             doubly: s.doubly ?? false,
//             circular: s.circular ?? false,
//           };

//           if (s.pointers && typeof s.pointers === "object") {
//             newPointers[s.id] = { ...s.pointers };
//           } else {
//             newPointers[s.id] = {};
//           }
//         } else if (type === "variable" || type === "var") {
//           newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
//         } else if (type === "result") {
//           newVars[s.id] = s.value ?? null;
//         }
//       }

//       setLists(newLists);
//       setPointers(newPointers);
//       setVariables(newVars);
//       setCurrentStepIdx(0);
//       setPlaying(Boolean(autoplay));
//       setError(null);
//       setAction("");
//       setMessage("");
//       setCondition(null);

//       if (timerRef.current) {
//         clearTimeout(timerRef.current);
//       }

//       log("Initialized lists", newLists);
//     } catch (err) {
//       log("Error initializing:", err);
//       setError(`Initialization error: ${err.message}`);
//     }
//   }, [jsonData]);

//   useEffect(() => {
//     return () => {
//       if (timerRef.current) clearTimeout(timerRef.current);
//     };
//   }, []);

//   /**
//    * Apply state changes from a step
//    */
//   function applyStateChange(stateChange = {}) {
//     if (!stateChange || typeof stateChange !== "object") return;

//     try {
//       // Pointer updates
//       if (stateChange.pointers && typeof stateChange.pointers === "object") {
//         setPointers((prev) => {
//           const copy = { ...prev };
//           for (const [listId, pUpdates] of Object.entries(stateChange.pointers)) {
//             copy[listId] = { ...(copy[listId] || {}) };
//             for (const [pName, pVal] of Object.entries(pUpdates)) {
//               copy[listId][pName] = pVal;
//             }
//           }
//           log("Applied pointers", stateChange.pointers);
//           return copy;
//         });
//       }

//       // List node replacements
//       for (const [key, val] of Object.entries(stateChange)) {
//         if (key === "pointers" || key === "variables") continue;

//         if (Array.isArray(val) && lists[key]) {
//           setLists((prev) => {
//             const cp = { ...prev };
//             const nodes = normalizeNodeData(val);
//             cp[key] = { ...cp[key], nodes };
//             log("Updated list nodes for", key);
//             return cp;
//           });
//         }
//       }

//       // Variables
//       if (stateChange.variables && typeof stateChange.variables === "object") {
//         setVariables((prev) => ({ ...prev, ...stateChange.variables }));
//         log("Applied variables", stateChange.variables);
//       }

//       // Direct variable changes
//       const directVars = {};
//       for (const [k, v] of Object.entries(stateChange)) {
//         if (k === "pointers" || k === "variables") continue;
//         if (!Array.isArray(v) && !lists[k]) {
//           directVars[k] = v;
//         }
//       }
//       if (Object.keys(directVars).length) {
//         setVariables((prev) => ({ ...prev, ...directVars }));
//         log("Applied direct variables", directVars);
//       }
//     } catch (err) {
//       log("Error applying state change:", err);
//       setError(`State change error: ${err.message}`);
//     }
//   }

//   /**
//    * Run a step
//    */
//   function runStep(idx) {
//     try {
//       const step = steps[idx];
//       if (!step) return;

//       setAction(step.action || "");
//       setMessage(step.message || "");
//       setCondition(step.condition || null);

//       applyStateChange(step.stateChange);
//     } catch (err) {
//       log("Error running step:", err);
//       setError(`Step error: ${err.message}`);
//     }
//   }

//   // Auto-advance
//   useEffect(() => {
//     if (!playing) {
//       if (timerRef.current) {
//         clearTimeout(timerRef.current);
//         timerRef.current = null;
//       }
//       return;
//     }

//     if (currentStepIdx >= steps.length) {
//       setPlaying(false);
//       return;
//     }

//     runStep(currentStepIdx);

//     if (currentStepIdx < steps.length - 1) {
//       if (timerRef.current) clearTimeout(timerRef.current);
//       timerRef.current = setTimeout(() => {
//         setCurrentStepIdx((s) => s + 1);
//       }, stepDelay);
//     } else {
//       if (timerRef.current) clearTimeout(timerRef.current);
//       timerRef.current = setTimeout(() => setPlaying(false), stepDelay);
//     }

//     return () => {
//       if (timerRef.current) {
//         clearTimeout(timerRef.current);
//         timerRef.current = null;
//       }
//     };
//   }, [playing, currentStepIdx, steps.length, stepDelay]);

//   // Controls
//   const handleNext = () => {
//     if (currentStepIdx < steps.length - 1) {
//       setPlaying(false);
//       setCurrentStepIdx((s) => s + 1);
//     }
//   };

//   const handlePrev = () => {
//     setPlaying(false);
//     const target = Math.max(0, currentStepIdx - 1);

//     // Reset to initial state
//     const newLists = {};
//     const newPointers = {};
//     const newVars = {};

//     for (const s of structures) {
//       const type = (s.type || "").toLowerCase();
//       if (type === "linkedlist" || type === "list") {
//         const nodes = normalizeNodeData(s.data);
//         newLists[s.id] = {
//           id: s.id,
//           label: s.label || s.id,
//           nodes,
//           type,
//           doubly: s.doubly ?? false,
//           circular: s.circular ?? false,
//         };
//         newPointers[s.id] = s.pointers ? { ...s.pointers } : {};
//       } else if (type === "variable" || type === "var" || type === "result") {
//         newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
//       }
//     }

//     setLists(newLists);
//     setPointers(newPointers);
//     setVariables(newVars);

//     // Re-apply steps up to target
//     for (let i = 0; i < target; i++) {
//       const step = steps[i];
//       if (step && step.stateChange) {
//         applyStateChange(step.stateChange);
//       }
//     }

//     setCurrentStepIdx(target);
//   };

//   const handleReset = () => {
//     setPlaying(false);
//     setCurrentStepIdx(0);
//     setAction("");
//     setMessage("");
//     setCondition(null);

//     const newLists = {};
//     const newPointers = {};
//     const newVars = {};

//     for (const s of structures) {
//       const type = (s.type || "").toLowerCase();
//       if (type === "linkedlist" || type === "list") {
//         const nodes = normalizeNodeData(s.data);
//         newLists[s.id] = {
//           id: s.id,
//           label: s.label || s.id,
//           nodes,
//           type,
//           doubly: s.doubly ?? false,
//           circular: s.circular ?? false,
//         };
//         newPointers[s.id] = s.pointers ? { ...s.pointers } : {};
//       } else if (type === "variable" || type === "var" || type === "result") {
//         newVars[s.id] = typeof s.value !== "undefined" ? s.value : null;
//       }
//     }

//     setLists(newLists);
//     setPointers(newPointers);
//     setVariables(newVars);

//     if (timerRef.current) {
//       clearTimeout(timerRef.current);
//     }

//     setTimeout(() => {
//       setPlaying(Boolean(autoplay));
//     }, 50);
//   };

//   // Helpers
//   const normalizeHighlight = (highlight = []) => {
//     if (!Array.isArray(highlight)) return [];
//     return highlight
//       .map((h) => {
//         if (typeof h === "string") return h;
//         if (h && typeof h === "object" && h.structure && Number.isInteger(h.index)) {
//           return `${h.structure}:${h.index}`;
//         }
//         return null;
//       })
//       .filter(Boolean);
//   };

//   const currentHighlight = normalizeHighlight(steps[currentStepIdx]?.highlight || []);
//   const currentStep = steps[currentStepIdx];

//   // Get variable entries
//   const varEntries = Object.entries(structures)
//     .filter(([_, s]) => {
//       const t = (s.type || "").toLowerCase();
//       return t === "variable" || t === "var" || t === "result";
//     })
//     .map(([_, s]) => ({
//       id: s.id,
//       label: s.label || s.id,
//       isResult: (s.type || "").toLowerCase() === "result",
//     }));

//   if (error) {
//     return (
//       <div className="w-full h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
//         <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md text-center">
//           <div className="text-red-300 font-bold mb-2">⚠️ Visualization Error</div>
//           <div className="text-sm text-red-200">{error}</div>
//           <button
//             onClick={handleReset}
//             className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-semibold"
//           >
//             Reset
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col">
//       {/* Header */}
//       <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 shadow-md">
//         <div className="text-2xl font-bold text-cyan-400">
//           {jsonData?.questionName || "Linked List Visualizer"}
//         </div>
//         <div className="text-sm text-gray-400 mt-1">
//           Step {Math.min(currentStepIdx + 1, steps.length)} / {steps.length}
//         </div>
//       </div>

//       {/* Floating YouTube-Style Caption */}
//       <AnimatePresence mode="wait">
//         <motion.div
//           key={currentStepIdx}
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: 20 }}
//           transition={{ duration: 0.4 }}
//           className="fixed bottom-20 left-0 right-0 z-50 flex justify-center items-center px-4"
//         >
//           <div className="bg-black/90 backdrop-blur-md text-white px-6 py-3 rounded-lg shadow-2xl border border-white/10 max-w-3xl">
//             <p className="text-lg font-semibold leading-relaxed text-center">
//               {currentStep?.message || jsonData?.endMessage || "Ready to begin"}
//             </p>
//           </div>
//         </motion.div>
//       </AnimatePresence>

//       {/* Main Content */}
//       <div className="flex flex-1 gap-4 p-4 overflow-hidden pb-32">
//         {/* Left: List Display (70%) */}
//         <div className="flex-1 flex flex-col min-w-0 bg-gray-900/40 rounded-lg border border-cyan-500/20">
//           {/* Lists Container */}
//           <div className="flex-1 overflow-x-auto overflow-y-auto space-y-4 p-4 pr-3 pb-8">
//             <AnimatePresence mode="wait">
//               {Object.values(lists).length > 0 ? (
//                 Object.values(lists).map((list) => {
//                   const nodes = list.nodes || [];
//                   const pointersForList = pointers[list.id] || {};

//                   return (
//                     <motion.div
//                       key={list.id}
//                       initial={{ opacity: 0, y: 10 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       exit={{ opacity: 0, y: -10 }}
//                       className="bg-gray-900 p-4 rounded-lg border border-gray-800 shadow-lg"
//                     >
//                       {/* Header */}
//                       <div className="flex items-center justify-between mb-3">
//                         <div className="text-sm font-bold text-cyan-400">{list.label}</div>
//                         <div className="text-xs text-gray-400">
//                           {nodes.length} node{nodes.length !== 1 ? "s" : ""}
//                         </div>
//                       </div>

//                       {/* Nodes - Horizontal Layout */}
//                       <div className="relative">
//                         <AnimatePresence mode="popLayout">
//                           {nodes.length > 0 ? (
//                             <div className="flex items-center gap-1 pb-12 pt-10">
//                               {nodes.map((node, idx) => {
//                                 const hlKey = `${list.id}:${idx}`;
//                                 const isHighlighted = currentHighlight.includes(hlKey);
                                
//                                 // Find which pointers point to this node
//                                 const pointingPointers = Object.entries(pointersForList || {})
//                                   .filter(([_, pIdx]) => pIdx === idx)
//                                   .map(([pName]) => pName);
                                
//                                 const isPointed = pointingPointers.length > 0;
//                                 const hasNext = node.next !== null && node.next !== undefined;
                                
//                                 // Get the next pointer value to display
//                                 const nextPointer = node.next;

//                                 return (
//                                   <React.Fragment key={node.id}>
//                                     {/* Node with pointer labels */}
//                                     <motion.div
//                                       layout
//                                       initial={{ opacity: 0, scale: 0.8 }}
//                                       animate={{
//                                         opacity: 1,
//                                         scale: 1,
//                                       }}
//                                       exit={{ opacity: 0, scale: 0.6 }}
//                                       transition={{
//                                         type: "spring",
//                                         stiffness: 280,
//                                         damping: 22,
//                                       }}
//                                       className="relative flex-shrink-0"
//                                     >
//                                       {/* Pointer labels above node */}
//                                       {isPointed && (
//                                         <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-col gap-0.5 items-center z-10">
//                                           <AnimatePresence>
//                                             {pointingPointers.map((pName) => (
//                                               <motion.div
//                                                 key={pName}
//                                                 initial={{ opacity: 0, y: -5, scale: 0.8 }}
//                                                 animate={{ opacity: 1, y: 0, scale: 1 }}
//                                                 exit={{ opacity: 0, y: -5, scale: 0.8 }}
//                                                 transition={{
//                                                   type: "spring",
//                                                   stiffness: 300,
//                                                   damping: 20,
//                                                 }}
//                                                 className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg border border-purple-400"
//                                               >
//                                                 {pName}
//                                               </motion.div>
//                                             ))}
//                                           </AnimatePresence>
//                                           {/* Arrow pointing down */}
//                                           <motion.div
//                                             initial={{ opacity: 0, scaleY: 0 }}
//                                             animate={{ opacity: 1, scaleY: 1 }}
//                                             exit={{ opacity: 0, scaleY: 0 }}
//                                             className="w-0.5 h-3 bg-gradient-to-b from-purple-500 to-transparent"
//                                           />
//                                         </div>
//                                       )}
                                      
//                                       {/* Node box */}
//                                       <motion.div
//                                         animate={{
//                                           scale: isHighlighted ? 1.1 : 1,
//                                           boxShadow: isHighlighted
//                                             ? "0 0 25px rgba(250, 204, 21, 0.7)"
//                                             : isPointed
//                                               ? "0 0 18px rgba(168, 85, 247, 0.6)"
//                                               : "0 4px 6px rgba(0, 0, 0, 0.3)",
//                                         }}
//                                         transition={{
//                                           type: "spring",
//                                           stiffness: 300,
//                                           damping: 20,
//                                         }}
//                                         className={`w-20 h-20 rounded-xl border-2 p-2 flex flex-col items-center justify-center font-bold transition-colors relative ${
//                                           isHighlighted
//                                             ? "bg-gradient-to-br from-yellow-500/40 to-yellow-600/30 border-yellow-400 text-yellow-100"
//                                             : isPointed
//                                               ? "bg-gradient-to-br from-purple-500/25 to-purple-600/15 border-purple-400 text-purple-100"
//                                               : "bg-gray-800/80 border-gray-600 text-gray-200"
//                                         }`}
//                                       >
//                                         <div className="text-xl font-bold truncate w-full text-center">
//                                           {String(node.value)}
//                                         </div>
//                                         <div className="text-[10px] text-gray-400 mt-0.5">
//                                           [{idx}]
//                                         </div>
                                        
//                                         {/* Next pointer indicator inside node */}
//                                         <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-cyan-400 font-mono bg-gray-900/80 px-1.5 py-0.5 rounded border border-cyan-600/50">
//                                           next:{nextPointer === null ? "∅" : nextPointer}
//                                         </div>
//                                       </motion.div>
                                      
//                                       {/* Prev pointer indicator for doubly linked lists */}
//                                       {list.doubly && (
//                                         <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-mono bg-gray-900/80 px-1.5 py-0.5 rounded border border-gray-600/50">
//                                           prev:{node.prev === null ? "∅" : node.prev}
//                                         </div>
//                                       )}
//                                     </motion.div>

//                                     {/* Arrow to next node - only if next points to next index */}
//                                     {hasNext && nextPointer === idx + 1 && idx < nodes.length - 1 && (
//                                       <motion.div
//                                         initial={{ opacity: 0, scaleX: 0 }}
//                                         animate={{ opacity: 1, scaleX: 1 }}
//                                         exit={{ opacity: 0, scaleX: 0 }}
//                                         className="flex items-center flex-shrink-0"
//                                       >
//                                         <div className="relative w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400">
//                                           {/* Arrow head */}
//                                           <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-cyan-400 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
//                                         </div>
//                                       </motion.div>
//                                     )}
                                    
//                                     {/* Gap for non-sequential next pointers */}
//                                     {hasNext && nextPointer !== idx + 1 && idx < nodes.length - 1 && (
//                                       <div className="w-2 flex-shrink-0" />
//                                     )}
                                    
//                                     {/* Null indicator at end or when next is null */}
//                                     {(!hasNext || nextPointer === null) && (
//                                       <motion.div
//                                         initial={{ opacity: 0 }}
//                                         animate={{ opacity: 1 }}
//                                         exit={{ opacity: 0 }}
//                                         className="flex items-center flex-shrink-0 ml-2"
//                                       >
//                                         <div className="w-6 h-0.5 bg-gray-600" />
//                                         <div className="w-8 h-8 rounded border-2 border-gray-600 border-dashed flex items-center justify-center text-gray-500 text-xs font-bold">
//                                           ∅
//                                         </div>
//                                       </motion.div>
//                                     )}
//                                   </React.Fragment>
//                                 );
//                               })}
//                             </div>
//                           ) : (
//                             <div className="text-gray-500 italic text-center py-12 w-full">
//                               Empty List
//                             </div>
//                           )}
//                         </AnimatePresence>
//                       </div>
//                     </motion.div>
//                   );
//                 })
//               ) : (
//                 <div className="text-gray-500 italic text-center py-12">
//                   No linked lists to display
//                 </div>
//               )}
//             </AnimatePresence>
//           </div>
//         </div>

//         {/* Right: Sidebar (30%) */}
//         <div className="w-80 flex flex-col gap-4 min-w-0 overflow-y-auto">
//           {/* Variables Panel */}
//           {varEntries.length > 0 && (
//             <motion.div
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg flex-1 overflow-y-auto"
//             >
//               <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
//                 📊 Variables & Results
//               </div>
//               <div className="space-y-2.5">
//                 <AnimatePresence mode="wait">
//                   {varEntries.map(({ id, label, isResult }) => (
//                     <motion.div
//                       key={id}
//                       layout
//                       initial={{ opacity: 0, x: -10 }}
//                       animate={{ opacity: 1, x: 0 }}
//                       exit={{ opacity: 0, x: -10 }}
//                       transition={{ type: "spring", stiffness: 200, damping: 20 }}
//                       className={`p-3 rounded-lg border transition-all ${
//                         isResult
//                           ? "bg-green-900/20 border-green-700/40"
//                           : "bg-gray-800/50 border-gray-700/50"
//                       }`}
//                     >
//                       <div className="text-xs text-gray-400 font-semibold mb-1">
//                         {label}
//                         {isResult && " ✓"}
//                       </div>
//                       <motion.div
//                         key={`${id}-${variables[id]}`}
//                         initial={{ scale: 1.1, opacity: 0.7 }}
//                         animate={{ scale: 1, opacity: 1 }}
//                         transition={{
//                           type: "spring",
//                           stiffness: 300,
//                           damping: 20,
//                         }}
//                         className={`text-sm font-bold font-mono truncate ${
//                           isResult ? "text-green-300" : "text-cyan-300"
//                         }`}
//                       >
//                         {variables[id] === null || variables[id] === undefined
//                           ? "—"
//                           : String(variables[id])}
//                       </motion.div>
//                     </motion.div>
//                   ))}
//                 </AnimatePresence>
//               </div>
//             </motion.div>
//           )}

//           {/* Action & Condition */}
//           {currentStep && (
//             <motion.div
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-lg"
//             >
//               {currentStep.action && (
//                 <div className="mb-3">
//                   <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
//                     Action
//                   </div>
//                   <div className="text-sm font-bold text-cyan-300">
//                     {currentStep.action}
//                   </div>
//                 </div>
//               )}

//               {currentStep.condition && (
//                 <div>
//                   <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
//                     Condition
//                   </div>
//                   <div className="text-xs text-gray-300 font-mono mb-1.5">
//                     {currentStep.condition.expression}
//                   </div>
//                   <motion.div
//                     animate={{ scale: 1 }}
//                     className={`inline-block text-xs font-bold px-2 py-1 rounded ${
//                       currentStep.condition.result
//                         ? "bg-green-900/40 text-green-300 border border-green-700/50"
//                         : "bg-red-900/40 text-red-300 border border-red-700/50"
//                     }`}
//                   >
//                     {currentStep.condition.result ? "✓ TRUE" : "✗ FALSE"}
//                   </motion.div>
//                 </div>
//               )}
//             </motion.div>
//           )}

//           {/* Controls */}
//           <motion.div
//             initial={{ opacity: 0, x: 20 }}
//             animate={{ opacity: 1, x: 0 }}
//             className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-lg"
//           >
//             <div className="grid grid-cols-2 gap-2 mb-3">
//               <button
//                 onClick={handlePrev}
//                 disabled={currentStepIdx === 0}
//                 className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
//               >
//                 ⏮ Prev
//               </button>
//               <button
//                 onClick={() => setPlaying((p) => !p)}
//                 className={`px-3 py-2 rounded font-semibold text-sm transition-colors ${
//                   playing
//                     ? "bg-red-600 hover:bg-red-700 text-white"
//                     : "bg-cyan-600 hover:bg-cyan-700 text-white"
//                 }`}
//               >
//                 {playing ? "⏸ Pause" : "▶ Play"}
//               </button>
//               <button
//                 onClick={handleNext}
//                 disabled={currentStepIdx >= steps.length - 1}
//                 className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
//               >
//                 Next ⏭
//               </button>
//               <button
//                 onClick={handleReset}
//                 className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm transition-colors"
//               >
//                 🔄 Reset
//               </button>
//             </div>

//             <motion.div
//               className="text-sm text-cyan-400 font-semibold text-center bg-cyan-900/30 px-3 py-2 rounded border border-cyan-700/50"
//               key={currentStepIdx}
//               initial={{ scale: 1.1 }}
//               animate={{ scale: 1 }}
//               transition={{ type: "spring", stiffness: 300 }}
//             >
//               {currentStepIdx + 1} / {steps.length}
//             </motion.div>
//           </motion.div>
//         </div>
//       </div>
//     </div>
//   );
// }
