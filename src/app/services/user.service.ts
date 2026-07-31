import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private baseUrl = `${environment.apiUrl}/users`;
  private keepAliveInterval: any = null;

  constructor(private http: HttpClient) {
    this.startKeepAlive();
  }

  /**
   * Pre-warms the Render backend immediately on app launch and keeps it awake with a 3-minute ping loop.
   */
  startKeepAlive(): void {
    this.pingBackend();

    if (!this.keepAliveInterval && typeof window !== 'undefined') {
      // Ping backend every 3 minutes (180,000 ms) so Render free tier never sleeps (sleeps after 15m inactivity)
      this.keepAliveInterval = setInterval(() => {
        this.pingBackend();
      }, 180000);
    }
  }

  pingBackend(): void {
    this.http.get(`${environment.apiUrl}/labels`, { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

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