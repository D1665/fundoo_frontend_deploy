import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SignInComponent } from './components/sign-in/sign-in.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { NavbarComponent } from './components/dashboard/navbar/navbar.component';
import { SidebarComponent } from './components/dashboard/sidebar/sidebar.component';
import { CreateNoteComponent } from './components/dashboard/create-note/create-note.component';
import { DisplayNotesComponent } from './components/dashboard/display-notes/display-notes.component';
import { HighlightPipe } from './pipes/highlight.pipe';

// Angular Material Modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NgxMasonryModule } from 'ngx-masonry';


  @NgModule({
    declarations: [
      AppComponent,
      SignInComponent,
      SignUpComponent,
      ForgotPasswordComponent,
      ResetPasswordComponent,
      DashboardComponent,
      NavbarComponent,
      SidebarComponent,
      CreateNoteComponent,
      DisplayNotesComponent,
      HighlightPipe
     
    ],
    imports: [
      BrowserModule,
      FormsModule,
      ReactiveFormsModule,
      HttpClientModule,
      AppRoutingModule,
      BrowserAnimationsModule,
  
      MatToolbarModule,
      MatIconModule,
      MatButtonModule,
      MatMenuModule,
      MatInputModule,
      MatSidenavModule,
      MatListModule,
      MatCardModule,
      MatSnackBarModule,
      NgxMasonryModule
    ],
    providers: [
    provideAnimationsAsync()
  ],
    bootstrap: [AppComponent]
  })
  export class AppModule { }