import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GeneratorService } from '../services/generator';
import { EntityPageService } from '../services/entity-page.service';
import { FieldType, Field, isRelationType, CreateEntityDto, IncomingRelation } from '../models/field.model';
import { EntityPage, PageType, CreateEntityPageDto } from '../models/entity-page.model';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-entity-view',
  imports: [CommonModule, FormsModule, RouterLink, AdminNavbarComponent],
  templateUrl: './entity-view.html',
  styleUrl: './entity-view.css',
})
export class EntityViewComponent implements OnInit {
  entity: CreateEntityDto | null = null;
  entityName: string = '';
  loading = true;
  error: string | null = null;

  // Onglets
  activeTab: 'schema' | 'pages' = 'schema';

  // Pages
  pages: EntityPage[] = [];
  pagesLoading = false;
  pagesError: string | null = null;
  showPageModal = false;
  editingPage: EntityPage | null = null;
  pageForm: Partial<CreateEntityPageDto> = {};
  PageType = PageType;

  constructor(
    private generatorService: GeneratorService,
    private entityPageService: EntityPageService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('name');
    if (name) {
      this.entityName = name;
      this.loadEntity(name);
    } else {
      this.error = 'Nom de l\'entité manquant';
      this.loading = false;
    }
  }

  loadEntity(name: string): void {
    this.loading = true;
    this.error = null;
    console.log('Loading entity:', name);

    this.generatorService.getEntity(name).subscribe({
      next: (entity) => {
        console.log('Entity received:', entity);
        this.entity = entity;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading entity:', error);
        this.error = `Impossible de charger l'entité: ${error.error?.message || error.message}`;
        this.loading = false;
      }
    });
  }

  isRelationField(type: FieldType): boolean {
    return isRelationType(type);
  }

  getBasicFields(): Field[] {
    return this.entity?.fields.filter(f => !isRelationType(f.type)) || [];
  }

  getRelationFields(): Field[] {
    return this.entity?.fields.filter(f => isRelationType(f.type)) || [];
  }

  getIncomingRelations(): IncomingRelation[] {
    return this.entity?.incomingRelations || [];
  }

  getFieldTypeLabel(type: FieldType | string): string {
    const labels: Record<string, string> = {
      'string': 'Texte',
      'number': 'Nombre',
      'boolean': 'Booléen',
      'date': 'Date',
      'text': 'Texte long',
      'email': 'Email',
      'many-to-one': 'Many-to-One',
      'one-to-many': 'One-to-Many',
      'many-to-many': 'Many-to-Many',
      'one-to-one': 'One-to-One',
    };
    return labels[type] || type;
  }

  editEntity(): void {
    this.router.navigate(['/generator/edit', this.entityName]);
  }

  deleteEntity(): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'entité "${this.entityName}" ? Cette action est irréversible.`)) {
      return;
    }

    this.generatorService.deleteEntity(this.entityName).subscribe({
      next: () => {
        this.router.navigate(['/generator/list']);
      },
      error: (error) => {
        this.error = `Erreur lors de la suppression: ${error.error?.message || error.message}`;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/generator/list']);
  }

  // Onglets
  switchTab(tab: 'schema' | 'pages'): void {
    this.activeTab = tab;
    if (tab === 'pages' && this.pages.length === 0) {
      this.loadPages();
    }
  }

  // Pages
  loadPages(): void {
    this.pagesLoading = true;
    this.pagesError = null;

    this.entityPageService.getByEntity(this.entityName).subscribe({
      next: (pages) => {
        this.pages = pages;
        this.pagesLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.pagesError = `Erreur lors du chargement des pages: ${error.error?.message || error.message}`;
        this.pagesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openPageModal(page?: EntityPage): void {
    if (page) {
      this.editingPage = page;
      this.pageForm = {
        name: page.name,
        pageType: page.pageType,
        isDefault: page.isDefault
      };
    } else {
      this.editingPage = null;
      this.pageForm = {
        entityName: this.entityName,
        name: '',
        pageType: PageType.CUSTOM,
        isDefault: false
      };
    }
    this.showPageModal = true;
  }

  closePageModal(): void {
    this.showPageModal = false;
    this.editingPage = null;
    this.pageForm = {};
  }

  savePage(): void {
    if (!this.pageForm.name) return;

    if (this.editingPage) {
      this.entityPageService.update(this.editingPage.id, this.pageForm).subscribe({
        next: () => {
          this.closePageModal();
          this.loadPages();
        },
        error: (error) => {
          this.pagesError = `Erreur lors de la mise à jour: ${error.error?.message || error.message}`;
        }
      });
    } else {
      const dto: CreateEntityPageDto = {
        entityName: this.entityName,
        name: this.pageForm.name,
        pageType: this.pageForm.pageType || PageType.CUSTOM,
        isDefault: this.pageForm.isDefault || false
      };

      this.entityPageService.create(dto).subscribe({
        next: () => {
          this.closePageModal();
          this.loadPages();
        },
        error: (error) => {
          this.pagesError = `Erreur lors de la création: ${error.error?.message || error.message}`;
        }
      });
    }
  }

  deletePage(page: EntityPage): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la page "${page.name}" ?`)) {
      return;
    }

    this.entityPageService.delete(page.id).subscribe({
      next: () => {
        this.loadPages();
      },
      error: (error) => {
        this.pagesError = `Erreur lors de la suppression: ${error.error?.message || error.message}`;
      }
    });
  }

  getPageTypeLabel(type: PageType): string {
    const labels: Record<PageType, string> = {
      [PageType.VIEW]: 'Visualisation',
      [PageType.EDIT]: 'Édition',
      [PageType.LIST]: 'Liste',
      [PageType.CUSTOM]: 'Personnalisée'
    };
    return labels[type] || type;
  }

  editPageFields(page: EntityPage): void {
    this.router.navigate(['/generator/page-editor', page.id]);
  }
}
