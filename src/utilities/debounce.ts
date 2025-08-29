export const debounce = (func: Function, delay: number) => {
    let debounceTimer: NodeJS.Timeout;
    return function (...args: any) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func(...args), delay);
    };
  };
  