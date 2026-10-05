import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';
import { useSession } from '../hooks/useMockData';

function Layout({ role }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useSession();
  if (!session) return <Navigate to="/" replace />;
  if (role && session.user.role !== role) return <Navigate to={session.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'} replace />;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">본문으로 이동</a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <button className="menu-backdrop" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} />}
      <div className="main-area">
        <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(!menuOpen)} />
        <main id="main-content" className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}
export default Layout;
