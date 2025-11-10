// src/pages/SolutionPage.jsx
import { useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
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
    const [loadingSolution, setLoadingSolution] = useState(true)
    const [loadingFlowchart, setLoadingFlowchart] = useState(true)
    const mermaidRef = useRef(null)

    const sanitizeMermaidCode = (code) => {
        if (!code) return ""
        
        let sanitized = code
        
        // Replace array access syntax arr[index] with arr(index)
        sanitized = sanitized.replace(/(\w+)\[([^\]]+)\]/g, '$1($2)')
        
        // Remove special characters from labels but keep them readable
        sanitized = sanitized.replace(/([[\{])([^}\]]*?)([}\]])/g, (match, open, content, close) => {
            // Clean the content between brackets/braces
            let cleaned = content
                .replace(/\(/g, ' ')
                .replace(/\)/g, ' ')
                .replace(/\+/g, ' plus ')
                .replace(/-(?=\s)/g, ' minus ')  // Only replace minus when followed by space
                .replace(/\*/g, ' times ')
                .replace(/\//g, ' div ')
                .replace(/\s+/g, ' ')  // Normalize multiple spaces
                .trim()
            
            return open + cleaned + close
        })
        
        // Fix double semicolons and trailing semicolons
        sanitized = sanitized.replace(/;;/g, ';')
        sanitized = sanitized.replace(/\};/g, '}')
        
        return sanitized
    }

    // Helper function to remove markdown code delimiters more robustly
    const cleanCodeDelimiters = (code) => {
        if (!code) return ""
        let cleaned = code
        // Remove opening and closing code blocks
        cleaned = cleaned.replace(/^```(?:cpp|python|\w+)?\s*\n?/i, '').trimStart()
        cleaned = cleaned.replace(/\n?```\s*$/i, '').trimEnd()
        // Remove any remaining empty lines at start/end
        cleaned = cleaned.replace(/^\n+|\n+$/g, '')
        return cleaned
    }

    useEffect(() => {
        console.log("🟦 useEffect triggered | originalPrompt:", originalPrompt)
        console.log("🟦 Data from location:", data)

        if (originalPrompt && data) {
            console.log("🚀 Fetching solution + flowchart...")
            fetchSolution()
            fetchFlowchart()
        } else {
            console.warn("⚠️ Missing prompt or data, skipping API calls.")
            setLoadingSolution(false)
            setLoadingFlowchart(false)
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
                const cleanedCode = cleanCodeDelimiters(responseData.data)
                console.log("✅ [fetchSolution] Setting solution code (length after clean):", cleanedCode.length)
                setSolutionCode(cleanedCode)
            } else {
                console.error("❌ [fetchSolution] Failed:", responseData)
            }
        } catch (err) {
            console.error("🔥 [fetchSolution] Error:", err)
        } finally {
            setLoadingSolution(false)
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
                // Clean Mermaid code if it has markdown delimiters
                let cleanedMermaid = responseData.data
                cleanedMermaid = cleanedMermaid.replace(/^```(?:mermaid)?\s*\n?/i, '').trimStart()
                cleanedMermaid = cleanedMermaid.replace(/\n?```\s*$/i, '').trimEnd()
                console.log("✅ [fetchFlowchart] Setting Mermaid code (length):", cleanedMermaid.length)
                cleanedMermaid = sanitizeMermaidCode(cleanedMermaid)
                setMermaidCode(cleanedMermaid)
            } else {
                console.error("❌ [fetchFlowchart] Failed:", responseData)
            }
        } catch (err) {
            console.error("🔥 [fetchFlowchart] Error:", err)
        } finally {
            setLoadingFlowchart(false)
        }
    }

    useEffect(() => {
        async function renderMermaid() {
            console.log("🌀 [Mermaid] Attempting to render flowchart...")
            if (mermaidCode && mermaidRef.current) {
                try {
                    console.log("🧩 [Mermaid] Code preview:", mermaidCode.slice(0, 100), "...")
                    
                    // Configure Mermaid globally
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: "dark",
                        securityLevel: 'loose',
                        themeVariables: {
                            primary: "#0f0f23",
                            primaryText: "#ffffff",
                            secondary: "#1e1e2e",
                            tertiary: "#313244",
                            lineColor: "#45475a",
                            primaryBorderColor: "#45475a",
                            primaryBackground: "#0f0f23",
                        },
                    })

                    // Use mermaid.render to generate SVG directly (avoids parsing issues)
                    const { svg } = await mermaid.render('mermaid-graph', mermaidCode)
                    
                    // Set the SVG directly into the ref
                    mermaidRef.current.innerHTML = svg
                    console.log("✅ [Mermaid] SVG rendered successfully!")
                } catch (err) {
                    console.error("🔥 [Mermaid] Render error:", err)
                    // Fallback: show raw code if rendering fails
                    if (mermaidRef.current) {
                        mermaidRef.current.innerHTML = `<pre class="text-xs text-gray-400 p-4 overflow-auto">${mermaidCode}</pre>`
                    }
                }
            } else {
                console.log("ℹ️ [Mermaid] No code or ref yet, skipping render.")
            }
        }

        if (mermaidCode) {
            const timer = setTimeout(renderMermaid, 100)
            return () => clearTimeout(timer)
        }
    }, [mermaidCode])

    // Debug re-renders
    useEffect(() => {
        console.log(
            "🔁 Component render | loadingSolution:",
            loadingSolution,
            "loadingFlowchart:",
            loadingFlowchart,
            "solutionCode length:",
            solutionCode.length,
            "mermaidCode length:",
            mermaidCode.length,
        )
    })


    // Early return only if no data at all
    if (!data) {
        return (
            <div className="min-h-screen flex justify-center items-center bg-gray-950 text-cyan-400 text-xl">
                No data available. Please go back.
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
                {/* Algorithm Steps - Left Column (Always visible) */}
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
                        {loadingSolution ? (
                            <div className="text-gray-500 text-center py-12 flex items-center justify-center h-full">
                                <div className="animate-pulse">⏳ Generating code...</div>
                            </div>
                        ) : solutionCode ? (
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
                            <div className="text-red-400 text-center py-12 flex items-center justify-center h-full">
                                Failed to generate code
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
                        {loadingFlowchart ? (
                            <div className="text-gray-500 text-center flex items-center justify-center h-full">
                                <div className="animate-pulse">⏳ Generating flowchart...</div>
                            </div>
                        ) : mermaidCode ? (
                            <div className="flowchart-container h-full overflow-auto flex items-center justify-center p-4">
                                <div ref={mermaidRef} className="mermaid w-full h-full min-h-[400px]"></div>
                            </div>
                        ) : (
                            <div className="text-red-400 text-center flex items-center justify-center h-full">
                                Failed to generate flowchart
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}