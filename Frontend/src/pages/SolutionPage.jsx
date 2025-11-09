// src/pages/SolutionPage.jsx
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import mermaid from "mermaid";

const API_BASE_URL = "http://localhost:8000/api";

export default function SolutionPage() {
  const location = useLocation();
  const data = location.state?.data;
  const originalPrompt = location.state?.originalPrompt;

  const [solutionCode, setSolutionCode] = useState("");
  const [mermaidCode, setMermaidCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🟦 useEffect triggered | originalPrompt:", originalPrompt);
    console.log("🟦 Data from location:", data);

    if (originalPrompt && data) {
      console.log("🚀 Fetching solution + flowchart...");
      Promise.all([fetchSolution(), fetchFlowchart()]).finally(() => {
        console.log("✅ All fetches complete, setting loading to false");
        setLoading(false);
      });
    } else {
      console.warn("⚠️ Missing prompt or data, skipping API calls.");
      setLoading(false);
    }
  }, [originalPrompt]);

  const fetchSolution = async () => {
    console.log("📡 [fetchSolution] Sending request...");
    try {
      const response = await fetch(`${API_BASE_URL}/generate-solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: originalPrompt }),
      });

      console.log("📨 [fetchSolution] Response status:", response.status);

      const responseData = await response.json();
      console.log("📩 [fetchSolution] Response JSON:", responseData);

      if (response.ok && responseData.success) {
        console.log("✅ [fetchSolution] Setting solution code:", responseData.data);
        setSolutionCode(responseData.data);
      } else {
        console.error("❌ [fetchSolution] Failed:", responseData);
      }
    } catch (err) {
      console.error("🔥 [fetchSolution] Error:", err);
    }
  };

  const fetchFlowchart = async () => {
    console.log("📡 [fetchFlowchart] Sending request...");
    try {
      const response = await fetch(`${API_BASE_URL}/generate-flowchart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: originalPrompt }),
      });

      console.log("📨 [fetchFlowchart] Response status:", response.status);

      const responseData = await response.json();
      console.log("📩 [fetchFlowchart] Response JSON:", responseData);

      if (response.ok && responseData.success) {
        console.log("✅ [fetchFlowchart] Setting Mermaid code:", responseData.data);
        setMermaidCode(responseData.data);
      } else {
        console.error("❌ [fetchFlowchart] Failed:", responseData);
      }
    } catch (err) {
      console.error("🔥 [fetchFlowchart] Error:", err);
    }
  };

  useEffect(() => {
    async function renderMermaid() {
      console.log("🌀 [Mermaid] Attempting to render flowchart...");
      if (mermaidCode) {
        try {
          console.log("🧩 [Mermaid] Code:", mermaidCode.slice(0, 100), "...");
          await mermaid.initializeAsync({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              primary: "#0f0f23",
              primaryText: "#ffffff",
              secondary: "#1e1e2e",
              tertiary: "#313244",
              lineColor: "#45475a",
            },
          });

          const nodes = document.querySelectorAll(".mermaid");
          console.log("🧱 [Mermaid] Found", nodes.length, "nodes");

          if (nodes.length > 0) {
            await mermaid.runAsync({ nodes, updateEditor: false });
            console.log("✅ [Mermaid] Render complete!");
          } else {
            console.warn("⚠️ [Mermaid] No nodes found for rendering.");
          }
        } catch (err) {
          console.error("🔥 [Mermaid] Render error:", err);
        }
      } else {
        console.log("ℹ️ [Mermaid] No code yet, skipping render.");
      }
    }

    const timer = setTimeout(renderMermaid, 200);
    return () => clearTimeout(timer);
  }, [mermaidCode]);

  // Debug re-renders
  useEffect(() => {
    console.log("🔁 Component render | loading:", loading, "solutionCode length:", solutionCode.length, "mermaidCode length:", mermaidCode.length);
  });

  if (!data || loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-950 text-cyan-400 text-xl">
        {loading ? "Loading solution..." : "No data available. Please go back."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <header className="mb-6 text-center">
        <h1 className="text-3xl text-cyan-400 font-bold mb-2">
          📚 Solution for: {data.questionName}
        </h1>
        <p className="text-gray-400">
          Detailed breakdown, code, and flowchart
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* Algorithm Steps */}
        <section className="lg:col-span-1 bg-gray-900 rounded-2xl p-6 h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">
            📋 Algorithm Steps
          </h2>
          <div className="space-y-4">
            {data.steps.map((step, index) => (
              <div
                key={index}
                className="bg-gray-800 p-4 rounded-lg border-l-4 border-cyan-500"
              >
                <h3 className="font-semibold text-sm mb-1">
                  Step {step.step}: {step.action?.toUpperCase()}
                </h3>
                <p className="text-gray-300 text-sm">{step.message}</p>
                {step.condition && (
                  <details className="mt-2 text-xs">
                    <summary className="text-gray-500 cursor-pointer">
                      Condition
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-700 rounded text-gray-400">
                      {JSON.stringify(step.condition, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
          {data.endMessage && (
            <div className="mt-4 p-4 bg-green-900/30 rounded-lg border border-green-700/50">
              <h3 className="font-semibold text-green-300">🏁 End</h3>
              <p className="text-green-200 text-sm mt-1">{data.endMessage}</p>
            </div>
          )}
        </section>

        {/* Solution Code */}
        <section className="lg:col-span-1 bg-gray-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-green-400 mb-4">
            💻 Solution Code
          </h2>
          {solutionCode ? (
            <pre className="bg-black text-green-300 p-4 rounded-lg font-mono text-sm overflow-y-auto h-[80vh]">
              <code>{solutionCode}</code>
            </pre>
          ) : (
            <div className="text-gray-500 text-center py-8">
              Generating code...
            </div>
          )}
        </section>

        {/* Flowchart */}
        <section className="lg:col-span-1 bg-gray-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-purple-400 mb-4">
            🔄 Flowchart
          </h2>
          {mermaidCode ? (
            <div className="mermaid bg-gray-800 p-4 rounded-lg h-[80vh] overflow-auto">
              {mermaidCode}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              Generating flowchart...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}