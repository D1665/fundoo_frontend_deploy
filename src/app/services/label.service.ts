import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Label } from '../models/label';
import { ApiResponse } from '../models/api-response';

@Injectable({
  providedIn: 'root'
})
export class LabelService {

  private baseUrl = `${environment.apiUrl}/labels`;

  private labelsSubject = new BehaviorSubject<Label[]>([]);
  public labels$ = this.labelsSubject.asObservable();

  private isFetching = false;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    let token = localStorage.getItem('token') || '';
    if (token === '[object Object]') token = '';

    let bearerToken = token;
    if (token && !token.startsWith('Bearer ')) {
      bearerToken = `Bearer ${token}`;
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      const cleanToken = token.replace('Bearer ', '');
      headers = headers
        .set('Authorization', bearerToken)
        .set('token', cleanToken);
    }
    return headers;
  }

  /**
   * Safe helper to extract labels array from backend response wrapper
   */
  private extractLabelList(response: any): Label[] {
  
    if (!response) return [];
    let list: any[] = [];
    if (Array.isArray(response.data)) list = response.data;
    else if (Array.isArray(response)) list = response;
    else if (response.result && Array.isArray(response.result)) list = response.result;
    else if (response.labels && Array.isArray(response.labels)) list = response.labels;

    return list.map((item: any) => ({
      id: item.id ?? item.labelId ?? item._id,
      name: item.name || item.labelName || item.title || ''
    }));
  }

  /**
   * GET /api/labels - Fetch all user labels
   */
  fetchLabels(): void {
    if (this.isFetching) {
      console.log('[LabelService] Fetch already in progress, skipping duplicate call.');
      return;
    }
    this.isFetching = true;
  
    this.http.get<ApiResponse<Label[]>>(this.baseUrl, { headers: this.getHeaders() }).subscribe({
      next: (resp) => {
        const labels = this.extractLabelList(resp);
        this.labelsSubject.next(labels);
        this.isFetching = false;
      },
      error: (err) => {
        console.error('Error fetching labels:', err);
        this.isFetching = false;
      }
    });
  }

  getAllLabels(): Observable<ApiResponse<Label[]>> {
    return this.http.get<ApiResponse<Label[]>>(this.baseUrl, { headers: this.getHeaders() });
  }

  /**
   * POST /api/labels - Create a new label
   */
  createLabel(name: string): Observable<ApiResponse<Label>> {
    
    return this.http.post<ApiResponse<Label>>(
      this.baseUrl,
      { name: name.trim() },
      { headers: this.getHeaders() }
    );
  }

  /**
   * PUT /api/labels/{id} - Rename an existing label
   */
  updateLabel(labelId: number, name: string): Observable<ApiResponse<Label>> {
    const cleanName = name.trim();
    
    return this.http.put<ApiResponse<Label>>(
      `${this.baseUrl}/${labelId}?name=${encodeURIComponent(cleanName)}`,
      { name: cleanName },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.put<ApiResponse<Label>>(
          `${this.baseUrl}/${labelId}`,
          { name: cleanName },
          { headers: this.getHeaders() }
        );
      })
    );
  }

  /**
   * DELETE /api/labels/{id} - Delete label by ID
   */
  deleteLabel(labelId: number): Observable<ApiResponse<any>> {
  
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/${labelId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * POST /api/labels/{labelId}/notes/{noteId} - Attach label to a note
   */
  addLabelToNote(labelId: number, noteId: number): Observable<ApiResponse<any>> {
    
    return this.http.post<ApiResponse<any>>(
      `${this.baseUrl}/${labelId}/notes/${noteId}`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * DELETE /api/labels/{labelId}/notes/{noteId} - Detach label from a note
   */
  removeLabelFromNote(labelId: number, noteId: number): Observable<ApiResponse<any>> {
  
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/${labelId}/notes/${noteId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/labels/{labelId}/notes - Fetch notes by label ID
   */
  getNotesByLabel(labelId: number): Observable<ApiResponse<any>> {
    
    return this.http.get<ApiResponse<any>>(
      `${this.baseUrl}/${labelId}/notes`,
      { headers: this.getHeaders() }
    );
  }
}
