import { useEffect, useState } from 'react';

// 비동기 파일 읽기를 취소해 빠른 재선택 시 이전 이미지가 표시되지 않게 합니다.
export default function useReceiptPreview(file) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (!(file instanceof File)) return;
    const reader = new FileReader();
    reader.onload = () => setLoaded({ file, url: reader.result });
    reader.readAsDataURL(file);
    return () => {
      reader.onload = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);
  return loaded?.file === file ? loaded.url : '';
}
