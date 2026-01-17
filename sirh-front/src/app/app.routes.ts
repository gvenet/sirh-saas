import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup.component').then(m => m.SignupComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/applications',
    loadComponent: () => import('./features/admin/applications/applications.component').then(m => m.ApplicationsComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'generator',
    loadComponent: () => import('./generator/entity-form/entity-form').then(m => m.EntityFormComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'generator/list',
    loadComponent: () => import('./generator/entity-list/entity-list').then(m => m.EntityListComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'generator/edit/:name',
    loadComponent: () => import('./generator/entity-form/entity-form').then(m => m.EntityFormComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'generator/view/:name',
    loadComponent: () => import('./generator/entity-view/entity-view').then(m => m.EntityViewComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'generator/page-editor/:id',
    loadComponent: () => import('./generator/page-editor/page-editor').then(m => m.PageEditorComponent),
    canActivate: [authGuard, adminGuard]
  },
  // Dynamic pages - view entity with specific page configuration
  {
    path: 'page/:pageId',
    loadComponent: () => import('./features/dynamic-page/dynamic-page.component').then(m => m.DynamicPageComponent),
    canActivate: [authGuard]
  },
  {
    path: 'page/:pageId/:entityId',
    loadComponent: () => import('./features/dynamic-page/dynamic-page.component').then(m => m.DynamicPageComponent),
    canActivate: [authGuard]
  },
  // Menu pages - pages associated with menu items
  {
    path: 'menu/:menuItemId',
    loadComponent: () => import('./features/menu-page/menu-page.component').then(m => m.MenuPageComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
