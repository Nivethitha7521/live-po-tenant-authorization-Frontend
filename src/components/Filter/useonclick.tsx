import { useEffect, RefObject } from 'react';

const useOnClickOutside = (
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  exceptionRefs: RefObject<HTMLElement | null>[] = []
) => {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is inside the main ref (dropdown content)
      if (ref.current && ref.current.contains(target)) {
        return;
      }

      // Check if click is inside any of the exception refs (buttons, etc.)
      for (const exceptionRef of exceptionRefs) {
        if (exceptionRef.current && exceptionRef.current.contains(target)) {
          return;
        }
      }

      // If we reach here, click was outside all refs
      handler();
    };

    document.addEventListener('mousedown', listener);
    
    return () => {
      document.removeEventListener('mousedown', listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, handler]);
};

export default useOnClickOutside;