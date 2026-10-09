import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { restoreSession } from './api/endpoints';
import { getSession } from './api/session';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReceiptUpload from './pages/ReceiptUpload';
import OcrReview from './pages/OcrReview';
import AdminApproval from './pages/AdminApproval';
import AdminDashboard from './pages/AdminDashboard';
function AppRoutes() {
  const [sessionChecked, setSessionChecked] = useState(() => !getSession()?.accessToken);
  useEffect(() => {
    if (!getSession()?.accessToken) return undefined;
    let active = true;
    restoreSession().catch(() => {}).finally(() => {
      if (active) setSessionChecked(true);
    });
    return () => { active = false; };
  }, []);
  if (!sessionChecked) return <main role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>로그인 상태를 확인하고 있습니다...</main>;
  return <Routes><Route path="/" element={<Login />} /><Route element={<Layout role="USER" />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/receipts/new" element={<ReceiptUpload />} /></Route><Route element={<Layout role="ADMIN" />}><Route path="/admin/dashboard" element={<AdminDashboard />} /><Route path="/admin/approvals" element={<AdminApproval />} /></Route><Route path="/ocr/review" element={<OcrReview />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
export default App;
