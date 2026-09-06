import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Branding } from "./pages/Branding";
import { Configuration } from "./pages/Configuration";
import { Dashboard } from "./pages/Dashboard";
import { Schedule } from "./pages/Schedule";
import { Upload } from "./pages/Upload";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/branding" element={<Branding />} />
      </Route>
    </Routes>
  );
}
