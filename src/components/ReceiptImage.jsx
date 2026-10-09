import { useState } from 'react';

export default function ReceiptImage({ receipt }) {
  const imageUrl = receipt.file?.url || receipt.imageUrl;
  const [failedUrl, setFailedUrl] = useState(null);
  if (!imageUrl || failedUrl === imageUrl) return <p className="muted">원본 이미지를 불러올 수 없습니다.</p>;
  return <img className="review-preview" src={imageUrl} alt={`${receipt.merchantName || '제출된'} 영수증 원본`} onError={() => setFailedUrl(imageUrl)} />;
}
