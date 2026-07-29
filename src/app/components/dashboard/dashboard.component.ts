import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NoteService } from '../../services/notes.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = window.innerWidth < 768;
  currentView = 'notes';

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isSidebarCollapsed = window.innerWidth < 768;
  }

  private viewSub!: Subscription;
  private routerSub!: Subscription;

  constructor(
    private router: Router,
    private noteService: NoteService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.viewSub = this.noteService.currentView$.subscribe(view => {
      this.currentView = view;
    });

    this.syncViewFromUrl();

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.syncViewFromUrl();
    });
  }

  ngOnDestroy(): void {
    if (this.viewSub) this.viewSub.unsubscribe();
    if (this.routerSub) this.routerSub.unsubscribe();
  }

  private syncViewFromUrl(): void {
    const url = this.router.url;
    const current = this.noteService.getCurrentView();
    if (url.includes('/dashboard/archive')) {
      this.noteService.setView('archive');
    } else if (url.includes('/dashboard/trash')) {
      this.noteService.setView('trash');
    } else if (url.includes('/dashboard/reminders')) {
      this.noteService.setView('reminders');
    } else if (!current.startsWith('label_')) {
      this.noteService.setView('notes');
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout(): void {
    localStorage.removeItem('token');
    this.snackbar.success('Signed Out Successfully');
    this.router.navigate(['/signin']);
  }
}