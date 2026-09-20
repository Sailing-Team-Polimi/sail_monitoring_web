import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthRoles } from '../../dtos/auth/auth-roles';

export const authGuard: CanActivateFn = (route, _) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const routeInfo = route.data as { allowedRoles: AuthRoles[] };
  const loggedRole = authService.authRole()

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  let canAccessRoute = false;
  if (Array.isArray(routeInfo?.allowedRoles) && loggedRole) {
    canAccessRoute = routeInfo.allowedRoles.includes(loggedRole)
  }

  return canAccessRoute ? true : router.createUrlTree(['/dashboard']);
};