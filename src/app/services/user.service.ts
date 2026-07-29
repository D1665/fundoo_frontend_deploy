import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private baseUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  // Register User
  register(user: any): Observable<string> {
    return this.http.post(`${this.baseUrl}/register`, user, {
      responseType: 'text'
    });
  }

  // Login User
  login(credentials: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, credentials);
  }

  // Forgot Password
  forgotPassword(email: string): Observable<any> {
    const params = new HttpParams().set('email', email);

    return this.http.post(`${this.baseUrl}/forgot-password`, null, {
      params
    });
  }

  // Reset Password
  resetPassword(token: string, newPassword: string): Observable<any> {
    const params = new HttpParams()
      .set('token', token)
      .set('newPassword', newPassword);

    return this.http.post(`${this.baseUrl}/reset-password`, null, {
      params
    });
  }
}