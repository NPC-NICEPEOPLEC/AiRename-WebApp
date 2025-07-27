import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UploadPage from "@/pages/UploadPage";
import ProcessPage from "@/pages/ProcessPage";
import HistoryPage from "@/pages/HistoryPage";
import Home from "@/pages/Home";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/process" element={<ProcessPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/old" element={<Home />} />
      </Routes>
    </Router>
  );
}
