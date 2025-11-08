import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import CodeInput from "../components/CodeInput";
import Loader from "../components/Loader";

/**
 * HomePage - DSA Visualizer Input
 * ================================
 * - Accepts DSA problems or code snippets
 * - Validates input
 * - Calls backend API to generate visualization JSON
 * - Routes to appropriate visualizer based on pattern
 * - Handles errors gracefully
 */

const API_BASE_URL = "http://localhost:8000/api";
const API_ENDPOINT = `${API_BASE_URL}/generate-visualization`;

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [pattern, setPattern] = useState(null);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  /**
   * Validate input before API call
   */
  const validateInput = (text) => {
    if (!text || text.trim().length === 0) {
      setError("Please enter a DSA problem or code snippet");
      return false;
    }

    if (text.trim().length < 10) {
      setError("Input too short. Please provide more details (minimum 10 characters)");
      return false;
    }

    if (text.trim().length > 5000) {
      setError("Input too long. Please limit to 5000 characters");
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Main handler: Get visualization from API
   */
  const handleVisualize = async () => {
    // Validate input
    if (!validateInput(inputText)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("📤 Sending request to:", API_ENDPOINT);
      console.log("📝 Prompt:", inputText.substring(0, 100) + "...");

      // Make API call
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: inputText }),
      });

      console.log("📨 Response status:", response.status);

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.error || errorMessage;
        } catch (e) {
          // If response isn't JSON, use status text
          errorMessage = `Server error: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      // Parse successful response
      const responseData = await response.json();
      console.log("✅ API Response:", responseData);

      // Check if response is successful
      if (!responseData.success) {
        throw new Error(responseData.error || "Failed to generate visualization");
      }

      // Extract visualization data
      const visualizationData = responseData.data;

      if (!visualizationData) {
        throw new Error("No visualization data received");
      }

      console.log("🎯 Pattern detected:", visualizationData.patternType);
      console.log("📊 Full visualization data:", visualizationData);

      // Set pattern for loader animation
      setPattern(visualizationData.patternType);

      // Navigate to visualizer after slight delay (for loader animation)
      setTimeout(() => {
        navigate("/visualize", {
          state: {
            data: visualizationData,
            patternType: visualizationData.patternType,
          },
        });
      }, 1500);
    } catch (err) {
      console.error("❌ Error occurred:", err);

      // Set user-friendly error message
      const errorMessage =
        err.message || "Failed to generate visualization. Please try again.";
      setError(errorMessage);

      setPattern("error");

      // Don't navigate on error, let user try again
      setTimeout(() => {
        setLoading(false);
        setPattern(null);
      }, 2000);
    }
  };

  /**
   * Handle Enter key submission
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleVisualize();
    }
  };

  /**
   * Clear input and error
   */
  const handleClear = () => {
    setInputText("");
    setError(null);
    setPattern(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold mb-2 text-cyan-400">
          🔮 DSA Visualizer
        </h1>
        <p className="text-gray-400 text-lg">
          Convert DSA problems or code into interactive visualizations
        </p>
      </motion.div>

      {/* Main Input Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="w-full max-w-3xl bg-gray-900 border-2 border-cyan-500/30 rounded-2xl shadow-lg p-8"
      >
        {/* Info Section */}
        <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-700/30 rounded-lg">
          <p className="text-sm text-cyan-300">
            💡 <strong>Tip:</strong> Enter a DSA problem statement or paste code. 
            Supported: arrays, linked lists, trees, graphs, matrices, stacks, queues, and DP problems.
          </p>
        </div>

        {/* Input Area */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-cyan-400 mb-3">
            Problem or Code
          </label>
          <CodeInput
            value={inputText}
            onChange={setInputText}
            onKeyDown={handleKeyDown}
            placeholder="Enter a DSA problem or code snippet..."
          />
          <p className="text-xs text-gray-500 mt-2">
            {inputText.length}/5000 characters
          </p>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm"
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button Group */}
        <div className="flex gap-4">
          <motion.button
            onClick={handleVisualize}
            disabled={loading || inputText.trim().length === 0}
            whileHover={{ scale: loading ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⚙️</span> Generating...
              </>
            ) : (
              <>
                🚀 Visualize
              </>
            )}
          </motion.button>

          <motion.button
            onClick={handleClear}
            disabled={loading || inputText.length === 0}
            whileHover={{ scale: loading ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 font-semibold py-3 rounded-xl transition-all duration-300"
          >
            🗑️ Clear
          </motion.button>
        </div>

        {/* Character Count Warning */}
        {inputText.length > 4500 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-yellow-400 mt-3"
          >
            ⚠️ Approaching character limit
          </motion.p>
        )}
      </motion.div>

      {/* Loading Indicator */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader pattern={pattern} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Supported Patterns Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-12 w-full max-w-3xl"
      >
        <div className="bg-gray-900/50 border border-cyan-500/20 rounded-lg p-6">
          <h2 className="text-cyan-400 font-bold mb-4">📚 Supported Patterns</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">✓</span> Arrays & DP 1D
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">✓</span> Linked Lists
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">✓</span> Binary Trees
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">✓</span> Graphs
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">✓</span> Matrices & DP 2D
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">✓</span> Stacks & Queues
            </div>
          </div>
        </div>
      </motion.div>

      {/* API Status Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-4 right-4 text-xs text-gray-500"
      >
        API: <span className="text-green-400">●</span> Ready
      </motion.div>
    </div>
  );
}
// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { AnimatePresence } from "framer-motion";
// import CodeInput from "../components/CodeInput";
// import Loader from "../components/Loader";

// export default function HomePage() {
//   const [loading, setLoading] = useState(false);
//   const [pattern, setPattern] = useState(null);
//   const [inputText, setInputText] = useState("");
//   const navigate = useNavigate();

//   // 🧠 Toggle this to switch between local JSON and API
//   const USE_LOCAL_JSON = true;

//   const handleVisualize = async () => {
//     if (!inputText.trim() && !USE_LOCAL_JSON)
//       return alert("Please enter a problem or code first!");

//     setLoading(true);
//     try {
//       let data;

//       if (USE_LOCAL_JSON) {
//         // ✅ Load from public/sample.json
//         const response = await fetch("graph.json");
//         if (!response.ok) throw new Error("Failed to load local JSON");
//         data = await response.json();
//         console.log("Loaded local JSON:", data);}
//       // } else {
//       //   // 🌐 Real API call
//       //   const response = await fetch("http://127.0.0.1:8000/generate-json", {
//       //     method: "POST",
//       //     headers: { "Content-Type": "application/json" },
//       //     body: JSON.stringify({ prompt: inputText }),
//       //   });

//       //   if (!response.ok) throw new Error(`Server returned ${response.status}`);
//       //   data = await response.json();
//       //   console.log("Received API JSON:", data);
//       // }

//       setPattern(data.patternType || "Unknown");

//       // 🧩 Navigate to VisualizePage
//       setTimeout(() => navigate("/visualize", { state: { data } }), 1200);
//     } catch (e) {
//       console.error("Error loading visualization data:", e);
//       setPattern("Unknown");
//       setTimeout(() => navigate("/visualize"), 1200);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
//       <h1 className="text-3xl font-semibold mb-6 text-cyan-400">
//         🔮 DSA Visualizer
//       </h1>

//       <div className="w-full max-w-3xl bg-gray-900 rounded-2xl shadow-lg p-6">
//         {!USE_LOCAL_JSON && (
//           <CodeInput value={inputText} onChange={setInputText} />
//         )}

//         <button
//           onClick={handleVisualize}
//           className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-2 rounded-xl transition-all duration-300"
//         >
//           {USE_LOCAL_JSON ? "Load Local Visualization 🔍" : "Visualize 🚀"}
//         </button>
//       </div>

//       <AnimatePresence>{loading && <Loader pattern={pattern} />}</AnimatePresence>
//     </div>
//   );
// }

//api code 
// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { AnimatePresence } from "framer-motion";
// import CodeInput from "../components/CodeInput";
// import Loader from "../components/Loader";

// export default function HomePage() {
//   const [loading, setLoading] = useState(false);
//   const [pattern, setPattern] = useState(null);
//   const [inputText, setInputText] = useState("");
//   const navigate = useNavigate();

//   const handleVisualize = async () => {
//     if (!inputText.trim()) return alert("Please enter a problem or code first!");

//     setLoading(true);
//     try {
//       const response = await fetch("http://127.0.0.1:8000/generate-json", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ prompt: inputText }),
//       });

//       if (!response.ok) throw new Error(`Server returned ${response.status}`);

//       const data = await response.json();
//       console.log("Received JSON:", data);
//       setPattern(data.patternType || "Unknown");

//       // 🧠 Navigate to visualize with data
//       setTimeout(() => navigate("/visualize", { state: { data } }), 1500);
//     } catch (e) {
//       console.error("Error:", e);
//       setPattern("Unknown");
//       setTimeout(() => navigate("/visualize"), 1500);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
//       <h1 className="text-3xl font-semibold mb-6 text-cyan-400">
//         🔮 DSA Visualizer
//       </h1>

//       <div className="w-full max-w-3xl bg-gray-900 rounded-2xl shadow-lg p-6">
//         <CodeInput value={inputText} onChange={setInputText} />
//         <button
//           onClick={handleVisualize}
//           className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-2 rounded-xl transition-all duration-300"
//         >
//           Visualize 🚀
//         </button>
//       </div>

//       <AnimatePresence>{loading && <Loader pattern={pattern} />}</AnimatePresence>
//     </div>
//   );
// }
