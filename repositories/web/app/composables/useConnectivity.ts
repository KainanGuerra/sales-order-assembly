// Whether the server can be reached right now. Not the browser's "online" flag
// alone: with one bar of signal the browser says online while nothing arrives.
// Any answer from the server sets it true; a request that fails to reach it (or
// takes too long, see REQUEST_TIMEOUT_MS) sets it false, and a light probe sets
// it back (plugins/offline.client.ts).
export function useConnectivity() {
  const online = useState<boolean>('online', () => true);
  return {
    online,
    markOnline: () => {
      online.value = true;
    },
    markOffline: () => {
      online.value = false;
    },
  };
}
