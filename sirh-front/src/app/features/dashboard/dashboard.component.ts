import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApplicationService } from '../../core/services/application.service';
import { Application } from '../../core/models/application.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  dropdownOpen = false;

  constructor(
    public authService: AuthService,
    public appService: ApplicationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.appService.loadApplicationsWithMenus().subscribe();
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectApplication(app: Application): void {
    this.appService.selectApplication(app);
    this.dropdownOpen = false;
  }

  clearApplication(): void {
    this.appService.selectApplication(null);
    this.dropdownOpen = false;
  }

  navigateToMenuItem(route: string | undefined, entityName: string | undefined, pageId: string | undefined): void {
    if (route) {
      // Direct route navigation
      this.router.navigate([route]);
    } else if (pageId) {
      // Navigate to dynamic page
      this.router.navigate(['/page', pageId]);
    } else if (entityName) {
      // Legacy: navigate to entity data
      this.router.navigate(['/data', entityName.toLowerCase()]);
    }
  }

  isActiveRoute(route: string | undefined): boolean {
    return route ? this.router.url === route : false;
  }

  logout(): void {
    this.authService.logout();
  }
}
