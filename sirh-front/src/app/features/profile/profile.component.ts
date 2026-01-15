import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  showPasswordForm = signal(false);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  togglePasswordForm(): void {
    this.showPasswordForm.update(v => !v);
    this.resetForm();
  }

  resetForm(): void {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  changePassword(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage.set('Tous les champs sont requis');
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage.set('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Les mots de passe ne correspondent pas');
      return;
    }

    this.isLoading.set(true);

    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (response) => {
        this.successMessage.set(response.message);
        this.isLoading.set(false);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        setTimeout(() => {
          this.showPasswordForm.set(false);
          this.successMessage.set('');
        }, 2000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Une erreur est survenue');
        this.isLoading.set(false);
      }
    });
  }
}
