import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState('');
  const timer = useRef(null);
  const showToast = useCallback((message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(''), 2200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, showToast };
}
