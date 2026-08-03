import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { NoteService } from '../../../services/notes.service';
import { LabelService } from '../../../services/label.service';
import { Note } from '../../../models/notes';
import { Label } from '../../../models/label';
import { forkJoin, Observable, Subscription, of } from 'rxjs';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-create-note',
  templateUrl: './create-note.component.html',
  styleUrls: ['./create-note.component.css']
})
export class CreateNoteComponent implements OnInit, OnDestroy {

  @ViewChild('descTextarea') descTextarea!: ElementRef<HTMLTextAreaElement>;

  isExpanded = false;
  title = '';
  description = '';
  selectedColor = '#ffffff';
  isPinned = false;
  isArchived = false;

  // New features state
  image: string | null = null;
  collaboratorsList: string[] = [];
  isCollaboratorModalOpen = false;
  newCollaboratorEmail = '';
  ownerEmail = localStorage.getItem('email') || 'dineshsirsiya@gmail.com';
  reminder: string | null = null;
  customReminderTime = '';
  createReminderMenuOpen = false;

  colors = [
    { name: 'Default', color: '#ffffff' },
    { name: 'Red', color: '#f28b82' },
    { name: 'Orange', color: '#fbbc04' },
    { name: 'Yellow', color: '#fff475' },
    { name: 'Green', color: '#ccff90' },
    { name: 'Teal', color: '#a7ffeb' },
    { name: 'Blue', color: '#cbf0f8' },
    { name: 'Dark Blue', color: '#aecbfa' },
    { name: 'Purple', color: '#d7aefb' },
    { name: 'Pink', color: '#fdcfe8' },
    { name: 'Brown', color: '#e6c9a8' },
    { name: 'Gray', color: '#e8eaed' }
  ];

  allLabels: Label[] = [];
  selectedLabels: Label[] = [];
  private labelsSub!: Subscription;

  constructor(
    private noteService: NoteService,
    private labelService: LabelService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.labelsSub = this.labelService.labels$.subscribe(labels => {
      this.allLabels = labels;
    });
    this.labelService.fetchLabels();
  }

  ngOnDestroy(): void {
    if (this.labelsSub) {
      this.labelsSub.unsubscribe();
    }
  }

  openNote(): void {
    this.isExpanded = true;
  }

  closeNote(): void {
    if (this.title.trim() || this.description.trim() || this.image) {
      this.saveNote();
    } else {
      this.resetForm();
    }
  }

  saveNote(): void {
    const noteTitle = this.title.trim();
    const noteDesc = this.description.trim();

    if (!noteTitle && !noteDesc && !this.image) {
      this.resetForm();
      return;
    }

    const tempId = Date.now();
    const color = this.selectedColor;
    const isPinned = this.isPinned;
    const isArchived = this.isArchived;

    // Append image if selected
    let contentWithImg = noteDesc;
    if (this.image) {
      contentWithImg = noteDesc + '\n<!--IMG:' + this.image + '-->';
    }

    const newNoteData: Partial<Note> = {
      title: noteTitle,
      content: contentWithImg || noteTitle || 'Note',
      color: color
    };

    const optimisticNote: Note = {
      id: tempId,
      title: noteTitle,
      content: contentWithImg || noteTitle || 'Note',
      description: noteDesc,
      color: color,
      pinned: isPinned,
      archived: isArchived,
      image: this.image || undefined,
      collaborators: [...this.collaboratorsList],
      trashed: false
    };

    this.noteService.addCreatedNoteToSubject(optimisticNote);

    // Save local copy of collaborators list and reminder so we can refer to it after reset
    const savedCollaborators = [...this.collaboratorsList];
    const savedImage = this.image;
    const savedReminder = this.reminder;
    const savedLabels = [...this.selectedLabels];

    this.resetForm();

    this.noteService.createNote(newNoteData).subscribe({
      next: (response: any) => {
        let createdNote: any = null;
        if (response && response.data) createdNote = response.data;
        else if (response && response.id) createdNote = response;

        const createdId = createdNote ? (createdNote.id || createdNote.noteId) : null;

        if (createdId) {
          const updatedLocalNote: Note = {
            ...optimisticNote,
            ...(createdNote || {}),
            id: createdId
          };

          this.noteService.removeLocalNote(tempId);
          this.noteService.addCreatedNoteToSubject(updatedLocalNote);

          if (savedImage) {
            try {
              localStorage.setItem('note_image_' + createdId, savedImage);
            } catch (err) {
              console.error('Error saving image to localStorage:', err);
            }
          }

          if (isPinned) {
            this.noteService.pinNote(createdId).subscribe();
          }
          if (isArchived) {
            this.noteService.archiveNote(createdId).subscribe();
          }

          const currentView = this.noteService.getCurrentView();
          if (currentView.startsWith('label_')) {
            const labelId = parseInt(currentView.replace('label_', ''), 10);
            this.labelService.addLabelToNote(labelId, createdId).subscribe();
          }

          let tasks: Observable<any>[] = [];
          if (savedReminder) {
            tasks.push(this.noteService.setReminder(createdId, savedReminder));
          }
          if (savedCollaborators.length > 0) {
            savedCollaborators.forEach(email => {
              tasks.push(this.noteService.addCollaborator(createdId, email));
            });
          }
          if (savedLabels.length > 0) {
            savedLabels.forEach(label => {
              if (label.id) {
                tasks.push(this.labelService.addLabelToNote(label.id, createdId));
              }
            });
          }

          if (tasks.length > 0) {
            forkJoin(tasks).subscribe({
              next: () => {
                this.snackbar.success('Note created successfully');
              },
              error: (err) => {
                console.error('Error post-processing note creation:', err);
                this.snackbar.success('Note created successfully');
              }
            });
          } else {
            this.snackbar.success('Note created successfully');
          }
        }
      },
      error: (err) => {
        console.error('[CreateNote] Backend HTTP POST error:', err);
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Authentication Token missing! Please Sign Out and Sign In again.');
        } else {
          alert(`HTTP Error ${err.status || 0}: ${err.error?.message || err.message || 'Cannot connect to backend'}. Please verify backend service status.`);
        }
      }
    });
  }

  selectColor(color: string): void {
    this.selectedColor = color;
  }

  togglePin(event: MouseEvent): void {
    event.stopPropagation();
    this.isPinned = !this.isPinned;
  }

  toggleArchive(event: MouseEvent): void {
    event.stopPropagation();
    this.isArchived = !this.isArchived;
  }

  // Image features
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.image = e.target.result as string;
        // Auto-expand the note box if an image is added
        this.isExpanded = true;
        input.value = '';
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(event: MouseEvent): void {
    event.stopPropagation();
    this.image = null;
  }

  // Collaborator features
  openCollaboratorModal(event: MouseEvent): void {
    event.stopPropagation();
    this.newCollaboratorEmail = '';
    this.isCollaboratorModalOpen = true;
  }

  closeCollaboratorModal(): void {
    this.isCollaboratorModalOpen = false;
    this.newCollaboratorEmail = '';
  }

  addCollaborator(): void {
    const email = this.newCollaboratorEmail.trim().toLowerCase();
    if (!email) return;
    if (!this.collaboratorsList.includes(email)) {
      this.collaboratorsList.push(email);
    }
    this.newCollaboratorEmail = '';
  }

  removeCollaborator(email: string): void {
    this.collaboratorsList = this.collaboratorsList.filter(e => e !== email);
  }

  saveCollaborators(): void {
    this.addCollaborator(); // Add any typed text that hasn't been submitted
    this.closeCollaboratorModal();
  }

  resetForm(): void {
    this.isExpanded = false;
    this.title = '';
    this.description = '';
    this.selectedColor = '#ffffff';
    this.isPinned = false;
    this.isArchived = false;
    this.image = null;
    this.collaboratorsList = [];
    this.newCollaboratorEmail = '';
    this.reminder = null;
    this.customReminderTime = '';
    this.createReminderMenuOpen = false;
    this.selectedLabels = [];
    if (this.descTextarea && this.descTextarea.nativeElement) {
      this.descTextarea.nativeElement.style.height = 'auto';
    }
  }

  toggleLabel(label: Label): void {
    const idx = this.selectedLabels.findIndex(l => l.id === label.id);
    if (idx !== -1) {
      this.selectedLabels.splice(idx, 1);
    } else {
      this.selectedLabels.push(label);
    }
  }

  isLabelSelected(label: Label): boolean {
    return this.selectedLabels.some(l => l.id === label.id);
  }

  discardNote(): void {
    this.resetForm();
  }

  toggleReminderMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.createReminderMenuOpen = !this.createReminderMenuOpen;
  }

  autoGrow(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  formatLocalISO(date: Date): string {
    return date.toISOString().slice(0, 19);
  }

  setReminderToday(): void {
    const today = new Date();
    today.setHours(20, 0, 0, 0); // 8:00 PM
    this.reminder = this.formatLocalISO(today);
  }

  setReminderTomorrow(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // 8:00 AM
    this.reminder = this.formatLocalISO(tomorrow);
  }

  setReminderNextWeek(): void {
    const nextWeek = new Date();
    const day = nextWeek.getDay();
    let distance = (1 - day + 7) % 7 || 7;
    if (distance <= 1) {
      distance += 7;
    }
    nextWeek.setDate(nextWeek.getDate() + distance);
    nextWeek.setHours(8, 0, 0, 0);
    this.reminder = this.formatLocalISO(nextWeek);
  }

  parseLocalDateTimePickerValue(dateTimeStr: string): Date {
    const [datePart, timePart] = dateTimeStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  setCustomReminder(): void {
    if (this.customReminderTime) {
      const localDate = this.parseLocalDateTimePickerValue(this.customReminderTime);
      this.reminder = this.formatLocalISO(localDate);
    }
  }

  removeReminder(event: MouseEvent): void {
    event.stopPropagation();
    this.reminder = null;
    this.customReminderTime = '';
  }

  parseReminderDate(isoString: string | null): Date | null {
    if (!isoString) return null;
    const hasTimezone = isoString.includes('Z') || 
                        (isoString.includes('T') && (isoString.indexOf('+', isoString.indexOf('T')) !== -1 || isoString.lastIndexOf('-') > isoString.indexOf('T')));
    const normalizedString = hasTimezone ? isoString : isoString + 'Z';
    return new Date(normalizedString);
  }

  formatReminder(isoString: string | null): string {
    if (!isoString) return '';
    const date = this.parseReminderDate(isoString)!;
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}