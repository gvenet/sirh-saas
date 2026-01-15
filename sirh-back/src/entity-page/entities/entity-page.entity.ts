import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PageField } from './page-field.entity';

export enum PageType {
  VIEW = 'view',
  EDIT = 'edit',
  LIST = 'list',
  CUSTOM = 'custom'
}

@Entity('entity_pages')
export class EntityPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityName: string;

  @Column({
    type: 'enum',
    enum: PageType,
    default: PageType.VIEW
  })
  pageType: PageType;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isDefault: boolean;

  @Column({ default: 0 })
  order: number;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>;

  @OneToMany(() => PageField, (field) => field.page, { cascade: true, eager: true })
  fields: PageField[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
