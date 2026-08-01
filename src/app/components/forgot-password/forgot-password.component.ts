import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit {
  email: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  emailError: string = '';
  isLoading: boolean = false;
  showColdStartNotice: boolean = false;
  private coldStartTimer: any = null;

  constructor(
    private router: Router,
    private userService: UserService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.userService.pingBackend();
  }

  validateEmail(): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!this.email) {
      this.emailError = 'Email is required.';
      return false;
    } else if (!emailRegex.test(this.email)) {
      this.emailError = 'Please enter a valid email address.';
      return false;
    }
    this.emailError = '';
    return true;
  }

  onSendResetLink(): void {
    if (!this.validateEmail()) {
      this.successMessage = '';
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;
    this.showColdStartNotice = false;
    if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
    this.coldStartTimer = setTimeout(() => {
      if (this.isLoading) {
        this.showColdStartNotice = true;
      }
    }, 3500);

    this.userService.forgotPassword(this.email).subscribe({
      next: (res: any) => {
        if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
        this.showColdStartNotice = false;
        this.isLoading = false;
        this.successMessage = res.message || 'A password reset link has been sent to your email.';
        this.snackbar.success('Reset Link Sent');
      },
      error: (err: any) => {
        if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
        this.showColdStartNotice = false;
        this.isLoading = false;
        console.error(err);
        this.errorMessage = err.error?.message || 'Failed to request password reset link. Please check the email and try again.';
        this.snackbar.error('Email Not Found');
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/signin']);
  }
}
