import LinkedListVisualizer from "./LinkedList";
import Visualizer from "./ArrayVisualizer";
import StackVisualizer from "./StackVisualizer";
import QueueVisualizer from "./Queue";
import BinaryTreeVisualizer from "./BinaryTree";
import MatrixVisualizer from "./matrix";
import GraphVisualizer from "./Graph";

export default function VisualizerSelector({ jsonData }) {
  const pattern = jsonData?.patternType?.toLowerCase?.() || "array";

  // Normalize structures in case backend uses visualLayout
  const normalizedData = {
    ...jsonData,
    structures: jsonData.visualLayout?.structures || jsonData.structures,
  };

  switch (pattern) {
    case "linkedlist":
      return <LinkedListVisualizer jsonData={normalizedData} />;
    case "stack":
      return <StackVisualizer jsonData={normalizedData} />;
    case "queue":
      return <QueueVisualizer jsonData={normalizedData} />;
    case "binarytree":
      return <BinaryTreeVisualizer jsonData={normalizedData} />;
    case "matrix":
      return <MatrixVisualizer jsonData={normalizedData} />;
    case "graph":
      return <GraphVisualizer jsonData={normalizedData} />;
    case "array":
    default:
      return (
        <Visualizer jsonData={normalizedData}>
          <main className="flex-1 grid grid-cols-12 gap-4 px-6 py-2">
            {/* Left: Variables / Pointers */}
            <section className="col-span-3">
              <div className="bg-gray-900 rounded-2xl p-4 h-full">
                <h2 className="text-sm text-gray-400 mb-2">
                  Pointers & Variables
                </h2>
                <Visualizer region="left" />
              </div>
            </section>

            {/* Center: Main Structures */}
            <section className="col-span-6">
              <div className="bg-gray-900 rounded-2xl p-4 h-full flex flex-col">
                <h2 className="text-sm text-gray-400 mb-2">Structures</h2>
                <div className="flex-1 flex items-center justify-center">
                  <Visualizer region="center" />
                </div>
              </div>
            </section>

            {/* Right: Stats */}
            <section className="col-span-3">
              <div className="bg-gray-900 rounded-2xl p-4 h-full">
                <h2 className="text-sm text-gray-400 mb-2">Stats</h2>
                <Visualizer region="right" />
              </div>
            </section>
          </main>

          {/* Controls */}
          <footer className="w-full flex justify-center pb-4">
            <Visualizer region="controls" />
          </footer>
        </Visualizer>
      );
  }
}



// // import ArrayVisualizer from "./ArrayVisualizer";
// // import LinkedListVisualizer from "./LinkedListVisualizer";
// import LinkedListVisualizer from "./LinkedList";
// import Visualizer from "./ArrayVisualizer";
// import StackVisualizer from "../pages/StackVisualizer";

// export default function VisualizerSelector({ jsonData }) {
//   const pattern = jsonData?.patternType?.toLowerCase?.() || "array";

//   switch (pattern) {
//     case "linkedlist":
//       return <LinkedListVisualizer jsonData={jsonData} />;
//     case "stack":
//       return <StackVisualizer jsonData={jsonData} />;
//     case "array":
//       return <Visualizer jsonData={jsonData} />;
    
//   }
// }
