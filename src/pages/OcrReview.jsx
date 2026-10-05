import { Navigate } from 'react-router-dom';
import { useSession } from '../hooks/useMockData';
// 이전 URL은 보존하지만 USER용 OCR 편집 화면은 제공하지 않습니다.
export default function OcrReview() {
  const session = useSession();
  return <Navigate to={!session ? '/' : session.user.role === 'ADMIN' ? '/admin/approvals' : '/dashboard'} replace />;
}
