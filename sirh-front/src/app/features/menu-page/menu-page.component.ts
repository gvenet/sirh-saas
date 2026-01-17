import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApplicationService } from '../../core/services/application.service';
import { MenuPage } from '../../core/models/application.model';

@Component({
  selector: 'app-menu-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-page.component.html',
  styleUrl: './menu-page.component.css'
})
export class MenuPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private appService = inject(ApplicationService);

  page: MenuPage | null = null;
  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    const menuItemId = this.route.snapshot.paramMap.get('menuItemId');
    if (menuItemId) {
      this.loadPage(menuItemId);
    } else {
      this.error = 'ID du menu manquant';
      this.loading = false;
    }
  }

  private loadPage(menuItemId: string): void {
    this.appService.getMenuPageByMenuItem(menuItemId).subscribe({
      next: (page) => {
        this.page = page;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors du chargement de la page';
        this.loading = false;
      }
    });
  }
}
