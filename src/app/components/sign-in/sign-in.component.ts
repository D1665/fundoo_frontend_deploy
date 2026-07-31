import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css']
})
export class SignInComponent implements OnInit {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  emailError: string = '';
  passwordError: string = '';

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private userService: UserService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.userService.pingBackend();
  }

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
    if (this.isLoading) return;

    console.log("signin button is clicked");
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
  
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
  
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;
  
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
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        }, 1000);

      },
  
      error: (error) => {
        this.isLoading = false;
        console.error(error);
        if (error.status === 0) {
          this.errorMessage = 'Cannot connect to backend. Please check CORS configuration on Render.';
          this.snackbar.error(this.errorMessage);
        } else {
          if (error.error && error.error.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Invalid Email or Password';
          }
          this.snackbar.error(this.errorMessage);
        }
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
