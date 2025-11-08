// src/components/Loader.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const msgs = [
  "Analyzing code structure… 🧠",
  "Detecting data patterns… 🔍",
  "Extracting steps and actions…",
  "Preparing animations… ✨",
];

export default function Loader({ pattern }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (pattern) return; // stop cycling once pattern is shown
    const t = setInterval(() => setIdx((i) => (i + 1) % msgs.length), 700);
    return () => clearInterval(t);
  }, [pattern]);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-cyan-400 text-xl font-mono text-center"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
      >
        {pattern ? `Pattern identified as ${pattern} 🔎` : msgs[idx]}
      </motion.div>
    </motion.div>
  );
}
