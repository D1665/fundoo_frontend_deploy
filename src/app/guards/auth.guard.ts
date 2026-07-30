import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authGuard = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    return true;
  }

  // Not logged in, redirect to signin
  router.navigate(['/signin']);
  return false;
};

export const guestGuard = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (!token) {
    return true;
  }

  // Already logged in, redirect to dashboard
  router.navigate(['/dashboard/home']);
  return false;
};
