import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
    import { Employee } from '../employee/employee.entity';

    @Entity('skills')
    export class Skill {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column({ type: 'varchar' })
  description: string;
    
  @ManyToMany(() => Employee, { eager: true })
  @JoinTable({ name: 'skill_employees' })
  employees: Employee[];
        
      @CreateDateColumn()
      createdAt: Date;
        
      @UpdateDateColumn()
      updatedAt: Date;
    }
    