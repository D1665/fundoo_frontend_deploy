import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SnackbarService } from '../../services/snackbar.service';
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';
  token = '';
  errorMessage = '';
  successMessage = '';

  newPasswordError = '';
  confirmPasswordError = '';

  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.userService.pingBackend();
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.errorMessage = 'Invalid or expired password reset link.';
      }
    });
  }

  validatePassword(): boolean {
    const passwordRegex = /^.{8,}$/;
    if (!this.newPassword) {
      this.newPasswordError = 'Password is required.';
      return false;
    } else if (!passwordRegex.test(this.newPassword)) {
      this.newPasswordError = 'Password must be at least 8 characters';
      return false;
    }
    this.newPasswordError = '';
    if (this.confirmPassword) {
      this.validateConfirmPassword();
    }
    return true;
  }

  validateConfirmPassword(): boolean {
    if (!this.confirmPassword) {
      this.confirmPasswordError = 'Please confirm your password.';
      return false;
    } else if (this.newPassword !== this.confirmPassword) {
      this.confirmPasswordError = 'Passwords do not match.';
      return false;
    }
    this.confirmPasswordError = '';
    return true;
  }

  onSubmit(): void {
    if (this.isLoading) return;
    if (!this.token) {
      this.errorMessage = 'Missing reset token.';
      return;
    }
    const isPassValid = this.validatePassword();
    const isConfirmValid = this.validateConfirmPassword();

    if (!isPassValid || !isConfirmValid) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;

    this.userService.resetPassword(this.token, this.newPassword).subscribe({
      next: (res) => {
        this.snackbar.success('Password Reset Successfully');
        this.successMessage = 'Password reset successful! Redirecting to login...';
        setTimeout(() => {
          this.isLoading = false;
          this.router.navigate(['/signin']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        console.error(err);
        this.snackbar.error('Password Reset Failed');
        this.errorMessage = err.error?.message || 'Failed to reset password. Please try again.';
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/signin']);
  }
}
