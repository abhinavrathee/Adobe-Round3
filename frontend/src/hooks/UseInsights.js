import { useEffect, useState } from "react";
import { fetchInsights } from "../utils/api";

/**
 * useInsights({docId, pdfName}) -> { data, loading, error, reload }
 */
export default function useInsights({ docId, pdfName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!(docId || pdfName));
  const [error, setError] = useState(null);

  const load = async () => {
    if (!docId && !pdfName) return;
    setLoading(true); setError(null);
    try {
      const json = await fetchInsights({ docId, pdfName });
      setData(json);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [docId, pdfName]);

  return { data, loading, error, reload: load };
}
