import { Component, Input, HostBinding, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NoteService } from '../../../services/notes.service';
import { LabelService } from '../../../services/label.service';
import { Label } from '../../../models/label';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isCollapsed: boolean = false;
  isHovered: boolean = false;
  activeView: string = 'notes';
  labels: Label[] = [];

  private viewSub!: Subscription;
  private labelSub!: Subscription;

  constructor(
    private noteService: NoteService,
    private labelService: LabelService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.viewSub = this.noteService.currentView$.subscribe(view => {
      this.activeView = view;
    });

    this.labelSub = this.labelService.labels$.subscribe(labels => {
      this.labels = labels;
    });

    this.labelService.fetchLabels();
  }

  ngOnDestroy(): void {
    if (this.viewSub) this.viewSub.unsubscribe();
    if (this.labelSub) this.labelSub.unsubscribe();
  }

  selectView(viewName: string): void {
    if (viewName === 'edit-labels') {
      this.noteService.openEditLabelsModal();
      return;
    }

    if (viewName === 'notes') {
      this.router.navigate(['/dashboard/home']);
      this.noteService.setView('notes');
    } else if (viewName === 'reminders') {
      this.router.navigate(['/dashboard/reminders']);
      this.noteService.setView('reminders');
    } else if (viewName === 'archive') {
      this.router.navigate(['/dashboard/archive']);
      this.noteService.setView('archive');
    } else if (viewName === 'trash') {
      this.router.navigate(['/dashboard/trash']);
      this.noteService.setView('trash');
    } else {
      this.noteService.setView(viewName);
    }
  }

  selectLabel(label: Label): void {
    if (label.id) {
      this.router.navigate(['/dashboard/home']);
      this.noteService.setView(`label_${label.id}`);
    }
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    if (this.isCollapsed) {
      this.isHovered = true;
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.isHovered = false;
  }

  get isExpanded(): boolean {
    return !this.isCollapsed || this.isHovered;
  }

  @HostBinding('class.collapsed') get collapsedClass() {
    return !this.isExpanded;
  }

  @HostBinding('class.hover-expanded') get hoverExpandedClass() {
    return this.isCollapsed && this.isHovered;
  }
}