import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { EntityPage } from './entity-page.entity';

export enum FieldDisplayType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  AUTOCOMPLETE = 'autocomplete',
  LIST = 'list',
  TABLE = 'table',
  HIDDEN = 'hidden'
}

@Entity('page_fields')
export class PageField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pageId: string;

  @ManyToOne(() => EntityPage, (page) => page.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: EntityPage;

  @Column()
  fieldName: string;

  @Column({ nullable: true })
  fieldPath: string; // Pour les relations : "relation.field"

  @Column({
    type: 'enum',
    enum: FieldDisplayType,
    default: FieldDisplayType.TEXT
  })
  displayType: FieldDisplayType;

  @Column({ nullable: true })
  label: string;

  @Column({ nullable: true })
  placeholder: string;

  @Column({ default: 0 })
  order: number;

  @Column({ nullable: true })
  section: string; // Nom de la section/groupe

  @Column({ default: 12 })
  colSpan: number; // Largeur en colonnes (1-12 grid)

  @Column({ default: true })
  visible: boolean;

  @Column({ default: false })
  readOnly: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>; // Config spécifique au type (options select, colonnes table, etc.)

  @Column({ type: 'jsonb', nullable: true })
  validation: Record<string, any>; // Règles de validation

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
