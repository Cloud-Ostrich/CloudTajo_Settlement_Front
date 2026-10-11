import { useState } from 'react';
import ImageViewer from './ImageViewer';
import './ReceiptUX.css';

export default function ReceiptImage({ receipt }) {
  const imageUrl = receipt.file?.url || receipt.imageUrl;
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [viewing, setViewing] = useState(false);
  const [failedUrl, setFailedUrl] = useState(null);
  if (!imageUrl || failedUrl === imageUrl) return <p className="muted">원본 이미지를 불러올 수 없습니다.</p>;
  return <>{loadedUrl !== imageUrl && <p className="muted" role="status">영수증 이미지 불러오는 중…</p>}<button className="receipt-image-open" onClick={() => setViewing(true)} aria-label="이미지 확대 보기"><img className="review-preview" src={imageUrl} alt={`${receipt.merchantName || '제출된'} 영수증 원본`} onLoad={() => setLoadedUrl(imageUrl)} onError={() => setFailedUrl(imageUrl)} /></button><button className="button secondary" onClick={() => setViewing(true)}>확대 보기</button>{viewing && <ImageViewer key={imageUrl} src={imageUrl} alt="영수증 원본 확대" onClose={() => setViewing(false)} />}</>;
}
