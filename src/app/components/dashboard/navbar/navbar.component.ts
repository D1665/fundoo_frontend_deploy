import { Component, OnInit, HostListener, ElementRef, Output, EventEmitter, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NoteService } from '../../../services/notes.service';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();

  userName: string = 'Dinesh Sirsiya';
  userEmail: string = 'dineshsirsiya@gmail.com';
  avatarInitial: string = 'D';
  isProfileMenuOpen: boolean = false;
  searchQuery: string = '';
  isGridView: boolean = true;
  isRefreshing: boolean = false;

  private viewModeSub!: Subscription;

  constructor(
    private router: Router,
    private eRef: ElementRef,
    private noteService: NoteService,
    private snackbar: SnackbarService
  ) {}

  onMenuClick(): void {
    this.toggleSidebar.emit();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.noteService.setSearchQuery(query);
  }

  onRefresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    
    const startTime = Date.now();
    this.noteService.fetchNotesFromBackend();

    // Subscribe to loading$ to detect completion and enforce minimum 600ms duration
    const sub = this.noteService.loading$.subscribe((loadingState) => {
      if (!loadingState) {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 600 - elapsed);
        setTimeout(() => {
          this.isRefreshing = false;
          sub.unsubscribe();
        }, delay);
      }
    });
  }

  ngOnInit(): void {
    this.loadUserData();
    this.viewModeSub = this.noteService.isGridView$.subscribe((isGrid) => {
      this.isGridView = isGrid;
    });
  }

  ngOnDestroy(): void {
    if (this.viewModeSub) {
      this.viewModeSub.unsubscribe();
    }
  }

  toggleView(): void {
    this.noteService.toggleView();
  }

  loadUserData(): void {
    const token = localStorage.getItem('token');
    const storedEmail = localStorage.getItem('email');

    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1];
          const payloadJson = atob(payloadBase64);
          const payload = JSON.parse(payloadJson);

          const email = payload.email || payload.sub || payload.unique_name || storedEmail || '';
          const firstName = payload.firstName || payload.given_name || '';
          const lastName = payload.lastName || payload.family_name || '';

          if (email) {
            this.userEmail = email;
            const namePart = email.split('@')[0];
            const formattedEmailName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

            this.userName = (firstName || lastName)
              ? `${firstName} ${lastName}`.trim()
              : formattedEmailName;

            this.avatarInitial = (firstName
              ? firstName[0]
              : namePart[0] || 'U').toUpperCase();
          }
        } else {
          this.fallbackToStoredEmail(storedEmail);
        }
      } catch (e) {
        console.error('Error decoding token:', e);
        this.fallbackToStoredEmail(storedEmail);
      }
    } else {
      this.fallbackToStoredEmail(storedEmail);
    }
  }

  private fallbackToStoredEmail(storedEmail: string | null): void {
    if (storedEmail) {
      this.userEmail = storedEmail;
      const namePart = storedEmail.split('@')[0];
      this.userName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      this.avatarInitial = namePart[0].toUpperCase();
    } else {
      this.userEmail = 'dineshsirsiya@gmail.com';
      this.userName = 'Dinesh Sirsiya';
      this.avatarInitial = 'D';
    }
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isProfileMenuOpen = false;
    }
  }

  addAccount(): void {
    this.isProfileMenuOpen = false;
    this.router.navigate(['/signup']);
  }

  signOut(): void {
    this.isProfileMenuOpen = false;
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    this.snackbar.success('Signed Out Successfully');
    this.router.navigate(['/signin']);
  }
}