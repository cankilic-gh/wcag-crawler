import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { ScanProgressPage } from './pages/ScanProgressPage';
import { ReportPage } from './pages/ReportPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/scans/:id/progress" element={<ScanProgressPage />} />
        <Route path="/scans/:id/report" element={<ReportPage />} />
        <Route path="/history" element={<ScanHistoryPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
