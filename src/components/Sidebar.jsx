import { NavLink } from 'react-router-dom';
import { useSession } from '../hooks/useMockData';
import './Sidebar.css';
function Sidebar({ open, onClose }) {
  const session = useSession();
  const admin = session?.user.role === 'ADMIN';
  return <aside className={`sidebar${open ? ' is-open' : ''}`}><div className="logo"><span className="logo-icon">D</span><span>duesflow</span><button className="sidebar-close" onClick={onClose} aria-label="메뉴 닫기">×</button></div><nav id="main-navigation" className="sidebar-menu" aria-label="주 메뉴" onClick={onClose}>{admin ? <><div className="menu-title">관리자</div><NavLink to="/admin/dashboard">운영 대시보드</NavLink><NavLink to="/admin/approvals">승인 관리</NavLink></> : <><NavLink to="/dashboard">내 제출 현황</NavLink><NavLink to="/receipts/new">영수증 등록</NavLink></>}</nav><p className="sidebar-note">영수증부터 정산까지<br />간편하게 관리하세요.</p></aside>;
}
export default Sidebar;
