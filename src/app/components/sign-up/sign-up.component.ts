import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent implements OnInit {
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  showPassword: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  firstNameError: string = '';
  lastNameError: string = '';
  emailError: string = '';
  passwordError: string = '';
  confirmPasswordError: string = '';

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

  validateFirstName(): boolean {
    const nameRegex = /^[A-Za-z]+$/;
  
    if (!this.firstName.trim()) {
      this.firstNameError = 'First name is required.';
      return false;
    }
  
    if (!nameRegex.test(this.firstName.trim())) {
      this.firstNameError = 'First name should contain only letters.';
      return false;
    }
  
    if (this.firstName.trim().length < 2) {
      this.firstNameError = 'First name must be at least 2 characters.';
      return false;
    }
  
    if (this.firstName.trim().length > 30) {
      this.firstNameError = 'First name must not exceed 30 characters.';
      return false;
    }
  
    this.firstNameError = '';
    return true;
  }
  
  validateLastName(): boolean {
    const nameRegex = /^[A-Za-z]+$/;
  
    if (!this.lastName.trim()) {
      this.lastNameError = 'Last name is required.';
      return false;
    }
  
    if (!nameRegex.test(this.lastName.trim())) {
      this.lastNameError = 'Last name should contain only letters.';
      return false;
    }
  
    if (this.lastName.trim().length < 2) {
      this.lastNameError = 'Last name must be at least 2 characters.';
      return false;
    }
  
    if (this.lastName.trim().length > 30) {
      this.lastNameError = 'Last name must not exceed 30 characters.';
      return false;
    }
  
    this.lastNameError = '';
    return true;
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

  validatePassword(): boolean {
    const passwordRegex = /^.{8,}$/;
    if (!this.password) {
      this.passwordError = 'Password is required.';
      return false;
    } else if (!passwordRegex.test(this.password)) {
      this.passwordError = 'Password must be at least 8 char';
      return false;
    }
    this.passwordError = '';
    // Re-validate confirm password if it has been entered
    if (this.confirmPassword) {
      this.validateConfirmPassword();
    }
    return true;
  }

  validateConfirmPassword(): boolean {
    if (!this.confirmPassword) {
      this.confirmPasswordError = 'Please confirm your password.';
      return false;
    } else if (this.password !== this.confirmPassword) {
      this.confirmPasswordError = 'Passwords do not match.';
      return false;
    }
    this.confirmPasswordError = '';
    return true;
  }

  onSubmit(): void {
    if (this.isLoading) return;

    const isFirstNameValid = this.validateFirstName();
    const isLastNameValid = this.validateLastName();
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
    const isConfirmPasswordValid = this.validateConfirmPassword();
 
    if (
      !isFirstNameValid ||
      !isLastNameValid ||
      !isEmailValid ||
      !isPasswordValid ||
      !isConfirmPasswordValid
    ) {
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
 
    const payload = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password
    };
 
    this.userService.register(payload).subscribe({
      next: (res: string) => {
        if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
        this.showColdStartNotice = false;
        this.successMessage = res || 'Registration successful! Redirecting to sign in...';
        this.snackbar.success('Registration Successful');
        setTimeout(() => {
          this.isLoading = false;
          this.router.navigate(['/signin']);
        }, 2000);
      },
      error: (err: any) => {
        if (this.coldStartTimer) clearTimeout(this.coldStartTimer);
        this.showColdStartNotice = false;
        this.isLoading = false;
        console.error(err);
        let errorMsg = 'Registration failed.';
        if (err.status === 0) {
          errorMsg = 'Cannot connect to backend. Please verify the backend is running and CORS is configured on Render.';
        } else if (err.error) {
          if (typeof err.error === 'object') {
            if (err.error.message) {
              errorMsg = err.error.message;
            } else {
              errorMsg = Object.values(err.error).join(' ');
            }
          } else {
            try {
              const parsed = JSON.parse(err.error);
              errorMsg = parsed.message || 'Registration failed.';
            } catch {
              errorMsg = err.error || 'Registration failed.';
            }
          }
        } else {
          errorMsg = 'Registration failed. Please try again.';
        }
        
        this.snackbar.error(errorMsg);
        this.errorMessage = '';
      }
      
    });
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  goToSignIn(): void {
    this.router.navigate(['/signin']);
  }
}
