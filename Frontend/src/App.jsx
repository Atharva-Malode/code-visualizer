// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import VisualizePage from "./pages/VisualizePage";
import SolutionPage from "./pages/SolutionPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/visualize" element={<VisualizePage />} />
        <Route path="/solution" element={<SolutionPage />} />
      </Routes>
    </Router>
  );
}