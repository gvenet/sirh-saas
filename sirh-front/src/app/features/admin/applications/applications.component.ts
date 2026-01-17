import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApplicationService } from '../../../core/services/application.service';
import { Application, MenuItem, CreateApplicationDto, CreateMenuItemDto } from '../../../core/models/application.model';
import { AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { GeneratorService } from '../../../generator/services/generator';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminNavbarComponent, IconPickerComponent],
  templateUrl: './applications.component.html',
  styleUrl: './applications.component.css'
})
export class ApplicationsComponent implements OnInit {
  applications: Application[] = [];
  entities: { name: string }[] = [];
  loading = true;
  error = '';

  // Modal states
  showAppModal = false;
  showMenuModal = false;
  editingApp: Application | null = null;
  editingMenu: MenuItem | null = null;
  selectedAppForMenu: Application | null = null;

  // Form data
  appForm: CreateApplicationDto = { name: '', icon: '', order: 0, active: true };
  menuForm: CreateMenuItemDto = { label: '', entityName: '', route: '', icon: '', order: 0, active: true, applicationId: '', parentId: '' };

  constructor(
    private appService: ApplicationService,
    private generatorService: GeneratorService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.appService.getApplications().subscribe({
      next: (apps) => {
        this.applications = apps;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des applications';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });

    this.generatorService.listEntities().subscribe({
      next: (entities) => this.entities = entities,
      error: () => {}
    });
  }

  // Application CRUD
  openAppModal(app?: Application): void {
    this.editingApp = app || null;
    this.appForm = app
      ? { name: app.name, icon: app.icon, order: app.order, active: app.active }
      : { name: '', icon: '', order: 0, active: true };
    this.showAppModal = true;
  }

  closeAppModal(): void {
    this.showAppModal = false;
    this.editingApp = null;
  }

  saveApp(): void {
    if (!this.appForm.name.trim()) return;

    if (this.editingApp) {
      this.appService.updateApplication(this.editingApp.id, this.appForm).subscribe({
        next: () => {
          this.loadData();
          this.closeAppModal();
        },
        error: () => this.error = 'Erreur lors de la mise à jour'
      });
    } else {
      this.appService.createApplication(this.appForm).subscribe({
        next: () => {
          this.loadData();
          this.closeAppModal();
        },
        error: () => this.error = 'Erreur lors de la création'
      });
    }
  }

  deleteApp(app: Application): void {
    if (!confirm(`Supprimer l'application "${app.name}" ?`)) return;

    this.appService.deleteApplication(app.id).subscribe({
      next: () => this.loadData(),
      error: () => this.error = 'Erreur lors de la suppression'
    });
  }

  // Menu CRUD
  openMenuModal(app: Application, menu?: MenuItem, parentId?: string): void {
    this.selectedAppForMenu = app;
    this.editingMenu = menu || null;
    this.menuForm = menu
      ? { label: menu.label, entityName: menu.entityName, route: menu.route, icon: menu.icon, order: menu.order, active: menu.active, applicationId: app.id, parentId: menu.parentId || '' }
      : { label: '', entityName: '', route: '', icon: '', order: 0, active: true, applicationId: app.id, parentId: parentId || '' };
    this.showMenuModal = true;
  }

  // Get parent menu items (now backend returns only parents with children nested)
  getParentMenuItems(app: Application): MenuItem[] {
    return app.menuItems || [];
  }

  // Get submenu items for a parent (now use nested children)
  getSubMenuItems(menu: MenuItem): MenuItem[] {
    return menu.children || [];
  }

  // Get label for parent menu
  getParentLabel(parentId: string, app: Application): string {
    const parent = (app.menuItems || []).find(item => String(item.id) === String(parentId));
    return parent?.label || '';
  }

  closeMenuModal(): void {
    this.showMenuModal = false;
    this.editingMenu = null;
    this.selectedAppForMenu = null;
  }

  saveMenu(): void {
    if (!this.menuForm.label.trim()) return;

    if (this.editingMenu) {
      this.appService.updateMenuItem(this.editingMenu.id, this.menuForm).subscribe({
        next: () => {
          this.loadData();
          this.closeMenuModal();
        },
        error: () => this.error = 'Erreur lors de la mise à jour'
      });
    } else {
      this.appService.createMenuItem(this.menuForm).subscribe({
        next: () => {
          this.loadData();
          this.closeMenuModal();
        },
        error: () => this.error = 'Erreur lors de la création'
      });
    }
  }

  deleteMenu(menu: MenuItem): void {
    if (!confirm(`Supprimer le menu "${menu.label}" ?`)) return;

    this.appService.deleteMenuItem(menu.id).subscribe({
      next: () => this.loadData(),
      error: () => this.error = 'Erreur lors de la suppression'
    });
  }
}
