import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ApplicationService } from '../../core/services/application.service';
import { EntityPageService } from '../../generator/services/entity-page.service';
import { Application, MenuItem, MenuPage } from '../../core/models/application.model';
import { EntityPage, PageField, PageType, FieldDisplayType } from '../../generator/models/entity-page.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  dropdownOpen = false;

  // Initial loading state to prevent flash
  initializing = signal(true);

  // Current view state
  currentView = signal<'dashboard' | 'menu-page' | 'entity-list'>('dashboard');
  currentMenuPage = signal<MenuPage | null>(null);
  loadingPage = signal(false);
  pageError = signal<string | null>(null);

  // Entity list state
  currentEntityPage = signal<EntityPage | null>(null);
  entityListData = signal<Record<string, unknown>[]>([]);
  currentEntityName = signal<string | null>(null);

  private apiBaseUrl = 'http://localhost:3000';

  constructor(
    public authService: AuthService,
    public appService: ApplicationService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private entityPageService: EntityPageService
  ) {}

  ngOnInit(): void {
    // Load applications first, then check query params
    this.appService.loadApplicationsWithMenus().subscribe({
      next: () => {
        // Check for entity query param to load entity list directly
        const entityName = this.route.snapshot.queryParams['entity'];
        if (entityName) {
          this.loadEntityList(entityName);
        } else {
          this.initializing.set(false);
        }
      },
      error: () => {
        this.initializing.set(false);
      }
    });
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectApplication(app: Application): void {
    this.appService.selectApplication(app);
    this.dropdownOpen = false;
    // Reset to dashboard view when changing application
    this.currentView.set('dashboard');
    this.currentMenuPage.set(null);
  }

  clearApplication(): void {
    this.appService.selectApplication(null);
    this.dropdownOpen = false;
  }

  navigateToMenuItem(route: string | undefined, entityName: string | undefined, pageId: string | undefined, menuItem?: MenuItem): void {
    if (route === '/dashboard') {
      // Show dashboard view and clear query params
      this.currentView.set('dashboard');
      this.currentMenuPage.set(null);
      this.currentEntityPage.set(null);
      this.router.navigate(['/dashboard'], { queryParams: {} });
      return;
    }

    if (route) {
      // Direct route navigation
      this.router.navigate([route]);
    } else if (entityName) {
      // Entity-linked menu: load entity list page and update URL
      this.router.navigate(['/dashboard'], { queryParams: { entity: entityName } });
      this.loadEntityList(entityName, menuItem);
    } else if (pageId) {
      // Navigate to dynamic page (EntityPage)
      this.router.navigate(['/page', pageId]);
    } else if (menuItem?.id && menuItem.id !== 'default-dashboard') {
      // Load menu page inline
      this.loadMenuPage(menuItem.id);
    }
  }

  private loadMenuPage(menuItemId: string): void {
    this.loadingPage.set(true);
    this.pageError.set(null);

    this.appService.getMenuPageByMenuItem(menuItemId).subscribe({
      next: (page) => {
        this.currentMenuPage.set(page);
        this.currentView.set('menu-page');
        this.loadingPage.set(false);
      },
      error: (err) => {
        this.pageError.set(err.error?.message || 'Erreur lors du chargement de la page');
        this.loadingPage.set(false);
      }
    });
  }

  showDashboard(): void {
    this.currentView.set('dashboard');
    this.currentMenuPage.set(null);
    this.currentEntityPage.set(null);
    this.router.navigate(['/dashboard'], { queryParams: {} });
    this.entityListData.set([]);
  }

  private loadEntityList(entityName: string, menuItem?: MenuItem): void {
    this.loadingPage.set(true);
    this.pageError.set(null);
    this.currentEntityName.set(entityName);

    // First, try to get the list page for this entity
    this.entityPageService.getByEntity(entityName).subscribe({
      next: (pages) => {
        const listPage = pages.find(p => p.pageType === PageType.LIST && p.isDefault)
          || pages.find(p => p.pageType === PageType.LIST);

        if (listPage) {
          this.currentEntityPage.set(listPage);
        } else {
          // No page configured, we'll display a basic table
          this.currentEntityPage.set(null);
        }

        // Load entity data
        this.loadEntityData(entityName, menuItem);
      },
      error: () => {
        // No page found, load data anyway
        this.currentEntityPage.set(null);
        this.loadEntityData(entityName, menuItem);
      }
    });
  }

  private loadEntityData(entityName: string, menuItem?: MenuItem): void {
    const endpoint = `${this.apiBaseUrl}/${entityName.toLowerCase()}`;

    this.http.get<Record<string, unknown>[]>(endpoint).subscribe({
      next: (data) => {
        this.entityListData.set(data);
        this.currentView.set('entity-list');
        this.loadingPage.set(false);
        this.initializing.set(false);
      },
      error: (err) => {
        this.pageError.set(err.error?.message || `Erreur lors du chargement des données de ${entityName}`);
        this.loadingPage.set(false);
        this.initializing.set(false);
      }
    });
  }

  getEntityListColumns(): string[] {
    const page = this.currentEntityPage();
    if (page && page.fields.length > 0) {
      return page.fields
        .filter(f => f.visible !== false && f.displayType !== FieldDisplayType.HIDDEN)
        .sort((a, b) => a.order - b.order)
        .map(f => f.fieldName);
    }

    // Default columns from first data item
    const data = this.entityListData();
    if (data.length > 0) {
      return Object.keys(data[0]).filter(key =>
        key !== 'createdAt' && key !== 'updatedAt' && !key.endsWith('Id')
      ).slice(0, 5);
    }
    return [];
  }

  getColumnLabel(fieldName: string): string {
    const page = this.currentEntityPage();
    if (page) {
      const field = page.fields.find(f => f.fieldName === fieldName);
      if (field?.label) return field.label;
    }
    // Format field name to label
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  getFieldDisplayValue(item: Record<string, unknown>, fieldName: string): string {
    const value = item[fieldName];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (value instanceof Date) return new Date(value).toLocaleDateString('fr-FR');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  viewEntityItem(item: Record<string, unknown>): void {
    const entityName = this.currentEntityName();
    const page = this.currentEntityPage();
    if (entityName && item['id']) {
      if (page) {
        // Use the configured page
        this.router.navigate(['/page', page.id, item['id']]);
      } else {
        // Navigate to a generic view
        this.router.navigate(['/entity', entityName.toLowerCase(), item['id']]);
      }
    }
  }

  // Add button configuration
  isAddButtonEnabled(): boolean {
    const page = this.currentEntityPage();
    return page?.config?.['addButtonEnabled'] === true;
  }

  getAddButtonLabel(): string {
    const page = this.currentEntityPage();
    return page?.config?.['addButtonLabel'] || 'Nouveau';
  }

  createNewEntity(): void {
    const entityName = this.currentEntityName();
    if (!entityName) return;

    // Find the EDIT page for this entity
    this.entityPageService.getByEntity(entityName).subscribe({
      next: (pages) => {
        const editPage = pages.find(p => p.pageType === PageType.EDIT && p.isDefault)
          || pages.find(p => p.pageType === PageType.EDIT);

        if (editPage) {
          // Navigate to the edit page without entityId (new entity mode)
          this.router.navigate(['/page', editPage.id]);
        } else {
          console.error(`No EDIT page found for entity ${entityName}`);
        }
      },
      error: (err) => {
        console.error('Error loading entity pages:', err);
      }
    });
  }

  isActiveRoute(route: string | undefined, menuItemId?: string | number, entityName?: string): boolean {
    if (route === '/dashboard') {
      return this.currentView() === 'dashboard';
    }
    // Check for entity-list view
    if (entityName && this.currentView() === 'entity-list') {
      return this.currentEntityName() === entityName;
    }
    if (menuItemId && this.currentView() === 'menu-page' && this.currentMenuPage()) {
      const currentId = this.currentMenuPage()?.menuItemId;
      return String(currentId) === String(menuItemId);
    }
    return false;
  }

  logout(): void {
    this.authService.logout();
  }
}
