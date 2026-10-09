import { useEffect, useState, useSyncExternalStore } from 'react';
import { getRevision, subscribe } from '../api/mockStore';
import { getSession, subscribe as subscribeSession } from '../api/session';
import { apiRequest } from '../api/client';
export function useSession() { return useSyncExternalStore(subscribeSession, getSession); }
// 변경 API의 invalidate 이벤트와 수동 재시도에서 재조회합니다.
export function useApiData(url, params = null) {
  const paramsKey = JSON.stringify(params);
  const revision = useSyncExternalStore(subscribe, getRevision);
  const [loaded, setLoaded] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const requestParams = paramsKey === 'null' ? undefined : JSON.parse(paramsKey);
    apiRequest({ method: 'GET', url, params: requestParams }).then((response) => { if (active) setLoaded({ url, paramsKey, data: response.data }); }).catch((error) => { if (active) setLoaded({ url, paramsKey, error: error.message }); });
    return () => { active = false; };
  }, [url, paramsKey, revision, retry]);
  const loadedCurrentRequest = loaded?.url === url && loaded?.paramsKey === paramsKey;
  return { data: loadedCurrentRequest ? loaded.data : null, error: loadedCurrentRequest ? loaded.error : null, reload: () => setRetry((n) => n + 1) };
}
