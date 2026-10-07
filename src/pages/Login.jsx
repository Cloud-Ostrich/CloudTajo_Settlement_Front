import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/endpoints';
import logoImage from '../assets/cloud-ostrich-logo.png';
import './Receipts.css';
import './Workspace.css';
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { const { data } = await login(email, password); navigate(data.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-story"><div className="logo"><span className="logo-icon" aria-hidden="true"><img src={logoImage} alt="" /></span>구름타조 정산소</div><span className="eyebrow">RECEIPT TO SETTLEMENT</span><h1>영수증 한 장으로,<br />정산을 간편하게.</h1><p>영수증 등록부터 확인, 승인까지.<br />팀의 정산 흐름을 한곳에서 관리하세요.</p><ol className="login-flow">{[['영수증 업로드', '이미지를 선택하고 원본 확인'], ['제출 현황 확인', '처리 상태와 정산 결과 확인'], ['정산 요청', '사용 목적을 입력하고 제출'], ['관리자 승인', '요청을 검토하고 승인 또는 반려']].map(([title, detail], index) => <li key={title}><b>{index + 1}</b><div><strong>{title}</strong><p>{detail}</p></div></li>)}</ol><p className="muted">NAVER CLOUD 기반 영수증 OCR 정산 관리</p></section><section className="login-panel"><form className="receipt-card login-form" onSubmit={submit}><h2>구름타조 정산소 시작하기</h2><p className="muted">계정 정보를 입력해주세요.</p><fieldset className="login-fields"><label htmlFor="login-email">이메일<input id="login-email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일을 입력해주세요" required /></label><label htmlFor="login-password">비밀번호<input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label></fieldset>{error && <p className="error-message" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? '로그인 중…' : '로그인 →'}</button></form></section></main>;
}
export default Login;
