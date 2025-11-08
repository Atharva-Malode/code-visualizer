import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import VisualizerSelector from "../visualizers/VisualizerSelector";

export default function VisualizePage() {
  const location = useLocation();
  const [data, setData] = useState(location.state?.data || null);

  useEffect(() => {
    // Optional fallback if user directly visits /visualize
    if (!data) {
      console.warn("No visualization data provided.");
    }
  }, [data]);

  if (!data)
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-950 text-cyan-400 text-xl">
        No visualization data available. Please go back and enter a problem.
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-4 pb-2">
        <h1 className="text-2xl text-cyan-400 font-semibold">
          🧩 {data.questionName}
        </h1>
      </header>

      {/* ✅ Auto-select correct visualizer */}
      <VisualizerSelector jsonData={data} />
    </div>
  );
}


// import { useEffect, useState } from "react";
// import VisualizerSelector from "../visualizers/VisualizerSelector";

// export default function VisualizePage() {
//   const [data, setData] = useState(null);

//   useEffect(() => {
//     fetch("stack.json")
//       .then((r) => r.json())
//       .then(setData)
//       .catch((err) => console.error("Error loading JSON:", err));
//   }, []);

//   if (!data)
//     return (
//       <div className="min-h-screen flex justify-center items-center bg-gray-950 text-cyan-400 text-xl">
//         Loading visualization…
//       </div>
//     );

//   return (
//     <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
//       {/* Header */}
//       <header className="px-6 pt-4 pb-2">
//         <h1 className="text-2xl text-cyan-400 font-semibold">
//           🧩 {data.questionName}
//         </h1>
//       </header>

//       {/* ✅ Auto-select correct visualizer */}
//       <VisualizerSelector jsonData={data} />
//     </div>
//   );
// }
