import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
    
    @Entity('aaa')
    export class Aaa {
      @PrimaryGeneratedColumn('uuid')
      id: string;

    
    
        
      @CreateDateColumn()
      createdAt: Date;
        
      @UpdateDateColumn()
      updatedAt: Date;
    }
    