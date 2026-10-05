import { useLocation } from 'react-router-dom';
import './Header.css';
import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useMockData';
import { logout } from '../api/mockStore';
const titles = { '/dashboard': '내 제출 현황', '/admin/dashboard': '운영 대시보드', '/receipts/new': '영수증 등록', '/ocr/review': 'OCR 결과 확인', '/admin/approvals': '승인 관리' };
function Header({ menuOpen, onToggleMenu }) {
  const { pathname } = useLocation();
  const session = useSession();
  return (
    <header className="header">
      <div className="header-title">
        <button className="menu-toggle" onClick={onToggleMenu} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={menuOpen} aria-controls="main-navigation">☰</button>
        <strong>{titles[pathname] || '영수증 정산 관리'}</strong>
      </div>
      <div className="user-info"><span>{session?.user.name || '체험 사용자'}</span><div className="profile" aria-hidden="true">{session?.user.role === 'ADMIN' ? 'A' : 'U'}</div><Link className="role-switch" to="/" onClick={logout}>로그아웃</Link></div>
    </header>
  );
}
export default Header;
