import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

/**
 * GraphVisualizer - Ultra-Robust Universal Format Handler
 * =========================================================
 * Handles ALL possible highlight formats with FULL ERROR PROTECTION
 * - Added: Solution button navigation
 */

export default function GraphVisualizer({ jsonData, originalPrompt }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [structures, setStructures] = useState({});
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

  /**
   * Parse graph - Handles multiple connection formats
   */
  const parseGraphData = (graphStruct) => {
    if (!graphStruct) return { nodes: [], edges: [] };

    const nodes = [];
    const edges = [];

    // Extract nodes from data
    if (Array.isArray(graphStruct.data)) {
      graphStruct.data.forEach((item) => {
        if (item && item.id) {
          nodes.push(item.id);
        }
      });
    }

    // Extract edges from multiple formats
    if (Array.isArray(graphStruct.connections)) {
      graphStruct.connections.forEach((conn) => {
        let source, target;

        if (Array.isArray(conn) && conn.length >= 2) {
          // Format: ["node_0", "node_1"]
          [source, target] = conn;
        } else if (conn && typeof conn === "object") {
          // Format: {from: "node_0", to: "node_1"} OR {source: "node_0", target: "node_1"}
          source = conn.from || conn.source;
          target = conn.to || conn.target;
        }

        if (source && target) {
          edges.push({
            source,
            target,
            id: `edge_${source}_${target}`,
          });
        }
      });
    }

    return { nodes, edges };
  };

  /**
   * UNIVERSAL HIGHLIGHT EXTRACTOR - Handles ALL formats with error protection
   */
  const extractHighlights = (highlight = []) => {
    const highlightedNodes = new Set();
    const highlightedEdges = [];
    const highlightedArrays = {};

    if (!Array.isArray(highlight)) {
      return { nodes: highlightedNodes, edges: highlightedEdges, arrays: highlightedArrays };
    }

    for (const h of highlight) {
      if (!h) continue;

      // Format 1: Simple string like "node_0"
      if (typeof h === "string") {
        highlightedNodes.add(h);
        continue;
      }

      if (typeof h !== "object") continue;

      // Format 2: Structure with single node {structure: "graph", node: "node_0"}
      if (h.structure && h.node && typeof h.node === "string") {
        highlightedNodes.add(h.node);
        continue;
      }

      // Format 3: Multiple nodes {structure: "graph", nodes: ["node_0"]}
      if (h.nodes && Array.isArray(h.nodes)) {
        h.nodes.forEach((n) => {
          if (typeof n === "string") highlightedNodes.add(n);
        });
        continue;
      }

      // Format 4: Edge object {from: "node_0", to: "node_1", type: "edge"}
      if ((h.from || h.source) && (h.to || h.target)) {
        const from = h.from || h.source;
        const to = h.to || h.target;
        highlightedEdges.push([from, to]);
        // Also highlight the nodes if edge is highlighted
        highlightedNodes.add(from);
        highlightedNodes.add(to);
        continue;
      }

      // Format 5: Edge array format {edges: [["node_0", "node_1"]]}
      if (h.edges && Array.isArray(h.edges)) {
        h.edges.forEach((edge) => {
          if (Array.isArray(edge) && edge.length >= 2) {
            highlightedEdges.push([edge[0], edge[1]]);
            highlightedNodes.add(edge[0]);
            highlightedNodes.add(edge[1]);
          }
        });
        continue;
      }

      // Format 6: Array/status highlighting {structure: "colors_array", indices: [0]}
      if (h.structure && h.indices && Array.isArray(h.indices)) {
        highlightedArrays[h.structure] = h.indices;
        continue;
      }
    }

    return { nodes: highlightedNodes, edges: highlightedEdges, arrays: highlightedArrays };
  };

  // Initialize
  useEffect(() => {
    const newStructures = {};
    const newVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();

      if (type === "graph") {
        const { nodes, edges } = parseGraphData(s);
        newStructures[s.id] = {
          ...s,
          nodes,
          edges,
          directed: s.directed !== false,
        };
      } else if (type === "stack" || type === "queue" || type === "array") {
        newStructures[s.id] = {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : [],
        };
      } else if (type === "variable" || type === "var") {
        if (s.data && Array.isArray(s.data)) {
          newStructures[s.id] = { ...s, data: [...s.data] };
        } else {
          newVariables[s.id] = s.value ?? null;
        }
      } else if (type === "result") {
        newVariables[s.id] = s.value ?? null;
      }
    }

    setStructures(newStructures);
    setVariables(newVariables);
    setStepIndex(0);
    setEndReached(false);
    setPlaying(true);
  }, [jsonData, allStructures]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const currentStep = steps[stepIndex] || {};

  // Auto-play with animations
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (stepIndex >= steps.length) {
      setPlaying(false);
      setEndReached(true);
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
        if (key === "variables" || !updated[key]) continue;

        // Graph with connections
        if (value && value.data && Array.isArray(value.data) && value.connections) {
          const { nodes, edges } = parseGraphData(value);
          updated[key] = { ...updated[key], nodes, edges };
        }
        // Array/variable data
        else if (value && value.data && Array.isArray(value.data)) {
          updated[key] = { ...updated[key], data: [...value.data] };
        }
      }

      return updated;
    });

    // Update variables
    setVariables((prev) => {
      const updated = { ...prev };

      for (const [key, value] of Object.entries(stateChange)) {
        if (key === "variables") {
          if (typeof value === "object" && value !== null) {
            Object.assign(updated, value);
          }
          continue;
        }

        if (!allStructures.find((s) => s.id === key)) {
          if (
            typeof value === "boolean" ||
            typeof value === "number" ||
            typeof value === "string" ||
            value === null
          ) {
            updated[key] = value;
          } else if (value && typeof value === "object" && value.value !== undefined) {
            updated[key] = value.value;
          }
        }
      }

      return updated;
    });
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
    const resetVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();

      if (type === "graph") {
        const { nodes, edges } = parseGraphData(s);
        resetStructures[s.id] = { ...s, nodes, edges, directed: s.directed !== false };
      } else if (type === "stack" || type === "queue" || type === "array" || type === "variable") {
        if (s.data) {
          resetStructures[s.id] = { ...s, data: Array.isArray(s.data) ? [...s.data] : [] };
        }
      } else if (type === "var" || type === "result") {
        resetVariables[s.id] = s.value ?? null;
      }
    }

    setStructures(resetStructures);
    setVariables(resetVariables);

    for (let i = 0; i < target; i++) {
      applyStep(i);
    }

    setStepIndex(target);
  };

  const handleReset = () => {
    setPlaying(false);
    setStepIndex(0);
    setEndReached(false);

    const resetStructures = {};
    const resetVariables = {};

    for (const s of allStructures) {
      const type = (s.type || "").toLowerCase();

      if (type === "graph") {
        const { nodes, edges } = parseGraphData(s);
        resetStructures[s.id] = { ...s, nodes, edges, directed: s.directed !== false };
      } else if (type === "stack" || type === "queue" || type === "array" || type === "variable") {
        if (s.data) {
          resetStructures[s.id] = { ...s, data: Array.isArray(s.data) ? [...s.data] : [] };
        }
      } else if (type === "var" || type === "result") {
        resetVariables[s.id] = s.value ?? null;
      }
    }

    setStructures(resetStructures);
    setVariables(resetVariables);
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

  // Categorize structures
  const graphs = Object.entries(structures)
    .filter(([_, s]) => (s.type || "").toLowerCase() === "graph")
    .map(([id, s]) => ({ id, ...s }));

  const statusArrays = Object.entries(structures)
    .filter(([_, s]) => {
      const t = (s.type || "").toLowerCase();
      return t === "array" || (t === "variable" && s.data);
    })
    .map(([id, s]) => ({ id, ...s }));

  const stackQueues = Object.entries(structures)
    .filter(([_, s]) => {
      const t = (s.type || "").toLowerCase();
      return t === "stack" || t === "queue";
    })
    .map(([id, s]) => ({ id, ...s }));

  const { nodes: highlightedNodes, edges: highlightedEdges, arrays: highlightedArrays } = extractHighlights(
    currentStep.highlight
  );

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col fixed inset-0 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="text-2xl font-bold text-cyan-400">
          {jsonData?.questionName || "Graph Visualizer"}
        </div>
        <div className="text-xs text-gray-400 mt-1 font-semibold tracking-wider uppercase">
          {jsonData?.patternType || "Graph"}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden pb-32">
        {/* Left: Visualization (70%) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto space-y-6 pr-3">
          {/* Info Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-4 sticky top-0 bg-gray-950/95 py-4 rounded-lg border-2 border-cyan-500/30 px-4 z-10 shadow-lg backdrop-blur-sm"
          >
            <div>
              <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-1">
                Action
              </div>
              <motion.div
                key={action}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-bold text-cyan-300 bg-cyan-900/30 px-2 py-1 rounded"
              >
                {action || "—"}
              </motion.div>
            </div>

            <div>
              <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-1">
                Step
              </div>
              <div className="text-sm font-bold text-cyan-300">
                {stepIndex + 1} / {steps.length}
              </div>
            </div>

            {condition && (
              <div>
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-1">
                  Result
                </div>
                <motion.div
                  className={`text-xs font-bold px-2 py-1 rounded inline-block ${
                    condition.result
                      ? "bg-green-900/50 text-green-300"
                      : "bg-red-900/50 text-red-300"
                  }`}
                >
                  {condition.result ? "✓ True" : "✗ False"}
                </motion.div>
              </div>
            )}
          </motion.div>

          {/* Graphs */}
          {graphs.length > 0 ? (
            graphs.map((graph) => (
              <GraphRenderer
                key={graph.id}
                graph={graph}
                highlightedNodes={highlightedNodes}
                highlightedEdges={highlightedEdges}
              />
            ))
          ) : (
            <div className="text-gray-500 italic text-center py-12">
              No graphs to display
            </div>
          )}

          {/* Status Arrays */}
          {statusArrays.map((arr) => (
            <StatusArrayRenderer
              key={arr.id}
              arr={arr}
              highlightedNodes={highlightedNodes}
              highlightedIndices={highlightedArrays[arr.id]}
            />
          ))}

          {endReached && jsonData?.endMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-900/20 border border-green-700/50 rounded-lg px-4 py-3 text-sm text-green-300"
            >
              ✅ {jsonData.endMessage}
            </motion.div>
          )}
        </div>

        {/* Right: Sidebar (30%) */}
        <div className="w-80 flex flex-col gap-4 min-w-0 overflow-y-auto">
          {/* Stack/Queue */}
          {stackQueues.map((sq) => (
            <motion.div
              key={sq.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg"
            >
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
                {sq.label || sq.id}
              </div>

              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {sq.data && sq.data.length > 0 ? (
                    sq.data.map((val, idx) => (
                      <motion.div
                        key={`${sq.id}-${idx}`}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        className="w-16 h-16 rounded-lg border-2 border-cyan-500 bg-gray-800 flex items-center justify-center font-bold text-cyan-300 text-sm"
                      >
                        {val}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-gray-500 italic text-sm">Empty</div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}

          {/* Variables */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg flex-1 overflow-y-auto"
          >
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
              📊 Variables & Results
            </div>

            <div className="space-y-2">
              {Object.entries(variables).map(([id, value]) => {
                const label = allStructures.find((s) => s.id === id)?.label || id;
                const isResult =
                  allStructures.find((s) => s.id === id)?.type?.toLowerCase() === "result";

                return (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border ${
                      isResult
                        ? "bg-green-900/20 border-green-700/40"
                        : "bg-gray-800/50 border-gray-700/50"
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isResult ? "text-green-400" : "text-gray-400"}`}>
                      {label}
                    </div>
                    <motion.div
                      key={`${id}-${String(value)}`}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className={`text-sm font-bold font-mono ${isResult ? "text-green-300" : "text-cyan-300"}`}
                    >
                      {value === null || value === undefined ? "—" : String(value)}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 border-2 border-cyan-500/30 rounded-lg p-4 shadow-lg"
          >
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={handlePrev}
                disabled={stepIndex === 0}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 font-semibold text-sm transition-colors"
              >
                ⏮ Prev
              </button>

              <button
                onClick={() => setPlaying((p) => !p)}
                className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${
                  playing
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }`}
              >
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>

              <button
                onClick={handleNext}
                disabled={stepIndex >= steps.length - 1}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 font-semibold text-sm transition-colors"
              >
                Next ⏭
              </button>

              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm transition-colors"
              >
                🔄 Reset
              </button>
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
              className="text-sm font-bold text-center bg-cyan-900/30 px-3 py-2 rounded-lg border border-cyan-700/50 text-cyan-400"
              key={stepIndex}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              {stepIndex + 1} / {steps.length}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* YouTube-Style Bottom Caption */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4"
          >
            <div className="bg-black/85 backdrop-blur-lg border border-cyan-500/40 rounded-xl px-8 py-4 shadow-2xl max-w-3xl">
              <p className="text-center text-white font-medium leading-relaxed text-sm md:text-base">
                {message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Graph Renderer with proper highlighting
 */
function GraphRenderer({ graph, highlightedNodes, highlightedEdges }) {
  const NODE_RADIUS = 24;

  if (!graph.nodes || graph.nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 text-center text-gray-500 italic"
      >
        {graph.label || "Graph"} is empty
      </motion.div>
    );
  }

  const numNodes = graph.nodes.length;
  const radius = Math.max(150, numNodes * 30);
  const centerX = 300;
  const centerY = 250;

  const positions = {};
  graph.nodes.forEach((node, idx) => {
    const angle = (2 * Math.PI * idx) / numNodes;
    positions[node] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const getEdgeEndpoints = (from, to) => {
    const p1 = positions[from];
    const p2 = positions[to];
    if (!p1 || !p2) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return null;

    const dirX = dx / dist;
    const dirY = dy / dist;

    return {
      x1: p1.x + dirX * NODE_RADIUS,
      y1: p1.y + dirY * NODE_RADIUS,
      x2: p2.x - dirX * NODE_RADIUS,
      y2: p2.y - dirY * NODE_RADIUS,
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg"
    >
      <div className="text-center text-cyan-400 font-bold mb-4">
        {graph.label || "Graph"} ({numNodes} nodes, {graph.edges?.length || 0} edges)
      </div>

      <svg width="600" height="500" className="mx-auto" style={{ background: "transparent" }}>
        <defs>
          <marker id="arrow-cyan" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="rgb(34, 211, 238)" />
          </marker>
          <marker id="arrow-yellow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="rgb(234, 179, 8)" />
          </marker>
        </defs>

        {/* Edges */}
        {graph.edges &&
          graph.edges.map((edge, idx) => {
            const endpoints = getEdgeEndpoints(edge.source, edge.target);
            if (!endpoints) return null;

            const isHL = highlightedEdges.some(
              (e) =>
                (e[0] === edge.source && e[1] === edge.target) ||
                (e[0] === edge.target && e[1] === edge.source)
            );

            const { x1, y1, x2, y2 } = endpoints;

            return (
              <motion.line
                key={`edge-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isHL ? "rgb(234, 179, 8)" : "rgba(34, 211, 238, 0.3)"}
                strokeWidth={isHL ? "3.5" : "2.5"}
                markerEnd={graph.directed ? (isHL ? "url(#arrow-yellow)" : "url(#arrow-cyan)") : undefined}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1, strokeWidth: isHL ? 3.5 : 2.5 }}
                transition={{ duration: 0.5 }}
              />
            );
          })}

        {/* Nodes */}
        {graph.nodes.map((node, idx) => {
          const { x, y } = positions[node];
          const isHL = highlightedNodes.has(node);

          return (
            <motion.g key={`node-${idx}`}>
              <motion.circle
                cx={x}
                cy={y}
                r={NODE_RADIUS}
                fill={isHL ? "rgba(234, 179, 8, 0.4)" : "rgba(34, 211, 238, 0.15)"}
                stroke={isHL ? "rgb(234, 179, 8)" : "rgb(34, 211, 238)"}
                strokeWidth={isHL ? "3" : "2"}
                initial={{ opacity: 0, r: 0 }}
                animate={{ opacity: 1, r: NODE_RADIUS, strokeWidth: isHL ? 3 : 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              <motion.text
                x={x}
                y={y + 8}
                textAnchor="middle"
                fontSize="18"
                fontWeight="bold"
                fill={isHL ? "rgb(250, 204, 21)" : "rgb(34, 211, 238)"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {node.replace("node_", "")}
              </motion.text>
            </motion.g>
          );
        })}
      </svg>
    </motion.div>
  );
}

/**
 * Status Array Renderer - For colors_array, visited_status, etc.
 * FIXED: Full error protection on nodeId
 */
function StatusArrayRenderer({ arr, highlightedNodes, highlightedIndices }) {
  if (!arr.data || !Array.isArray(arr.data) || arr.data.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 border-2 border-cyan-500/40 rounded-lg p-6 shadow-lg"
    >
      <div className="text-center text-cyan-400 font-bold mb-4">
        {arr.label || arr.id}
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        {arr.data.map((item, idx) => {
          // FIXED: Safe extraction with fallbacks
          const nodeId = item?.key || item?.id || `item_${idx}`;
          const isHL =
            highlightedNodes.has(nodeId) ||
            (highlightedIndices && highlightedIndices.includes(idx));
          const value = item?.value;

          // Format value display - FIXED: Safe handling of value
          let displayValue = "—";
          if (typeof value === "boolean") {
            displayValue = value ? "✓" : "✗";
          } else if (typeof value === "string" && value) {
            // Safe replace - check if value exists first
            displayValue = value
              .replace("color_", "C")
              .replace("uncolored", "U");
          } else if (value !== undefined && value !== null) {
            displayValue = String(value);
          }

          // FIXED: Safe nodeId formatting - check before calling replace
          let displayNodeId = "—";
          if (typeof nodeId === "string") {
            displayNodeId = nodeId
              .replace("node_", "")
              .replace("colors_", "")
              .replace("_", " ");
          }

          return (
            <motion.div
              key={`${arr.id}-${idx}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: isHL ? 1.15 : 1,
              }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center font-bold transition-all ${
                isHL
                  ? "bg-yellow-500/30 border-yellow-400 text-yellow-300"
                  : "bg-gray-800 border-cyan-500 text-cyan-300"
              }`}
            >
              <div className="text-sm text-center">{displayNodeId}</div>
              <div className="text-xs text-gray-400 mt-2 font-mono">{displayValue}</div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}