import { useEffect, RefObject } from 'react';


export function useOnClickOutside(
  dropdownRef: RefObject<HTMLElement | null>, 
  handler: (event: MouseEvent | TouchEvent) => void,
  excludedRef?: RefObject<HTMLElement | null> 
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      
      if (!dropdownRef.current || dropdownRef.current.contains(target)) {
        return;
      }
      
      if (excludedRef && excludedRef.current && excludedRef.current.contains(target)) {
        return;
      }
      
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [dropdownRef, handler, excludedRef]);
}

