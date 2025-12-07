
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PatientSearch from './pages/PatientSearch';
import Consultation from './pages/Consultation';
import Reports from './pages/Reports';
import ReportView from './pages/ReportView';
import Settings from './pages/Settings';
import Evaluation from './pages/Evaluation'; // Import

function App() {
  return (
    <Router>
      <div className="flex bg-slate-50 min-h-screen font-sans">
        <Sidebar />
        <main className="ml-64 flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<PatientSearch />} />
            <Route path="/consultation" element={<Consultation />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<ReportView />} />
            <Route path="/evals" element={<Evaluation />} /> {/* Added Route */}
            <Route path="/settings" element={<Settings />} />
            {/* Fallback routes */}
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
