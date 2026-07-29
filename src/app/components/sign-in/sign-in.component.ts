import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css']
})
export class SignInComponent {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  emailError: string = '';
  passwordError: string = '';

  constructor(
    private router: Router,
    private userService: UserService,
    private snackbar: SnackbarService
  ) {}

  validateEmail(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
    if (!this.email.trim()) {
      this.emailError = 'Email is required.';
      return false;
    }
  
    if (!emailRegex.test(this.email.trim())) {
      this.emailError = 'Invalid email';
      return false;
    }
  
    this.emailError = '';
    return true;
  }

  validatePassword(): boolean {
    if (!this.password) {
      this.passwordError = 'Password is required.';
      return false;
    } else if (this.password.length < 8) {
      this.passwordError = 'Password must be at least 8 char.';
      return false;
    }
    this.passwordError = '';
    return true;
  }

  onSignIn(): void {

    console.log("signin button is clicked");
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
  
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
  
    this.errorMessage = '';
    this.successMessage = '';
  
    const payload = {
      email: this.email,
      password: this.password
    };
  
    this.userService.login(payload).subscribe({
  
      next: (response: any) => {
        let token = '';
        if (typeof response.data === 'string') {
          token = response.data;
        } else if (response.data && typeof response.data === 'object') {
          token = response.data.token || response.data.jwtToken || response.data.jwt || '';
        } else if (response.token) {
          token = response.token;
        } else if (response.jwtToken) {
          token = response.jwtToken;
        }

        localStorage.setItem('token', token);
        localStorage.setItem('email', this.email);

        this.successMessage = response.message;
        this.snackbar.success('Login Successful');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1000);

      },
  
      error: (error) => {
  
        console.error(error);
  
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Invalid Email or Password';
        }
        this.snackbar.error('Invalid Email or Password');
      }
  
    });
  
  }

  goToSignUp(): void {
    this.router.navigate(['/signup']);
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot']);
  }
}
