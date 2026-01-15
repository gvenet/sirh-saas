import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany } from 'typeorm';
import { Skill } from '../skill/skill.entity';
    
    @Entity('employees')
    export class Employee {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column({ type: 'varchar' })
  name: string;  @ManyToMany(() => Skill, skill => skill.employees)
  skills: Skill[];






    
        
      @CreateDateColumn()
      createdAt: Date;
        
      @UpdateDateColumn()
      updatedAt: Date;
    }
    