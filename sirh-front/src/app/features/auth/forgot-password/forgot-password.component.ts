import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set(null);
      this.successMessage.set(null);

      this.http.post<{ message: string }>('http://localhost:3000/auth/forgot-password', this.forgotPasswordForm.value)
        .subscribe({
          next: (response) => {
            this.isLoading.set(false);
            this.successMessage.set(response.message);
            this.forgotPasswordForm.reset();
          },
          error: (error) => {
            this.isLoading.set(false);
            this.errorMessage.set(
              error.error?.message || 'Une erreur est survenue. Veuillez réessayer.'
            );
          }
        });
    }
  }

  get email() {
    return this.forgotPasswordForm.get('email');
  }
}
