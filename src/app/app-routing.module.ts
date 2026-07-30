import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SignInComponent } from './components/sign-in/sign-in.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { authGuard, guestGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'signin', pathMatch: 'full' },
  { path: 'signin', component: SignInComponent, canActivate: [guestGuard] },
  { path: 'signup', component: SignUpComponent, canActivate: [guestGuard] },
  { path: 'forgot', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
  { path: 'dashboard', redirectTo: 'dashboard/home', pathMatch: 'full' },
  { path: 'dashboard/home', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'dashboard/reminders', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'dashboard/archive', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'dashboard/trash', component: DashboardComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'signin' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }