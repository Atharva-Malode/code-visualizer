export default function CodeInput({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-48 bg-gray-800 text-gray-100 p-4 rounded-xl font-mono resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400"
      placeholder="Paste your question or code here..."
    />
  );
}
