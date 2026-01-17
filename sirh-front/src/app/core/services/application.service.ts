import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Application, MenuItem, MenuPage, CreateApplicationDto, CreateMenuItemDto } from '../models/application.model';

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/applications';

  // Application par défaut "Accueil" (côté frontend uniquement)
  private readonly defaultApp: Application = {
    id: 'default',
    name: 'Accueil',
    icon: 'home',
    order: -1,
    active: true,
    menuItems: [
      { id: 'default-dashboard', label: 'Dashboard', route: '/dashboard', order: 0, active: true, applicationId: 'default' }
    ]
  };

  private readonly STORAGE_KEY = 'selectedApplicationId';

  applications = signal<Application[]>([this.defaultApp]);
  selectedApplication = signal<Application>(this.defaultApp);
  menuItems = signal<MenuItem[]>(this.defaultApp.menuItems || []);

  // Charger les applications depuis l'API
  loadApplicationsWithMenus(): Observable<Application[]> {
    return this.http.get<Application[]>(this.apiUrl).pipe(
      tap(apps => {
        // Ajouter l'app par défaut au début
        const allApps = [this.defaultApp, ...apps.sort((a, b) => a.order - b.order)];
        this.applications.set(allApps);

        // Restaurer l'application sélectionnée depuis le localStorage
        const savedAppId = localStorage.getItem(this.STORAGE_KEY);
        if (savedAppId) {
          // Compare as strings to handle numeric IDs from API
          const savedApp = allApps.find(a => String(a.id) === savedAppId);
          if (savedApp) {
            this.selectApplication(savedApp);
          }
        }
      })
    );
  }

  // Sélectionner une application et mettre à jour les menus
  selectApplication(app: Application | null): void {
    const selectedApp = app || this.defaultApp;
    this.selectedApplication.set(selectedApp);

    // Sauvegarder dans le localStorage (as string for consistency)
    localStorage.setItem(this.STORAGE_KEY, String(selectedApp.id));

    if (selectedApp?.menuItems) {
      // Backend now returns only parent menus with children preloaded
      // Just filter active items and their active children
      const activeMenus = selectedApp.menuItems
        .filter(m => m.active)
        .sort((a, b) => a.order - b.order)
        .map(menu => ({
          ...menu,
          children: (menu.children || [])
            .filter(c => c.active)
            .sort((a, b) => a.order - b.order)
        }));

      this.menuItems.set(activeMenus);
    } else {
      this.menuItems.set([]);
    }
  }

  // Charger uniquement les applications depuis l'API (pour admin)
  getApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(this.apiUrl);
  }

  // CRUD Applications
  getApplication(id: string): Observable<Application> {
    return this.http.get<Application>(`${this.apiUrl}/${id}`);
  }

  createApplication(data: CreateApplicationDto): Observable<Application> {
    return this.http.post<Application>(this.apiUrl, data);
  }

  updateApplication(id: string, data: Partial<Application>): Observable<Application> {
    return this.http.put<Application>(`${this.apiUrl}/${id}`, data);
  }

  deleteApplication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // CRUD Menu Items
  createMenuItem(data: CreateMenuItemDto): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu-items`, data);
  }

  updateMenuItem(id: string, data: Partial<MenuItem>): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/menu-items/${id}`, data);
  }

  deleteMenuItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/menu-items/${id}`);
  }

  // Menu Pages
  getMenuPage(id: string): Observable<MenuPage> {
    return this.http.get<MenuPage>(`${this.apiUrl}/pages/${id}`);
  }

  getMenuPageByMenuItem(menuItemId: string): Observable<MenuPage> {
    return this.http.get<MenuPage>(`${this.apiUrl}/menu-items/${menuItemId}/page`);
  }

  updateMenuPage(id: string, data: Partial<MenuPage>): Observable<MenuPage> {
    return this.http.put<MenuPage>(`${this.apiUrl}/pages/${id}`, data);
  }
}
