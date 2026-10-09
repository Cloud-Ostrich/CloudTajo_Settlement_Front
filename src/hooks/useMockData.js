import { useEffect, useState, useSyncExternalStore } from 'react';
import { getRevision, subscribe } from '../api/mockStore';
import { getSession, subscribe as subscribeSession } from '../api/session';
import { apiRequest } from '../api/client';
export function useSession() { return useSyncExternalStore(subscribeSession, getSession); }
// 변경 API의 invalidate 이벤트와 수동 재시도에서 재조회합니다.
export function useApiData(url) {
  const revision = useSyncExternalStore(subscribe, getRevision);
  const [loaded, setLoaded] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!url) return;
    let active = true;
    apiRequest({ method: 'GET', url }).then((response) => { if (active) setLoaded({ url, data: response.data }); }).catch((error) => { if (active) setLoaded({ url, error: error.message }); });
    return () => { active = false; };
  }, [url, revision, retry]);
  return { data: loaded?.url === url ? loaded.data : null, error: loaded?.url === url ? loaded.error : null, reload: () => setRetry((n) => n + 1) };
}
