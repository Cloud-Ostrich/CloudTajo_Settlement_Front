import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReceiptUpload from './pages/ReceiptUpload';
import OcrReview from './pages/OcrReview';
import AdminApproval from './pages/AdminApproval';
import AdminDashboard from './pages/AdminDashboard';
function App() {
  return <BrowserRouter><Routes><Route path="/" element={<Login />} /><Route element={<Layout role="USER" />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/receipts/new" element={<ReceiptUpload />} /></Route><Route element={<Layout role="ADMIN" />}><Route path="/admin/dashboard" element={<AdminDashboard />} /><Route path="/admin/approvals" element={<AdminApproval />} /></Route><Route path="/ocr/review" element={<OcrReview />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>;
}
export default App;
