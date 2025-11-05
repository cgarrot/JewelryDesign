// Client-side toast notification utilities
// This is a wrapper around react-hot-toast for consistent usage

import toast from 'react-hot-toast';

export const toastError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
  });
};

export const toastSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
};

export const toastInfo = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-right',
  });
};

export const toastLoading = (message: string) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

export { toast };

