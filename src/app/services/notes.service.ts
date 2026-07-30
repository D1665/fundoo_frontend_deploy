import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, catchError, of, forkJoin } from 'rxjs';

import { environment } from '../../environments/environment';
import { Note } from '../models/notes';
import { ApiResponse } from '../models/api-response';

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  private baseUrl = `${environment.apiUrl}/notes`;

  // Active reactive state stream for the UI
  private notesSubject = new BehaviorSubject<Note[]>([]);
  public notes$ = this.notesSubject.asObservable();

  private currentViewSubject = new BehaviorSubject<string>('notes');
  public currentView$ = this.currentViewSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private isGridViewSubject = new BehaviorSubject<boolean>(true);
  public isGridView$ = this.isGridViewSubject.asObservable();

  private searchQuerySubject = new BehaviorSubject<string>('');
  public searchQuery$ = this.searchQuerySubject.asObservable();

  private refreshNotesSubject = new Subject<void>();
  public refreshNotes$ = this.refreshNotesSubject.asObservable();

  private openEditLabelsModalSubject = new Subject<void>();
  public openEditLabelsModal$ = this.openEditLabelsModalSubject.asObservable();

  private isFetching = false;

  constructor(private http: HttpClient) {}

  setView(view: string): void {
    if (this.currentViewSubject.value === view) {
      return;
    }
    this.currentViewSubject.next(view);
    this.fetchNotesFromBackend();
  }

  getCurrentView(): string {
    return this.currentViewSubject.getValue();
  }

  setSearchQuery(query: string): void {
    this.searchQuerySubject.next(query);
  }

  openEditLabelsModal(): void {
    this.openEditLabelsModalSubject.next();
  }

  toggleView(): void {
    this.isGridViewSubject.next(!this.isGridViewSubject.value);
  }

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
   * Normalizes incoming raw note objects from backend to guarantee expected property names
   */
  public normalizeNote(raw: any): Note {
    if (!raw) {
      return {
        id: 0,
        title: '',
        content: '',
        description: '',
        color: '#ffffff',
        pinned: false,
        archived: false,
        trashed: false
      };
    }

    let rawContent = raw.content || raw.description || '';
    let extractedImage: string | undefined = undefined;

    if (typeof rawContent === 'string' && rawContent.includes('<!--IMG:')) {
      const imgMarkerIndex = rawContent.indexOf('<!--IMG:');
      const imgEndIndex = rawContent.indexOf('-->', imgMarkerIndex);
      if (imgEndIndex !== -1) {
        extractedImage = rawContent.substring(imgMarkerIndex + 8, imgEndIndex);
        rawContent = rawContent.substring(0, imgMarkerIndex).trim();
      }
    }

    const noteId = raw.id ?? raw.noteId ?? raw._id ?? 0;
    if (extractedImage && noteId) {
      try {
        localStorage.setItem('note_image_' + noteId, extractedImage);
      } catch (e) {}
    } else if (noteId && !extractedImage) {
      const cached = localStorage.getItem('note_image_' + noteId);
      if (cached) extractedImage = cached;
    }

    const isArchived = Boolean(raw.archived ?? raw.isArchive ?? raw.isArchived ?? false);
    const isTrashed = Boolean(raw.trashed ?? raw.isTrash ?? raw.isTrashed ?? false);

    let collabs: string[] = [];
    if (raw.collaborators && Array.isArray(raw.collaborators)) {
      collabs = raw.collaborators.map((item: any) => {
        if (typeof item === 'string') return item;
        return item?.email || item?.emailId || '';
      }).filter(Boolean);
    }

    return {
      id: noteId,
      title: raw.title || '',
      content: rawContent,
      description: rawContent,
      image: extractedImage,
      color: raw.color || raw.colour || '#ffffff',
      reminder: raw.reminder || raw.reminderTime || null,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      labels: raw.labels || [],
      ownerEmail: raw.ownerEmail,
      myPermission: raw.myPermission,
      pinned: Boolean(raw.pinned ?? raw.isPin ?? raw.isPinned ?? false),
      archived: isArchived,
      trashed: isTrashed,
      collaborators: collabs
    };
  }

  notifyRefresh(): void {
    this.refreshNotesSubject.next();
    this.fetchNotesFromBackend();
  }

  addCreatedNoteToSubject(note: Note): void {
    const normalized = this.normalizeNote(note);
    const current = this.notesSubject.getValue();
    this.notesSubject.next([normalized, ...current.filter(n => n.id !== normalized.id)]);
  }

  updateLocalNote(updatedNote: Note): void {
    const normalized = this.normalizeNote(updatedNote);
    const current = this.notesSubject.getValue();
    const index = current.findIndex(n => n.id === normalized.id);
    if (index !== -1) {
      const copy = [...current];
      copy[index] = { ...copy[index], ...normalized };
      this.notesSubject.next(copy);
    } else {
      this.notesSubject.next([normalized, ...current]);
    }
  }

  removeLocalNote(noteId: number): void {
    const current = this.notesSubject.getValue();
    this.notesSubject.next(current.filter(n => n.id !== noteId));
  }

  /**
   * Helper to safely extract note list array from various backend response wrappers
   */
  private extractNotesList(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    if (response.notes && Array.isArray(response.notes)) return response.notes;
    if (Array.isArray(response.result)) return response.result;
    if (Array.isArray(response.content)) return response.content;
    return [];
  }

  /**
   * POST /api/notes - Create Note in Backend Database
   */
  createNote(note: Partial<Note>): Observable<ApiResponse<Note>> {
    const rawContent = note.content || note.description || note.title || ' ';
    const validContent = rawContent.trim() ? rawContent.trim() : (note.title || 'Note');

    const payload = {
      title: note.title || '',
      content: validContent,
      color: note.color || '#ffffff'
    };

    console.log('[NoteService] POST /api/notes payload:', payload);

    return this.http.post<ApiResponse<Note>>(
      this.baseUrl,
      payload,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/notes - Fetch All Notes from Backend Database
   */
  getAllNotesFromBackend(): Observable<ApiResponse<Note[]>> {
    return this.http.get<ApiResponse<Note[]>>(
      this.baseUrl,
      { headers: this.getHeaders() }
    );
  }

  getAllNotes(): Observable<ApiResponse<Note[]>> {
    return this.getAllNotesFromBackend();
  }

  /**
   * GET /api/notes/archived - Fetch Archived Notes
   */
  getArchivedNotes(): Observable<ApiResponse<Note[]>> {
    return this.http.get<ApiResponse<Note[]>>(
      `${this.baseUrl}/archived`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/notes/trash - Fetch Trashed Notes
   */
  getTrashedNotes(): Observable<ApiResponse<Note[]>> {
    return this.http.get<ApiResponse<Note[]>>(
      `${this.baseUrl}/trash`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/notes/pinned - Fetch Pinned Notes
   */
  getPinnedNotes(): Observable<ApiResponse<Note[]>> {
    return this.http.get<ApiResponse<Note[]>>(
      `${this.baseUrl}/pinned`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/notes/search - Search Notes (Spring Boot parameter: keyword)
   */
  searchNotes(keyword: string): Observable<ApiResponse<Note[]>> {
    return this.http.get<ApiResponse<Note[]>>(
      `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Smart Fetcher based on Active View (Notes, Archive, Trash)
   * Automatically combines user's own notes AND notes shared with user via Collaborator
   */
  fetchNotesFromBackend(showLoader: boolean = false): void {
    if (this.isFetching) {
      console.log('[NoteService] Fetch already in progress, skipping duplicate call.');
      return;
    }
    this.isFetching = true;

    if (showLoader) {
      this.loadingSubject.next(true);
    }
    const view = this.currentViewSubject.getValue();

    if (view === 'archive') {
      forkJoin({
        archivedOwn: this.getArchivedNotes().pipe(catchError(() => of([]))),
        shared: this.getSharedNotes().pipe(catchError(() => of([])))
      }).subscribe({
        next: (res: any) => {
          const archivedRaw = this.extractNotesList(res.archivedOwn);
          const sharedRaw = this.extractNotesList(res.shared);

          const combinedMap = new Map<number, Note>();
          [...archivedRaw, ...sharedRaw].forEach(raw => {
            const norm = this.normalizeNote(raw);
            if (norm.id) {
              combinedMap.set(norm.id, norm);
            }
          });

          this.notesSubject.next(Array.from(combinedMap.values()));
          this.isFetching = false;
          this.loadingSubject.next(false);
        },
        error: (err) => {
          console.error('Error fetching archived/shared notes:', err);
          this.isFetching = false;
          this.loadingSubject.next(false);
        }
      });
    } else if (view === 'trash') {
      this.getTrashedNotes().subscribe({
        next: (resp) => {
          const raw = this.extractNotesList(resp);
          this.notesSubject.next(raw.map(n => this.normalizeNote(n)));
          this.isFetching = false;
          this.loadingSubject.next(false);
        },
        error: (err) => {
          console.error('Error fetching trashed notes:', err);
          this.isFetching = false;
          this.loadingSubject.next(false);
        }
      });
    } else {
      // Main Notes View: Combine user's own notes + shared notes from collaborators
      forkJoin({
        own: this.getAllNotesFromBackend().pipe(catchError(() => of([]))),
        shared: this.getSharedNotes().pipe(catchError(() => of([])))
      }).subscribe({
        next: (res: any) => {
          const ownRaw = this.extractNotesList(res.own);
          const sharedRaw = this.extractNotesList(res.shared);

          const combinedMap = new Map<number, Note>();
          [...ownRaw, ...sharedRaw].forEach(raw => {
            const norm = this.normalizeNote(raw);
            if (norm.id) {
              combinedMap.set(norm.id, norm);
            }
          });

          this.notesSubject.next(Array.from(combinedMap.values()));
          this.isFetching = false;
          this.loadingSubject.next(false);
        },
        error: (err) => {
          console.error('Error fetching notes:', err);
          this.isFetching = false;
          this.loadingSubject.next(false);
        }
      });
    }
  }

  /**
   * PUT /api/notes/{id} - Update Note Title/Content/Color
   */
  updateNote(noteId: number, changes: Partial<Note>): Observable<ApiResponse<Note>> {
    const rawContent = changes.content !== undefined ? changes.content : (changes.description !== undefined ? changes.description : '');
    const validContent = (rawContent && rawContent.trim()) ? rawContent.trim() : ' ';

    const payload: any = {
      title: changes.title !== undefined ? changes.title : '',
      content: validContent,
      color: changes.color || '#ffffff'
    };

    console.log('[NoteService] PUT /api/notes/' + noteId + ' payload:', payload);

    return this.http.put<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  /**
   * DELETE /api/notes/{id} - Permanently Delete Note
   */
  deleteNote(noteId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/${noteId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * PATCH /api/notes/{id}/archive with fallbacks
   */
  archiveNote(noteId: number, currentNote?: Note): Observable<any> {
    const targetState = currentNote ? !currentNote.archived : true;
    return this.http.patch<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}/archive`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.put<ApiResponse<Note>>(
          `${this.baseUrl}/${noteId}/archive`,
          {},
          { headers: this.getHeaders() }
        ).pipe(
          catchError(() => this.updateNote(noteId, { archived: targetState, trashed: false }))
        );
      })
    );
  }

  /**
   * PATCH /api/notes/{id}/pin with fallbacks
   */
  pinNote(noteId: number, currentNote?: Note): Observable<any> {
    const targetState = currentNote ? !currentNote.pinned : true;
    return this.http.patch<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}/pin`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.put<ApiResponse<Note>>(
          `${this.baseUrl}/${noteId}/pin`,
          {},
          { headers: this.getHeaders() }
        ).pipe(
          catchError(() => this.updateNote(noteId, { pinned: targetState }))
        );
      })
    );
  }

  /**
   * PATCH /api/notes/{id}/trash with fallbacks
   */
  trashNote(noteId: number, currentNote?: Note): Observable<any> {
    return this.http.patch<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}/trash`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.put<ApiResponse<Note>>(
          `${this.baseUrl}/${noteId}/trash`,
          {},
          { headers: this.getHeaders() }
        ).pipe(
          catchError(() => this.updateNote(noteId, { trashed: true, archived: false, pinned: false }))
        );
      })
    );
  }

  /**
   * Restore Note from Trash with fallbacks
   */
  restoreNote(noteId: number): Observable<any> {
    return this.http.patch<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}/trash`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.put<ApiResponse<Note>>(
          `${this.baseUrl}/${noteId}/restore`,
          {},
          { headers: this.getHeaders() }
        ).pipe(
          catchError(() => this.updateNote(noteId, { trashed: false }))
        );
      })
    );
  }

  /**
   * Change Color with fallbacks
   */
  changeColor(noteId: number, color: string): Observable<any> {
    return this.http.put<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}`,
      { color },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.put<ApiResponse<Note>>(
          `${this.baseUrl}/${noteId}/color?color=${encodeURIComponent(color)}`,
          {},
          { headers: this.getHeaders() }
        );
      })
    );
  }

  /**
   * PATCH /api/notes/{id}/reminder - Set Reminder
   */
  setReminder(noteId: number, reminder: string): Observable<ApiResponse<Note>> {
    return this.http.patch<ApiResponse<Note>>(
      `${this.baseUrl}/${noteId}/reminder`,
      { reminderTime: reminder },
      { headers: this.getHeaders() }
    );
  }

  /**
   * DELETE /api/notes/{id}/reminder - Delete Reminder
   */
  deleteReminder(noteId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/${noteId}/reminder`,
      { headers: this.getHeaders() }
    );
  }

  // ==========================================
  // Collaborator Controller APIs (Swagger Spec)
  // ==========================================

  /**
   * POST /api/notes/{noteId}/collaborators (Matches CollaboratorDTO: email, permission)
   */
  addCollaborator(noteId: number, email: string, permission: string = 'WRITE'): Observable<ApiResponse<any>> {
    const payload = {
      email: email.trim(),
      permission: permission.toUpperCase()
    };

    console.log(`[NoteService] POST /api/notes/${noteId}/collaborators payload:`, payload);

    return this.http.post<ApiResponse<any>>(
      `${this.baseUrl}/${noteId}/collaborators`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/notes/{noteId}/collaborators
   */
  getCollaborators(noteId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.baseUrl}/${noteId}/collaborators`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * DELETE /api/notes/{noteId}/collaborators?email={email}
   */
  removeCollaborator(noteId: number, email: string): Observable<ApiResponse<any>> {
    const cleanEmail = email.trim();
    return this.http.delete<ApiResponse<any>>(
      `${this.baseUrl}/${noteId}/collaborators?email=${encodeURIComponent(cleanEmail)}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(() => {
        return this.http.delete<ApiResponse<any>>(
          `${this.baseUrl}/${noteId}/collaborators/${encodeURIComponent(cleanEmail)}`,
          { headers: this.getHeaders() }
        );
      })
    );
  }

  /**
   * GET /api/notes/shared
   */
  getSharedNotes(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.baseUrl}/shared`,
      { headers: this.getHeaders() }
    );
  }
}