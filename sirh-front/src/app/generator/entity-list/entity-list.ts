import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GeneratorService } from '../services/generator';
import { EntityInfo } from '../models/field.model';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-entity-list',
  imports: [CommonModule, RouterLink, AdminNavbarComponent],
  templateUrl: './entity-list.html',
  styleUrl: './entity-list.css',
  standalone: true,
})
export class EntityListComponent implements OnInit {
  entities: EntityInfo[] = [];
  loading = true;
  error: string | null = null;
  deleting: string | null = null; // nom de l'entité en cours de suppression

  constructor(
    private generatorService: GeneratorService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEntities();
  }

  loadEntities(): void {
    console.log('loadEntities called');
    this.loading = true;
    this.error = null;

    this.generatorService.listEntities().subscribe({
      next: (entities) => {
        console.log('Entities received:', entities);
        console.log('Entities count:', entities.length);
        this.entities = entities;
        this.loading = false;
        console.log('Component state - loading:', this.loading, 'entities:', this.entities);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading entities:', error);
        this.error = 'Failed to load entities';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteEntity(entityName: string): void {
    if (!confirm(`Are you sure you want to delete entity "${entityName}"? This action cannot be undone.`)) {
      return;
    }

    this.deleting = entityName;
    this.error = null;
    this.cdr.detectChanges();

    this.generatorService.deleteEntity(entityName).subscribe({
      next: () => {
        // La suppression modifie routes.ts, ce qui déclenche un redémarrage du serveur
        // On attend 2s puis on vérifie que le serveur est prêt
        setTimeout(() => {
          this.waitForServerAndReload(0);
        }, 1000);
      },
      error: (error) => {
        this.deleting = null;
        this.error = `Failed to delete entity: ${error.error?.message || error.message}`;
        this.cdr.detectChanges();
      }
    });
  }

  private waitForServerAndReload(attempts: number): void {
    // Timeout après 10 tentatives (5s supplémentaires)
    if (attempts >= 10) {
      console.warn('Timeout waiting for server, reloading anyway');
      this.deleting = null;
      this.loadEntities();
      return;
    }

    this.generatorService.listEntities().subscribe({
      next: (entities) => {
        // Le serveur répond avec des données valides
        if (Array.isArray(entities)) {
          this.deleting = null;
          this.entities = entities;
          this.loading = false;
          this.cdr.detectChanges();
        } else {
          // Réponse invalide, réessayer
          setTimeout(() => {
            this.waitForServerAndReload(attempts + 1);
          }, 500);
        }
      },
      error: () => {
        // Le serveur ne répond pas encore, réessayer
        setTimeout(() => {
          this.waitForServerAndReload(attempts + 1);
        }, 500);
      }
    });
  }

  editEntity(entityName: string): void {
    this.router.navigate(['/generator/edit', entityName]);
  }

  createNewEntity(): void {
    this.router.navigate(['/generator']);
  }

  trackByName(_index: number, entity: EntityInfo): string {
    return entity.name;
  }

  viewEntity(name: string): void {
    this.router.navigate(['/generator/view', name]);
  }
}
