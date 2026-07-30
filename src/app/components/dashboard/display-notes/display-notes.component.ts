import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { NoteService } from '../../../services/notes.service';
import { LabelService } from '../../../services/label.service';
import { Note } from '../../../models/notes';
import { Label } from '../../../models/label';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-display-notes',
  templateUrl: './display-notes.component.html',
  styleUrls: ['./display-notes.component.css']
})
export class DisplayNotesComponent implements OnInit, OnDestroy {
  notes: Note[] = [];
  pinnedNotes: Note[] = [];
  otherNotes: Note[] = [];
  currentView = 'notes';
  searchQuery = '';
  loading = false;

  // Edit Note Modal state
  isEditModalOpen = false;
  selectedNote: Note | null = null;
  editTitle = '';
  editContent = '';
  editColor = '#ffffff';

  // Collaborator Modal state
  isCollaboratorModalOpen = false;
  collaboratorNote: Note | null = null;
  collaboratorsList: string[] = [];
  newCollaboratorEmail = '';
  ownerEmail = 'dineshsirsiya@gmail.com';
  noteCollaboratorsMap: { [noteId: number]: string[] } = {};
  private reminderTimers: Map<number, any> = new Map();

  // Edit Labels Modal state
  isEditLabelsModalOpen = false;
  allLabels: Label[] = [];
  newLabelName = '';
  editingLabelId: number | null = null;

  // Image upload state
  targetImageNote: Note | null = null;

  // Reminders state
  customReminderTimeMap: { [noteId: number]: string } = {};
  editReminder: string | null = null;
  editCustomReminderTime = '';
  activeReminderNoteId: number | null = null;
  editReminderMenuOpen = false;

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

  private notesSub!: Subscription;
  private viewSub!: Subscription;
  private viewModeSub!: Subscription;
  isGridView = true;
  private searchSub!: Subscription;
  private openEditLabelsSub!: Subscription;
  private labelsSub!: Subscription;
  private loadingSub!: Subscription;


  constructor(
    private noteService: NoteService,
    private labelService: LabelService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    const storedEmail = localStorage.getItem('email');
    if (storedEmail) {
      this.ownerEmail = storedEmail;
    }

    this.notesSub = this.noteService.notes$.subscribe((notes) => {
      console.log('Notes loaded in display-notes component:', notes);
      this.notes = notes;
      this.initializeReminderTimeMaps();
      this.filterNotes();
      this.setupReminderTimers(notes);

      // Fetch collaborators for each note
      notes.forEach(note => {
        if (note.id) {
          this.noteService.getCollaborators(note.id).subscribe({
            next: (res: any) => {
              let list: string[] = [];
              if (res && Array.isArray(res.data)) {
                list = res.data.map((item: any) =>
                  typeof item === 'string' ? item : (item.email || item.userName || '')
                ).filter(Boolean);
              } else if (Array.isArray(res)) {
                list = res.map((item: any) =>
                  typeof item === 'string' ? item : (item.email || '')
                ).filter(Boolean);
              }
              this.noteCollaboratorsMap[note.id!] = list;
            },
            error: (err) => console.error('Error fetching collaborators for note ' + note.id, err)
          });
        }
      });
    });

    this.loadingSub = this.noteService.loading$.subscribe((isLoading) => {
      this.loading = isLoading;
    });

    this.viewSub = this.noteService.currentView$.subscribe((view) => {
      this.currentView = view;
      this.filterNotes();
    });

    this.searchSub = this.noteService.searchQuery$.subscribe((query) => {
      this.searchQuery = query;
      this.filterNotes();
    });

    this.openEditLabelsSub = this.noteService.openEditLabelsModal$.subscribe(() => {
      this.openEditLabelsModal();
    });

    this.labelsSub = this.labelService.labels$.subscribe(labels => {
      this.allLabels = labels;
    });

    this.viewModeSub = this.noteService.isGridView$.subscribe((isGrid) => {
      this.isGridView = isGrid;
    });
 
    this.fetchNotes();
    this.labelService.fetchLabels();

    // Auto-sync shared notes between Owner & Collaborators every 5 seconds
   
  }

  ngOnDestroy(): void {
    if (this.notesSub) this.notesSub.unsubscribe();
    if (this.viewSub) this.viewSub.unsubscribe();
    if (this.searchSub) this.searchSub.unsubscribe();
    if (this.openEditLabelsSub) this.openEditLabelsSub.unsubscribe();
    if (this.labelsSub) this.labelsSub.unsubscribe();
    if (this.viewModeSub) this.viewModeSub.unsubscribe();
    if (this.loadingSub) this.loadingSub.unsubscribe();

    // Clear active reminder timers
    this.reminderTimers.forEach(timer => clearTimeout(timer));
    this.reminderTimers.clear();
  }

  fetchNotes(): void {
    this.noteService.fetchNotesFromBackend();
  }

  isSharedNote(note: Note): boolean {
    const currentUser = (localStorage.getItem('email') || this.ownerEmail || '').toLowerCase().trim();
    if (note.ownerEmail && currentUser && note.ownerEmail.toLowerCase().trim() !== currentUser) {
      return true;
    }
    if (note.myPermission) {
      return true;
    }
    return false;
  }

  filterNotes(): void {
    let sourceNotes = this.notes;

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      sourceNotes = sourceNotes.filter(
        n => (n.title && n.title.toLowerCase().includes(q)) ||
             (n.content && n.content.toLowerCase().includes(q)) ||
             (n.description && n.description.toLowerCase().includes(q))
      );
    }

    if (this.currentView.startsWith('label_')) {
      const labelId = parseInt(this.currentView.replace('label_', ''), 10);
      const active = sourceNotes.filter(n => !this.isNoteArchived(n) && !n.trashed);
      this.pinnedNotes = [];
      this.otherNotes = active.filter(n => {
        const labels = this.getNoteLabels(n);
        return labels && labels.some((l: any) => (l.id === labelId || l.labelId === labelId));
      });
    } else if (this.currentView === 'notes') {
      const active = sourceNotes.filter(n => !this.isNoteArchived(n) && !n.trashed);
      this.pinnedNotes = active.filter(n => n.pinned);
      this.otherNotes = active.filter(n => !n.pinned);
    } else if (this.currentView === 'archive') {
      this.pinnedNotes = [];
      this.otherNotes = sourceNotes.filter(n => this.isNoteArchived(n) && !n.trashed);
    } else if (this.currentView === 'trash') {
      this.pinnedNotes = [];
      this.otherNotes = sourceNotes.filter(n => n.trashed);
    } else if (this.currentView === 'reminders') {
      this.pinnedNotes = [];
      this.otherNotes = sourceNotes.filter(n => !!n.reminder && !n.trashed && !this.isNoteArchived(n));
    } else {
      this.pinnedNotes = [];
      this.otherNotes = sourceNotes;
    }
  }

  togglePin(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id) return;

    const updated = { ...note, pinned: !note.pinned };
    this.noteService.updateLocalNote(updated);

    this.noteService.pinNote(note.id, note).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: () => this.noteService.fetchNotesFromBackend()
    });
  }

  toggleArchive(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id) return;

    if (this.isSharedNote(note)) {
      const currentUser = (localStorage.getItem('email') || '').toLowerCase().trim();
      const key = `archive_${currentUser}_${note.id}`;
      const isCurrentlyArchived = localStorage.getItem(key) === 'true';
      if (isCurrentlyArchived) {
        localStorage.setItem(key, 'false');
        this.snackbar.success('Note unarchived');
      } else {
        localStorage.setItem(key, 'true');
        this.snackbar.success('Note archived');
      }
      this.filterNotes();
      return;
    }

    this.noteService.removeLocalNote(note.id);

    this.noteService.archiveNote(note.id, note).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: () => this.noteService.fetchNotesFromBackend()
    });
  }

  trashNote(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id) return;

    this.noteService.removeLocalNote(note.id);

    this.noteService.trashNote(note.id, note).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: () => this.noteService.fetchNotesFromBackend()
    });
  }

  restoreNote(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id) return;

    this.noteService.removeLocalNote(note.id);

    this.noteService.restoreNote(note.id).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: () => this.noteService.fetchNotesFromBackend()
    });
  }

  deletePermanently(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id) return;

    this.noteService.removeLocalNote(note.id);

    this.noteService.deleteNote(note.id).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: (e) => {
        console.error('Error deleting note permanently:', e);
        this.noteService.fetchNotesFromBackend();
      }
    });
  }

  changeColor(note: Note, color: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!note.id) return;

    const updated = { ...note, color };
    this.noteService.updateLocalNote(updated);

    this.noteService.changeColor(note.id, color).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: () => this.noteService.fetchNotesFromBackend()
    });
  }

  // Edit Note Modal
  openEditModal(note: Note): void {
    if (this.currentView === 'trash') return;

    this.selectedNote = note;
    this.editTitle = note.title || '';

    let rawC = note.content || note.description || '';
    if (rawC.includes('<!--IMG:')) {
      const idx = rawC.indexOf('<!--IMG:');
      rawC = rawC.substring(0, idx).trim();
    }

    this.editContent = rawC;
    this.editColor = note.color || '#ffffff';
    this.editReminder = note.reminder || null;
    this.editCustomReminderTime = note.reminder ? this.getLocalISOString(this.parseReminderDate(note.reminder)!) : '';
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.selectedNote = null;
  }

  saveEditedNote(): void {
    if (!this.selectedNote || !this.selectedNote.id) {
      this.closeEditModal();
      return;
    }

    const noteId = this.selectedNote.id;
    let cleanContent = this.editContent.trim();
    if (cleanContent.includes('<!--IMG:')) {
      const idx = cleanContent.indexOf('<!--IMG:');
      cleanContent = cleanContent.substring(0, idx).trim();
    }

    const existingImg = this.getNoteImage(this.selectedNote) || undefined;
    const finalContent = existingImg ? (cleanContent + '\n<!--IMG:' + existingImg + '-->') : cleanContent;

    const updatedData: Partial<Note> = {
      id: noteId,
      title: this.editTitle.trim(),
      content: finalContent,
      description: cleanContent,
      color: this.editColor
    };

    const localUpdated: Note = {
      ...this.selectedNote,
      title: this.editTitle.trim(),
      content: cleanContent,
      description: cleanContent,
      color: this.editColor,
      image: existingImg
    };

    this.noteService.updateLocalNote(localUpdated);
    this.closeEditModal();

    const reminderChanged = this.editReminder !== this.selectedNote.reminder;
    if (reminderChanged) {
      if (this.editReminder) {
        this.noteService.setReminder(noteId, this.editReminder).subscribe({
          next: () => {
            this.snackbar.success('Reminder updated successfully');
            this.noteService.fetchNotesFromBackend();
          },
          error: (err) => {
            console.error('Error setting reminder:', err);
            const errMsg = err.error?.message || 'Reminder time must be in the future';
            this.snackbar.error(errMsg);
            this.noteService.fetchNotesFromBackend();
          }
        });
      } else {
        this.noteService.deleteReminder(noteId).subscribe({
          next: () => {
            this.snackbar.success('Reminder removed');
            this.noteService.fetchNotesFromBackend();
          },
          error: (err) => console.error('Error deleting reminder:', err)
        });
      }
    }

    this.noteService.updateNote(noteId, updatedData).subscribe({
      next: (res: any) => {
        if (res && res.data) {
          const norm = this.noteService.normalizeNote(res.data);
          this.noteService.updateLocalNote(norm);
        }
      },
      error: (err) => {
        console.error('Error updating note in backend:', err);
      }
    });
  }

  // Collaborator Functionality
  openCollaboratorModal(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id) return;

    this.collaboratorNote = note;
    this.isCollaboratorModalOpen = true;
    this.newCollaboratorEmail = '';
    this.loadCollaborators(note.id);
  }

  loadCollaborators(noteId: number): void {
    this.noteService.getCollaborators(noteId).subscribe({
      next: (res: any) => {
        if (res && Array.isArray(res.data)) {
          this.collaboratorsList = res.data.map((item: any) =>
            typeof item === 'string' ? item : (item.email || item.userName || '')
          ).filter(Boolean);
        } else if (Array.isArray(res)) {
          this.collaboratorsList = res.map((item: any) =>
            typeof item === 'string' ? item : (item.email || '')
          ).filter(Boolean);
        } else {
          this.collaboratorsList = [];
        }
      },
      error: (err) => console.error('Error fetching collaborators:', err)
    });
  }

  getNoteOwnerEmail(): string {
    if (this.collaboratorNote && this.collaboratorNote.ownerEmail) {
      return this.collaboratorNote.ownerEmail;
    }
    return this.ownerEmail;
  }

  addCollaborator(): void {
    if (!this.collaboratorNote || !this.collaboratorNote.id || !this.newCollaboratorEmail.trim()) return;

    const email = this.newCollaboratorEmail.trim();
    this.noteService.addCollaborator(this.collaboratorNote.id, email).subscribe({
      next: () => {
        if (!this.collaboratorsList.includes(email)) {
          this.collaboratorsList.push(email);
        }
        this.newCollaboratorEmail = '';
        this.loadCollaborators(this.collaboratorNote!.id!);
      },
      error: (err) => {
        console.error('Error adding collaborator:', err);
        if (!this.collaboratorsList.includes(email)) {
          this.collaboratorsList.push(email);
        }
        this.newCollaboratorEmail = '';
      }
    });
  }

  removeCollaborator(email: string): void {
    if (!this.collaboratorNote || !this.collaboratorNote.id) return;

    this.noteService.removeCollaborator(this.collaboratorNote.id, email).subscribe({
      next: () => {
        this.collaboratorsList = this.collaboratorsList.filter(e => e !== email);
        if (this.collaboratorNote && this.collaboratorNote.id) {
          this.loadCollaborators(this.collaboratorNote.id);
        }
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => {
        console.error('Error removing collaborator:', err);
        this.collaboratorsList = this.collaboratorsList.filter(e => e !== email);
        this.noteService.fetchNotesFromBackend();
      }
    });
  }

  saveCollaborators(): void {
    if (this.newCollaboratorEmail.trim() && this.collaboratorNote && this.collaboratorNote.id) {
      const email = this.newCollaboratorEmail.trim();
      this.noteService.addCollaborator(this.collaboratorNote.id, email).subscribe({
        next: () => {
          this.closeCollaboratorModal();
          this.noteService.fetchNotesFromBackend();
        },
        error: (err) => {
          console.error('Error adding collaborator:', err);
          this.closeCollaboratorModal();
          this.noteService.fetchNotesFromBackend();
        }
      });
    } else {
      this.closeCollaboratorModal();
      this.noteService.fetchNotesFromBackend();
    }
  }

  closeCollaboratorModal(): void {
    this.isCollaboratorModalOpen = false;
    this.collaboratorNote = null;
    this.collaboratorsList = [];
    this.newCollaboratorEmail = '';
  }

  // Edit Labels Modal Methods (Google Keep Style)
  openEditLabelsModal(): void {
    this.isEditLabelsModalOpen = true;
    this.newLabelName = '';
    this.labelService.fetchLabels();
  }

  closeEditLabelsModal(): void {
    this.isEditLabelsModalOpen = false;
    this.newLabelName = '';
    this.labelService.fetchLabels();
    this.noteService.fetchNotesFromBackend();
  }

  createNewLabel(): void {
    if (!this.newLabelName.trim()) return;
    const name = this.newLabelName.trim();
    this.labelService.createLabel(name).subscribe({
      next: () => {
        this.newLabelName = '';
        this.labelService.fetchLabels();
      },
      error: (err) => console.error('Error creating label:', err)
    });
  }

  saveLabelRename(label: Label): void {
    if (!label.id || !label.name.trim()) return;
    this.editingLabelId = null;

    const newName = label.name.trim();
    this.labelService.updateLabel(label.id, newName).subscribe({
      next: () => {
        this.labelService.fetchLabels();
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => {
        console.error('Error renaming label:', err);
        this.labelService.fetchLabels();
      }
    });
  }

  deleteLabel(label: any): void {
    const labelId = label ? (label.id ?? label.labelId ?? label._id) : null;
    if (!labelId) return;

    this.editingLabelId = null;

    // Optimistically remove from local list
    this.allLabels = this.allLabels.filter(l => (l.id ?? (l as any).labelId) !== labelId);

    this.labelService.deleteLabel(labelId).subscribe({
      next: () => {
        this.labelService.fetchLabels();
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => {
        console.error('Error deleting label:', err);
        this.labelService.fetchLabels();
        this.noteService.fetchNotesFromBackend();
      }
    });
  }

  // Label Attachment to Note Methods
  isLabelOnNote(note: Note, label: Label): boolean {
    if (!label.id) return false;
    if (this.isSharedNote(note)) {
      const labels = this.getNoteLabels(note);
      return labels.some((l: any) => (l.id === label.id || l.labelId === label.id));
    }
    if (!note.labels) return false;
    return note.labels.some((l: any) => (l.id === label.id || l.labelId === label.id));
  }

  toggleLabelOnNote(note: Note, label: Label, event: MouseEvent): void {
    event.stopPropagation();
    if (!note.id || !label.id) return;

    if (this.isSharedNote(note)) {
      const currentUser = (localStorage.getItem('email') || '').toLowerCase().trim();
      const key = `labels_${currentUser}_${note.id}`;
      const stored = localStorage.getItem(key);
      let labelIds: number[] = [];
      if (stored) {
        try {
          labelIds = JSON.parse(stored);
        } catch (e) {}
      }

      if (labelIds.includes(label.id)) {
        labelIds = labelIds.filter(id => id !== label.id);
      } else {
        labelIds.push(label.id);
      }

      localStorage.setItem(key, JSON.stringify(labelIds));
      this.filterNotes();
      return;
    }

    if (this.isLabelOnNote(note, label)) {
      this.labelService.removeLabelFromNote(label.id, note.id).subscribe({
        next: () => this.noteService.fetchNotesFromBackend(),
        error: (err) => console.error('Error detaching label:', err)
      });
    } else {
      this.labelService.addLabelToNote(label.id, note.id).subscribe({
        next: () => this.noteService.fetchNotesFromBackend(),
        error: (err) => console.error('Error attaching label:', err)
      });
    }
  }

  removeLabelFromNoteCard(note: Note, label: any, event: MouseEvent): void {
    event.stopPropagation();
    const labelId = label.id || label.labelId;
    if (!note.id || !labelId) return;

    if (this.isSharedNote(note)) {
      const currentUser = (localStorage.getItem('email') || '').toLowerCase().trim();
      const key = `labels_${currentUser}_${note.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          let labelIds: number[] = JSON.parse(stored);
          labelIds = labelIds.filter(id => id !== labelId);
          localStorage.setItem(key, JSON.stringify(labelIds));
        } catch (e) {}
      }
      this.filterNotes();
      return;
    }

    this.labelService.removeLabelFromNote(labelId, note.id).subscribe({
      next: () => this.noteService.fetchNotesFromBackend(),
      error: (err) => console.error('Error removing label chip:', err)
    });
  }

  // Image Uploading & Storage Functionality
  openImageUploader(note: Note, fileInput: HTMLInputElement, event: MouseEvent): void {
    event.stopPropagation();
    this.targetImageNote = note;
    fileInput.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0] && this.targetImageNote && this.targetImageNote.id) {
      const file = input.files[0];
      const reader = new FileReader();
      const noteId = this.targetImageNote.id;
      const targetNote = this.targetImageNote;

      reader.onload = (e: any) => {
        const base64Image = e.target.result as string;
        try {
          localStorage.setItem('note_image_' + noteId, base64Image);
        } catch (err) {
          console.error('Error saving image to localStorage:', err);
        }
        targetNote.image = base64Image;

        const cleanContent = targetNote.content || targetNote.description || '';
        const contentWithImg = cleanContent + '\n<!--IMG:' + base64Image + '-->';

        this.noteService.updateNote(noteId, {
          title: targetNote.title,
          content: contentWithImg,
          color: targetNote.color
        }).subscribe({
          next: () => this.noteService.fetchNotesFromBackend(),
          error: () => this.noteService.fetchNotesFromBackend()
        });

        this.targetImageNote = null;
        input.value = '';
      };

      reader.readAsDataURL(file);
    }
  }

  getNoteImage(note: Note): string | null {
    if (note.image) return note.image;
    if (note.id) {
      return localStorage.getItem('note_image_' + note.id);
    }
    return null;
  }

  removeNoteImage(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    note.image = undefined;
    if (note.id) {
      localStorage.removeItem('note_image_' + note.id);
      const cleanContent = note.content || note.description || '';
      this.noteService.updateNote(note.id, {
        title: note.title,
        content: cleanContent,
        color: note.color
      }).subscribe({
        next: () => this.noteService.fetchNotesFromBackend(),
        error: () => this.noteService.fetchNotesFromBackend()
      });
    }
  }

  // Reminders Feature Helper Methods
  getLocalISOString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  formatLocalISO(date: Date): string {
    return date.toISOString().slice(0, 19);
  }

  initializeReminderTimeMaps(): void {
    const today = new Date();
    today.setHours(20, 0, 0, 0); // Default to 8:00 PM today
    const defaultTime = this.getLocalISOString(today);

    this.notes.forEach(note => {
      if (note.id) {
        if (note.reminder) {
          this.customReminderTimeMap[note.id] = this.getLocalISOString(this.parseReminderDate(note.reminder)!);
        } else if (!this.customReminderTimeMap[note.id]) {
          this.customReminderTimeMap[note.id] = defaultTime;
        }
      }
    });
  }

  toggleReminderMenu(note: Note, event: MouseEvent): void {
    event.stopPropagation();
    if (note.id) {
      this.activeReminderNoteId = this.activeReminderNoteId === note.id ? null : note.id;
    }
  }

  toggleEditReminderMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.editReminderMenuOpen = !this.editReminderMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    this.activeReminderNoteId = null;
    this.editReminderMenuOpen = false;
  }

  setReminderToday(note: Note, event: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!note.id) return;
    const today = new Date();
    today.setHours(20, 0, 0, 0); // 8:00 PM
    const localStr = this.formatLocalISO(today);
    this.activeReminderNoteId = null;
    this.noteService.setReminder(note.id, localStr).subscribe({
      next: () => {
        this.snackbar.success('Reminder set successfully');
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => {
        console.error('Error setting reminder:', err);
        const errMsg = err.error?.message || 'Reminder time must be in the future';
        this.snackbar.error(errMsg);
      }
    });
  }

  setReminderTomorrow(note: Note, event: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!note.id) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // 8:00 AM
    const localStr = this.formatLocalISO(tomorrow);
    this.activeReminderNoteId = null;
    this.noteService.setReminder(note.id, localStr).subscribe({
      next: () => {
        this.snackbar.success('Reminder set successfully');
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => {
        console.error('Error setting reminder:', err);
        const errMsg = err.error?.message || 'Reminder time must be in the future';
        this.snackbar.error(errMsg);
      }
    });
  }

  setReminderNextWeek(note: Note, event: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!note.id) return;
    const nextWeek = new Date();
    const day = nextWeek.getDay();
    let distance = (1 - day + 7) % 7 || 7;
    if (distance <= 1) {
      distance += 7;
    }
    nextWeek.setDate(nextWeek.getDate() + distance);
    nextWeek.setHours(8, 0, 0, 0);
    const localStr = this.formatLocalISO(nextWeek);
    this.activeReminderNoteId = null;
    this.noteService.setReminder(note.id, localStr).subscribe({
      next: () => {
        this.snackbar.success('Reminder set successfully');
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => {
        console.error('Error setting reminder:', err);
        const errMsg = err.error?.message || 'Reminder time must be in the future';
        this.snackbar.error(errMsg);
      }
    });
  }

  parseLocalDateTimePickerValue(dateTimeStr: string): Date {
    const [datePart, timePart] = dateTimeStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  setCustomReminder(note: Note, event: Event): void {
    if (event) event.stopPropagation();
    if (!note.id) return;
    const time = this.customReminderTimeMap[note.id];
    if (time) {
      const localDate = this.parseLocalDateTimePickerValue(time);
      const localStr = this.formatLocalISO(localDate);
      this.activeReminderNoteId = null;
      this.noteService.setReminder(note.id, localStr).subscribe({
        next: () => {
          this.snackbar.success('Reminder set successfully');
          this.noteService.fetchNotesFromBackend();
        },
        error: (err) => {
          console.error('Error setting custom reminder:', err);
          const errMsg = err.error?.message || 'Reminder time must be in the future';
          this.snackbar.error(errMsg);
        }
      });
    }
  }

  removeReminderFromNote(note: Note, event: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!note.id) return;
    this.noteService.deleteReminder(note.id).subscribe({
      next: () => {
        this.snackbar.success('Reminder removed');
        this.noteService.fetchNotesFromBackend();
      },
      error: (err) => console.error('Error deleting reminder:', err)
    });
  }

  parseReminderDate(isoString: string | null): Date | null {
    if (!isoString) return null;
    const normalizedString = (isoString.includes('Z') || isoString.includes('+') || isoString.includes('-')) 
                             ? isoString 
                             : isoString + 'Z';
    return new Date(normalizedString);
  }

  formatReminder(isoString: string | null): string {
    if (!isoString) return '';
    const date = this.parseReminderDate(isoString)!;
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // Edit Modal Reminders Helper Methods
  setReminderTodayEdit(): void {
    const today = new Date();
    today.setHours(20, 0, 0, 0); // 8:00 PM
    this.editReminder = this.formatLocalISO(today);
    this.editReminderMenuOpen = false;
  }

  setReminderTomorrowEdit(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // 8:00 AM
    this.editReminder = this.formatLocalISO(tomorrow);
    this.editReminderMenuOpen = false;
  }

  setReminderNextWeekEdit(): void {
    const nextWeek = new Date();
    const day = nextWeek.getDay();
    let distance = (1 - day + 7) % 7 || 7;
    if (distance <= 1) {
      distance += 7;
    }
    nextWeek.setDate(nextWeek.getDate() + distance);
    nextWeek.setHours(8, 0, 0, 0);
    this.editReminder = this.formatLocalISO(nextWeek);
    this.editReminderMenuOpen = false;
  }

  setCustomReminderEdit(): void {
    if (this.editCustomReminderTime) {
      const localDate = this.parseLocalDateTimePickerValue(this.editCustomReminderTime);
      this.editReminder = this.formatLocalISO(localDate);
      this.editReminderMenuOpen = false;
    }
  }

  removeReminderFromEdit(event: MouseEvent): void {
    if (event) event.stopPropagation();
    this.editReminder = null;
    this.editCustomReminderTime = '';
  }

  getNoteCollaborators(note: Note): string[] {
    if (!note || !note.id) return [];
    const currentUser = (localStorage.getItem('email') || '').toLowerCase().trim();
    let list = this.noteCollaboratorsMap[note.id] || [];
    
    // If it's a shared note, also add the owner's email to the preview list
    if (this.isSharedNote(note) && note.ownerEmail) {
      const owner = note.ownerEmail.trim().toLowerCase();
      if (!list.map(e => e.toLowerCase().trim()).includes(owner)) {
        list = [note.ownerEmail, ...list];
      }
    }
    return list.filter(email => email.toLowerCase().trim() !== currentUser);
  }

  private setupReminderTimers(notes: Note[]): void {
    // Clear timers for notes that no longer have reminders or are trashed
    this.reminderTimers.forEach((timer, noteId) => {
      const note = notes.find(n => n.id === noteId);
      if (!note || !note.reminder || note.trashed) {
        clearTimeout(timer);
        this.reminderTimers.delete(noteId);
      }
    });

    // Setup timers for future reminders
    notes.forEach(note => {
      if (note.id !== undefined && note.reminder && !note.trashed) {
        const reminderTime = this.parseReminderDate(note.reminder)!.getTime();
        const now = new Date().getTime();
        const delay = reminderTime - now;

        if (delay > 0) {
          // Re-create timer if it already exists to keep it updated with the correct time
          if (this.reminderTimers.has(note.id)) {
            clearTimeout(this.reminderTimers.get(note.id));
          }

          const timer = setTimeout(() => {
            this.triggerReminder(note);
          }, delay);

          this.reminderTimers.set(note.id, timer);
        }
      }
    });
  }

  private triggerReminder(note: Note): void {
    if (note.id !== undefined) {
      this.reminderTimers.delete(note.id);
    }

    // Show professional popup notification using SnackbarService
    this.snackbar.success(`Reminder: "${note.title || 'Untitled Note'}" is due!`);

    // Auto-remove reminder tag locally in UI
    note.reminder = null;

    // Notify other observers and trigger UI lists filter refresh
    this.noteService.updateLocalNote(note);
    this.filterNotes();
  }

  isNoteArchived(note: Note): boolean {
    if (this.isSharedNote(note)) {
      const currentUser = (localStorage.getItem('email') || '').toLowerCase().trim();
      return localStorage.getItem(`archive_${currentUser}_${note.id}`) === 'true';
    }
    return note.archived;
  }

  getNoteLabels(note: Note): any[] {
    if (!note) return [];
    if (this.isSharedNote(note)) {
      const currentUser = (localStorage.getItem('email') || '').toLowerCase().trim();
      const stored = localStorage.getItem(`labels_${currentUser}_${note.id}`);
      if (stored) {
        try {
          const labelIds: number[] = JSON.parse(stored);
          return this.allLabels.filter(lbl => lbl.id !== undefined && labelIds.includes(lbl.id));
        } catch (e) {
          console.error('Error parsing stored labels:', e);
        }
      }
      return [];
    }
    return note.labels || [];
  }
}
