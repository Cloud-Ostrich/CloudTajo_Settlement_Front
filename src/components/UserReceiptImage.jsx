import ReceiptImage from './ReceiptImage';

// USER 표시 전용: seed SVG의 안내 문구만 정리하고 업로드 원본/응답은 변경하지 않습니다.
function presentationUrl(url) {
  if (!url?.startsWith('data:image/svg+xml;charset=utf-8,')) return url;
  try {
    const svg = new DOMParser().parseFromString(decodeURIComponent(url.split(',').slice(1).join(',')), 'image/svg+xml');
    for (const text of svg.querySelectorAll('text')) {
      if (text.textContent === 'SAMPLE RECEIPT') text.textContent = '영수증';
      if (text.textContent === 'Mock 기본 영수증 · 실제 원본이 아닙니다') text.textContent = '영수증 미리보기';
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  } catch { return url; }
}
export default function UserReceiptImage({ receipt }) {
  return <ReceiptImage receipt={{ ...receipt, imageUrl: presentationUrl(receipt.imageUrl) }} />;
}
