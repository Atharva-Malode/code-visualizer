// src/pages/SolutionPage.jsx
import { useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import mermaid from "mermaid"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

const API_BASE_URL = "http://localhost:8000/api"

export default function SolutionPage() {
    const location = useLocation()
    const data = location.state?.data
    const originalPrompt = location.state?.originalPrompt

    const [solutionCode, setSolutionCode] = useState("")
    const [mermaidCode, setMermaidCode] = useState("")
    const [loading, setLoading] = useState(true)

    // Helper function to remove markdown code delimiters
    const cleanCodeDelimiters = (code) => {
        if (!code) return ""
        // Remove triple backticks and optional language identifier
        return code.replace(/^``````$/g, "").trim()
    }

    useEffect(() => {
        console.log("🟦 useEffect triggered | originalPrompt:", originalPrompt)
        console.log("🟦 Data from location:", data)

        if (originalPrompt && data) {
            console.log("🚀 Fetching solution + flowchart...")
            Promise.all([fetchSolution(), fetchFlowchart()]).finally(() => {
                console.log("✅ All fetches complete, setting loading to false")
                setLoading(false)
            })
        } else {
            console.warn("⚠️ Missing prompt or data, skipping API calls.")
            setLoading(false)
        }
    }, [originalPrompt])

    const fetchSolution = async () => {
        console.log("📡 [fetchSolution] Sending request...")
        try {
            const response = await fetch(`${API_BASE_URL}/generate-solution`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: originalPrompt }),
            })

            console.log("📨 [fetchSolution] Response status:", response.status)

            const responseData = await response.json()
            console.log("📩 [fetchSolution] Response JSON:", responseData)

            if (response.ok && responseData.success) {
                console.log("✅ [fetchSolution] Setting solution code:", responseData.data)
                setSolutionCode(responseData.data)
            } else {
                console.error("❌ [fetchSolution] Failed:", responseData)
            }
        } catch (err) {
            console.error("🔥 [fetchSolution] Error:", err)
        }
    }

    const fetchFlowchart = async () => {
        console.log("📡 [fetchFlowchart] Sending request...")
        try {
            const response = await fetch(`${API_BASE_URL}/generate-flowchart`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: originalPrompt }),
            })

            console.log("📨 [fetchFlowchart] Response status:", response.status)

            const responseData = await response.json()
            console.log("📩 [fetchFlowchart] Response JSON:", responseData)

            if (response.ok && responseData.success) {
                console.log("✅ [fetchFlowchart] Setting Mermaid code:", responseData.data)
                setMermaidCode(responseData.data)
            } else {
                console.error("❌ [fetchFlowchart] Failed:", responseData)
            }
        } catch (err) {
            console.error("🔥 [fetchFlowchart] Error:", err)
        }
    }

    useEffect(() => {
        function renderMermaid() {
            console.log("🌀 [Mermaid] Attempting to render flowchart...")
            if (mermaidCode) {
                try {
                    console.log("🧩 [Mermaid] Code:", mermaidCode.slice(0, 100), "...")
                    // Synchronous initialization
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: "dark",
                        themeVariables: {
                        primary: "#0f0f23",
                        primaryText: "#ffffff",
                        secondary: "#1e1e2e",
                        tertiary: "#313244",
                        lineColor: "#45475a",
                        },
                    })

                    const nodes = document.querySelectorAll(".mermaid")
                    console.log("🧱 [Mermaid] Found", nodes.length, "nodes")

                    if (nodes.length > 0) {
                        // Synchronous run
                        mermaid.run({ nodes })
                        console.log("✅ [Mermaid] Render complete!")
                    } else {
                        console.warn("⚠️ [Mermaid] No nodes found for rendering.")
                    }
                } catch (err) {
                    console.error("🔥 [Mermaid] Render error:", err)
                }
            } else {
                console.log("ℹ️ [Mermaid] No code yet, skipping render.")
            }
        }

        const timer = setTimeout(renderMermaid, 200)
        return () => clearTimeout(timer)
    }, [mermaidCode])

    // Debug re-renders
    useEffect(() => {
        console.log(
            "🔁 Component render | loading:",
            loading,
            "solutionCode length:",
            solutionCode.length,
            "mermaidCode length:",
            mermaidCode.length,
        )
    })

    if (!data || loading) {
        return (
            <div className="min-h-screen flex justify-center items-center bg-gray-950 text-cyan-400 text-xl">
                {loading ? "Loading solution..." : "No data available. Please go back."}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                📚 Solution for: {data.questionName}
                </h1>
                <p className="text-gray-400 text-lg">Detailed breakdown, code, and flowchart</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {/* Algorithm Steps - Left Column */}
                <section
                    className="lg:col-span-1 bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors h-[75vh] flex flex-col overflow-hidden"
                >
                    <style>{`
                        section::-webkit-scrollbar {
                        width: 8px;
                        }
                        section::-webkit-scrollbar-track {
                        background: #111827;
                        border-radius: 10px;
                        }
                        section::-webkit-scrollbar-thumb {
                        background: linear-gradient(180deg, #06b6d4, #0891b2);
                        border-radius: 10px;
                        border: 2px solid #111827;
                        }
                        section::-webkit-scrollbar-thumb:hover {
                        background: linear-gradient(180deg, #0891b2, #0e7490);
                        }
                    `}</style>

                    <div className="bg-gray-900 px-6 pt-6 pb-4 border-b border-gray-800">
                        <h2 className="text-xl font-bold text-cyan-400">
                        📋 Algorithm Steps
                        </h2>
                    </div>

                    {/* Scrollable Content */}
                    <div 
                        className="flex-1 overflow-y-auto px-6 py-4"
                        style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#06b6d4 #1f2937",
                        }}
                    >
                        <div className="space-y-4">
                            {data.steps.map((step, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-800 p-4 rounded-lg border-l-4 border-cyan-500 hover:bg-gray-750 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
                                >
                                    <h3 className="font-semibold text-sm mb-1 text-white">
                                        Step {step.step}: {step.action?.toUpperCase()}
                                    </h3>
                                    <p className="text-gray-300 text-sm leading-relaxed">{step.message}</p>
                                    {step.condition && (
                                        <details className="mt-3 text-xs">
                                            <summary className="text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                                                📌 View Condition
                                            </summary>
                                            <pre className="mt-2 p-3 bg-gray-700 rounded text-gray-300 text-xs overflow-x-auto">
                                                {JSON.stringify(step.condition, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
            
                        {data.endMessage && (
                            <div className="mt-6 p-4 bg-green-900/30 rounded-lg border border-green-700/50 hover:bg-green-900/40 transition-colors">
                                <h3 className="font-semibold text-green-300">🏁 End</h3>
                                <p className="text-green-200 text-sm mt-2 leading-relaxed">{data.endMessage}</p>
                            </div>
                        )}
                    </div>
                </section>

            {/* Solution Code - Middle Column */}
            <section className="lg:col-span-1 bg-gray-900 rounded-2xl p-6 h-[75vh] flex flex-col border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden">
            <h2 className="text-xl font-bold text-green-400 mb-4">💻 Solution Code</h2>
            <div
                className="flex-1 overflow-y-auto rounded-lg"
                style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#22c55e #1f2937",
                }}
            >
                <style>{`
                .code-container::-webkit-scrollbar {
                    width: 8px;
                }
                .code-container::-webkit-scrollbar-track {
                    background: #111827;
                    border-radius: 10px;
                }
                .code-container::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #22c55e, #16a34a);
                    border-radius: 10px;
                    border: 2px solid #111827;
                }
                .code-container::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, #16a34a, #15803d);
                }
                `}</style>
                {solutionCode ? (
                <div className="code-container">
                    <SyntaxHighlighter
                    language="cpp"
                    style={vscDarkPlus}
                    customStyle={{
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        margin: 0,
                        background: "transparent",
                        padding: "0.5rem",
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                    >
                    {cleanCodeDelimiters(solutionCode)}
                    </SyntaxHighlighter>
                </div>
                ) : (
                <div className="text-gray-500 text-center py-12 flex items-center justify-center h-full">
                    <div className="animate-pulse">⏳ Generating code...</div>
                </div>
                )}
            </div>
            </section>

            {/* Flowchart - Right Column */}
            <section className="lg:col-span-1 bg-gray-900 rounded-2xl p-6 h-[75vh] flex flex-col border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden">
            <h2 className="text-xl font-bold text-purple-400 mb-4">🔄 Flowchart</h2>
            <div
                className="flex-1 overflow-auto rounded-lg bg-gray-800"
                style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#a855f7 #1f2937",
                }}
            >
                <style>{`
                .flowchart-container::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .flowchart-container::-webkit-scrollbar-track {
                    background: #111827;
                    border-radius: 10px;
                }
                .flowchart-container::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #a855f7, #9333ea);
                    border-radius: 10px;
                    border: 2px solid #111827;
                }
                .flowchart-container::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, #9333ea, #7e22ce);
                }
                `}</style>
                {mermaidCode ? (
                <div className="flowchart-container h-full overflow-auto flex items-center justify-center p-4">
                    <div className="mermaid">{mermaidCode}</div>
                </div>
                ) : (
                <div className="text-gray-500 text-center flex items-center justify-center h-full">
                    <div className="animate-pulse">⏳ Generating flowchart...</div>
                </div>
                )}
            </div>
            </section>
        </div>
        </div>
    )
}