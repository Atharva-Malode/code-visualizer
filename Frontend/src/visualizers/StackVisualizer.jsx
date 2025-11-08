import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * StackVisualizer (Universal JSON Compatible)
 * - Handles both string and object highlight formats
 * - Compatible with Gemini 2.5 Flash output
 * - Works with universal JSON schema
 */

export default function StackVisualizer({ jsonData }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [structures, setStructures] = useState({});
  const [action, setAction] = useState("");
  const [playing, setPlaying] = useState(true);
  const contentScrollRef = useRef(null);

  const steps = jsonData.steps || [];
  const current = steps[currentStep] || {};
  const allStructures = jsonData.visualLayout?.structures || [];

  // Parse input safely
  let inputArray = [];
  if (Array.isArray(jsonData.sampleInput)) {
    inputArray = jsonData.sampleInput;
  } else if (typeof jsonData.sampleInput === "string") {
    inputArray = jsonData.sampleInput.replaceAll('"', "").split("");
  } else if (typeof jsonData.sampleInput === "object" && jsonData.sampleInput !== null) {
    inputArray = Object.entries(jsonData.sampleInput).map(
      ([key, val]) => `${key}: ${val}`
    );
  }

  // Initialize structures from JSON
  useEffect(() => {
    const initialState = {};
    allStructures.forEach((s) => {
      initialState[s.id] = { ...s };
    });
    setStructures(initialState);
  }, [jsonData]);

  // Apply state changes for current step
  useEffect(() => {
    if (current.stateChange) {
      setStructures((prev) => {
        const newStructs = { ...prev };
        for (const [key, value] of Object.entries(current.stateChange)) {
          if (newStructs[key]) {
            newStructs[key] = { ...newStructs[key], data: value };
          }
        }
        return newStructs;
      });
    }
    if (current.action) setAction(current.action);
  }, [currentStep]);

  // Auto-play logic
  useEffect(() => {
    if (playing && currentStep < steps.length - 1) {
      const timer = setTimeout(() => setCurrentStep((p) => p + 1), 1800);
      return () => clearTimeout(timer);
    }
  }, [playing, currentStep, steps.length]);

  const handleNext = () =>
    currentStep < steps.length - 1 && setCurrentStep((s) => s + 1);
  const handlePrev = () => currentStep > 0 && setCurrentStep((s) => s - 1);
  const handleReset = () => {
    setCurrentStep(0);
    setPlaying(true);
    const resetState = {};
    allStructures.forEach((s) => (resetState[s.id] = { ...s }));
    setStructures(resetState);
  };

  // Normalize highlight format (handle both string and object)
  const normalizeHighlight = (highlight) => {
    if (!highlight) return [];
    return highlight.map((item) => {
      if (typeof item === "string") {
        return item; // Already in "id:index" format
      } else if (typeof item === "object" && item.structure && item.index !== undefined) {
        return `${item.structure}:${item.index}`; // Convert object to string
      }
      return null;
    }).filter(Boolean);
  };

  const normalizedHighlight = normalizeHighlight(current.highlight || []);

  // Categorize structures
  const stacks = Object.values(structures).filter((s) => s.type === "stack");
  const queues = Object.values(structures).filter((s) => s.type === "queue");
  const arrays = Object.values(structures).filter((s) => s.type === "array");
  const variables = Object.values(structures).filter((s) => s.type === "variable");
  const matrices = Object.values(structures).filter((s) => s.type === "matrix");
  const results = Object.values(structures).filter((s) => s.type === "result");
  const linkedLists = Object.values(structures).filter(
    (s) => s.type === "linkedList" || s.type === "list"
  );

  const isFinalStep = currentStep === steps.length - 1;

  // Highlight logic
  const isHighlighted = (structId, index) => {
    return normalizedHighlight.includes(`${structId}:${index}`);
  };

  return (
    <div className="w-full h-screen bg-gray-950 text-gray-100 flex flex-col justify-between fixed inset-0 overflow-hidden">
      {/* Header */}
      <div className="py-4 px-6 text-center text-2xl font-bold tracking-wide text-cyan-400 border-b border-gray-800 bg-gray-900 shadow-md">
        {jsonData.questionName || "Stack Visualizer"}
      </div>

      {/* Scrollable Content Area */}
      <div
        ref={contentScrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        style={{
          paddingBottom: "220px",
          scrollBehavior: "smooth",
        }}
      >
        {/* Input Array */}
        {inputArray.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <div className="bg-gray-900 border-2 border-gray-800 rounded-xl p-6 shadow-lg">
              <div className="text-sm text-cyan-400 font-semibold mb-3 text-center">
                Input
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                {inputArray.map((ch, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale:
                        current.stateChange?.i === i ||
                        current.elements?.includes(i)
                          ? 1.15
                          : 1,
                      boxShadow:
                        current.stateChange?.i === i ||
                        current.elements?.includes(i)
                          ? "0 0 15px rgba(34, 211, 238, 0.8)"
                          : "none",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 18,
                    }}
                    className="w-12 h-12 flex items-center justify-center rounded-lg font-bold text-lg border-2 border-cyan-500 bg-gray-800 text-cyan-300 hover:bg-cyan-600 hover:text-black transition-all"
                  >
                    {ch}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6 min-h-96">
          {/* Left Panel - Variables & Action */}
          <div className="col-span-2 space-y-4">
            {/* Current Action */}
            <motion.div
              layout
              className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md sticky top-0"
            >
              <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
                Action
              </div>
              <motion.div
                key={action}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-base font-semibold text-cyan-300 min-h-8 flex items-center"
              >
                {action || "—"}
              </motion.div>
            </motion.div>

            {/* Condition */}
            {current.condition && (
              <motion.div
                layout
                className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md"
              >
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
                  Condition
                </div>
                <div className="text-sm text-gray-300 font-mono mb-2">
                  {current.condition.expression}
                </div>
                <div
                  className={`text-sm font-bold ${
                    current.condition.result
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {current.condition.result ? "✓ True" : "✗ False"}
                </div>
              </motion.div>
            )}

            {/* Variables */}
            {variables.length > 0 && (
              <motion.div
                layout
                className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md"
              >
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-3">
                  Variables
                </div>
                <div className="space-y-2">
                  {variables.map((v) => (
                    <motion.div
                      key={v.id}
                      layout
                      className="flex justify-between text-sm border-b border-gray-800 pb-2 last:border-0"
                    >
                      <span className="text-gray-400">{v.label || v.id}</span>
                      <span className="text-cyan-300 font-bold">{v.value}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Center Panel - Primary Structures (Stacks & Queues) */}
          <div className="col-span-8 space-y-6">
            {/* Multiple Stacks */}
            {stacks.map((stack, stackIdx) => (
              <motion.div
                key={stack.id}
                layout
                className="flex flex-col items-center gap-2"
              >
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
                  {stack.label || `Stack ${stackIdx + 1}`}
                </div>

                <div className="relative">
                  {/* Stack Container */}
                  <div className="w-56 min-h-80 border-4 border-cyan-500 rounded-xl bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col-reverse items-center justify-start overflow-hidden shadow-2xl p-2">
                    <AnimatePresence mode="popLayout">
                      {stack.data && stack.data.length > 0 ? (
                        stack.data.map((value, idx) => (
                          <motion.div
                            key={`${value}-${idx}`}
                            layout
                            initial={{ opacity: 0, y: -80, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -100, scale: 0.8 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20,
                            }}
                            className={`w-40 h-14 mb-2 border-2 font-bold text-lg flex items-center justify-center rounded-lg shadow-lg transition-all ${
                              isHighlighted(stack.id, idx)
                                ? "border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-600 text-black scale-105"
                                : "border-cyan-400 bg-gradient-to-br from-cyan-500 to-cyan-700 text-black"
                            }`}
                          >
                            {value}
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.5 }}
                          className="text-gray-500 italic text-center py-16"
                        >
                          Empty Stack
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Stack Pointer */}
                  <div className="absolute -right-24 top-0 text-sm text-cyan-400 font-mono">
                    <div className="mb-1">TOP</div>
                    <div className="text-lg font-bold text-cyan-300">
                      {stack.data?.length ? stack.data.length - 1 : "—"}
                    </div>
                  </div>

                  {/* Size Indicator */}
                  <div className="absolute -left-20 top-0 text-sm text-cyan-400 font-mono">
                    <div className="mb-1">SIZE</div>
                    <div className="text-lg font-bold text-cyan-300">
                      {stack.data?.length || 0}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Queues */}
            {queues.map((queue, qIdx) => (
              <motion.div
                key={queue.id}
                layout
                className="flex flex-col items-center gap-2"
              >
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
                  {queue.label || `Queue ${qIdx + 1}`}
                </div>

                <div className="relative w-full">
                  <div className="bg-gray-900 border-4 border-purple-500 rounded-lg p-4">
                    <div className="flex gap-2 justify-start overflow-x-auto pb-2">
                      <div className="text-xs text-purple-400 font-bold min-w-max">
                        FRONT
                      </div>
                      {queue.data && queue.data.length > 0 ? (
                        queue.data.map((value, idx) => (
                          <motion.div
                            key={`q-${idx}`}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className={`w-14 h-14 border-2 font-bold text-sm flex items-center justify-center rounded-lg flex-shrink-0 transition-all ${
                              isHighlighted(queue.id, idx)
                                ? "border-yellow-400 bg-yellow-500 text-black"
                                : "border-purple-400 bg-purple-600 text-white"
                            }`}
                          >
                            {value}
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-gray-500 italic text-sm">
                          Empty
                        </div>
                      )}
                      <div className="text-xs text-purple-400 font-bold min-w-max self-center">
                        REAR
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Matrices/Grids */}
            {matrices.map((matrix) => (
              <motion.div
                key={matrix.id}
                layout
                className="flex flex-col items-center gap-2"
              >
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest">
                  {matrix.label || "Matrix"}
                </div>

                <div className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${matrix.cols || 3}, minmax(50px, 1fr))`,
                      gap: "8px",
                    }}
                  >
                    {matrix.data && matrix.data.map((value, idx) => (
                      <motion.div
                        key={`m-${idx}`}
                        className={`w-14 h-14 border-2 font-bold flex items-center justify-center rounded-lg transition-all ${
                          isHighlighted(matrix.id, idx)
                            ? "border-yellow-400 bg-yellow-500 text-black"
                            : "border-green-400 bg-green-600 text-white"
                        }`}
                      >
                        {value}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Panel - Arrays & Results */}
          <div className="col-span-2 space-y-4">
            {/* Arrays */}
            {arrays.map((arr) => (
              <motion.div
                key={arr.id}
                layout
                className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md"
              >
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-3">
                  {arr.label || arr.id}
                </div>
                <div className="flex flex-col gap-2">
                  {arr.data && arr.data.length > 0 ? (
                    arr.data.map((v, i) => (
                      <motion.div
                        key={`arr-${i}`}
                        layout
                        className={`w-full h-10 border-2 rounded-md text-sm font-bold flex items-center justify-center transition-all ${
                          isHighlighted(arr.id, i)
                            ? "border-yellow-400 bg-yellow-500 text-black"
                            : "border-cyan-400 bg-gray-800 text-cyan-300"
                        }`}
                      >
                        [{i}] {v}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-gray-500 italic text-sm">—</div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Results */}
            {results.map((res) => (
              <motion.div
                key={res.id}
                layout
                className="bg-gray-900 border-2 border-green-700 rounded-lg p-4 shadow-md"
              >
                <div className="text-xs text-green-400 font-bold uppercase tracking-widest mb-2">
                  {res.label || "Result"}
                </div>
                <motion.div
                  key={res.value}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xl font-bold text-green-300 text-center"
                >
                  {res.value}
                </motion.div>
              </motion.div>
            ))}

            {/* Step Progress */}
            <motion.div
              layout
              className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 shadow-md sticky bottom-0"
            >
              <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">
                Progress
              </div>
              <motion.div
                key={currentStep}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-bold text-cyan-300"
              >
                {currentStep + 1}/{steps.length}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Message */}
      <div className="border-t border-gray-800 bg-gray-900 px-6 py-3 text-center">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-base font-semibold text-cyan-300 min-h-6"
        >
          {isFinalStep
            ? jsonData.endMessage || "✅ Visualization Complete!"
            : current.message || "Processing..."}
        </motion.div>
      </div>

      {/* Fixed Bottom Controls */}
      <div className="flex justify-center items-center gap-4 py-4 px-6 border-t border-gray-800 bg-gray-950 shadow-2xl">
        <motion.button
          onClick={handlePrev}
          disabled={currentStep === 0}
          whileHover={{ scale: currentStep === 0 ? 1 : 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
        >
          ⏮ Prev
        </motion.button>

        <motion.button
          onClick={() => setPlaying((p) => !p)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${
            playing
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-cyan-500 hover:bg-cyan-400 text-black"
          }`}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </motion.button>

        <motion.button
          onClick={handleNext}
          disabled={currentStep >= steps.length - 1}
          whileHover={{ scale: currentStep >= steps.length - 1 ? 1 : 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
        >
          Next ⏭
        </motion.button>

        <motion.button
          onClick={handleReset}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold transition-all"
        >
          🔄 Reset
        </motion.button>

        <motion.div
          className="text-sm text-cyan-400 font-semibold ml-4 bg-cyan-900/30 px-3 py-1 rounded-full"
          animate={{ scale: 1 }}
          key={currentStep}
          initial={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {currentStep + 1} / {steps.length}
        </motion.div>
      </div>
    </div>
  );
}