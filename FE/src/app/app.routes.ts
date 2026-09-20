// FE/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MapComponent } from './pages/map/map.component';
import { MechatronComponent } from './pages/mechatron/mechatron.component';
import { VisualizationComponent } from './pages/visualization/visualization.component';
import { SettingsComponent } from './pages/settings/settings.component'; // ✅ Aggiunto import
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { AuthRoles } from './dtos/auth/auth-roles';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard', component: DashboardComponent, canActivate: [authGuard],
    data: { allowedRoles: [AuthRoles.Admin, AuthRoles.Guest] }
  },
  {
    path: 'map', component: MapComponent, canActivate: [authGuard],
    data: { allowedRoles: [AuthRoles.Admin] }
  },
  {
    path: 'mechatron', component: MechatronComponent, canActivate: [authGuard],
    data: { allowedRoles: [AuthRoles.Admin] }
  },
  {
    path: 'visualization', component: VisualizationComponent, canActivate: [authGuard],
    data: { allowedRoles: [AuthRoles.Admin, AuthRoles.Guest] }
  },
  {
    path: 'settings', component: SettingsComponent, canActivate: [authGuard],
    data: { allowedRoles: [AuthRoles.Admin] }
  },

  // Redirect di default
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' }
];
