import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FieldDto, FieldType, isRelationType } from '../dto/field.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseSchemaService {
  private readonly logger = new Logger(DatabaseSchemaService.name);
  private readonly entitiesPath = path.join(process.cwd(), 'src', 'entities');

  constructor(private readonly dataSource: DataSource) {}

  async syncDatabaseSchema(tableName: string, fields: FieldDto[]): Promise<void> {
    this.logger.warn('syncDatabaseSchema');
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      const tableExists = await queryRunner.hasTable(tableName);

      if (!tableExists) {
        await this.createTable(queryRunner, tableName, fields);
      } else {
        await this.updateTable(queryRunner, tableName, fields);
      }

      this.logger.log(`Database schema synchronized for table: ${tableName}`);
    } catch (error) {
      this.logger.error(`Failed to sync database schema for ${tableName}: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createTable(queryRunner: any, tableName: string, fields: FieldDto[]): Promise<void> {
    this.logger.warn('createTable');

    const normalFields = fields.filter(f => !isRelationType(f.type));
    const relationFields = fields.filter(f => isRelationType(f.type));

    const columns: string[] = [
      `"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4()`,
    ];

    for (const field of normalFields) {
      const columnDef = this.buildColumnDefinition(field);
      columns.push(columnDef);
    }

    for (const field of relationFields) {
      if (field.type === FieldType.MANY_TO_ONE || field.type === FieldType.ONE_TO_ONE) {
        const nullable = !field.required ? 'NULL' : 'NOT NULL';
        columns.push(`"${field.name}_id" uuid ${nullable}`);
      }
    }

    columns.push(`"createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    columns.push(`"updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    const createTableSQL = `CREATE TABLE "${tableName}" (\n  ${columns.join(',\n  ')}\n)`;
    this.logger.log(`Creating table: ${tableName}`);
    await queryRunner.query(createTableSQL);

    for (const field of relationFields) {
      if (field.type === FieldType.MANY_TO_ONE || field.type === FieldType.ONE_TO_ONE) {
        await this.addForeignKeyConstraint(queryRunner, tableName, field);
      }
    }

    for (const field of relationFields) {
      if (field.type === FieldType.MANY_TO_MANY) {
        await this.createJunctionTable(queryRunner, tableName, field);
      }
    }
  }

  private async updateTable(queryRunner: any, tableName: string, fields: FieldDto[]): Promise<void> {
    this.logger.warn('updateTable');

    const existingColumns = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
    `, [tableName]);
    const existingColumnNames = new Set(existingColumns.map((c: any) => c.column_name));

    const normalFields = fields.filter(f => !isRelationType(f.type));
    const relationFields = fields.filter(f => isRelationType(f.type));

    for (const field of normalFields) {
      if (!existingColumnNames.has(field.name)) {
        const columnType = this.getPostgresType(field.type);
        const nullable = !field.required ? '' : 'NOT NULL';
        const defaultValue = field.defaultValue ? `DEFAULT '${field.defaultValue}'` : '';

        await queryRunner.query(`
          ALTER TABLE "${tableName}"
          ADD COLUMN "${field.name}" ${columnType} ${nullable} ${defaultValue}
        `);
        this.logger.log(`Added column ${field.name} to ${tableName}`);
      }
    }

    for (const field of relationFields) {
      if (field.type === FieldType.MANY_TO_ONE || field.type === FieldType.ONE_TO_ONE) {
        const fkColumnName = `${field.name}_id`;
        if (!existingColumnNames.has(fkColumnName)) {
          const nullable = !field.required ? '' : 'NOT NULL';
          await queryRunner.query(`
            ALTER TABLE "${tableName}"
            ADD COLUMN "${fkColumnName}" uuid ${nullable}
          `);
          await this.addForeignKeyConstraint(queryRunner, tableName, field);
          this.logger.log(`Added FK column ${fkColumnName} to ${tableName}`);
        }
      }
    }

    for (const field of relationFields) {
      if (field.type === FieldType.MANY_TO_MANY) {
        const junctionTableName = `${tableName}_${field.name}`;
        const junctionExists = await queryRunner.hasTable(junctionTableName);
        if (!junctionExists) {
          await this.createJunctionTable(queryRunner, tableName, field);
        }
      }
    }
  }

  private buildColumnDefinition(field: FieldDto): string {
    const columnType = this.getPostgresType(field.type);
    const nullable = !field.required ? '' : 'NOT NULL';
    const unique = field.unique ? 'UNIQUE' : '';
    const defaultValue = field.defaultValue ? `DEFAULT '${field.defaultValue}'` : '';

    return `"${field.name}" ${columnType} ${nullable} ${unique} ${defaultValue}`.trim().replace(/\s+/g, ' ');
  }

  getPostgresType(fieldType: FieldType): string {
    const typeMap: Record<string, string> = {
      [FieldType.STRING]: 'VARCHAR(255)',
      [FieldType.EMAIL]: 'VARCHAR(255)',
      [FieldType.TEXT]: 'TEXT',
      [FieldType.NUMBER]: 'INTEGER',
      [FieldType.BOOLEAN]: 'BOOLEAN',
      [FieldType.DATE]: 'TIMESTAMP',
    };
    return typeMap[fieldType] || 'VARCHAR(255)';
  }

  private async addForeignKeyConstraint(queryRunner: any, tableName: string, field: FieldDto): Promise<void> {
    this.logger.warn('addForeignKeyConstraint');
    if (!field.relationTarget) return;

    const targetTableName = await this.getTableNameForEntity(field.relationTarget);
    if (!targetTableName) {
      this.logger.warn(`Cannot find table for entity ${field.relationTarget}, skipping FK constraint`);
      return;
    }

    const constraintName = `fk_${tableName}_${field.name}`;
    const onDelete = field.onDelete || 'SET NULL';

    try {
      await queryRunner.query(`
        ALTER TABLE "${tableName}"
        ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${field.name}_id")
        REFERENCES "${targetTableName}"("id")
        ON DELETE ${onDelete}
      `);
      this.logger.log(`Added FK constraint ${constraintName}`);
    } catch (error) {
      this.logger.warn(`Failed to add FK constraint ${constraintName}: ${error.message}`);
    }
  }

  private async createJunctionTable(queryRunner: any, tableName: string, field: FieldDto): Promise<void> {
    this.logger.warn('createJunctionTable');
    if (!field.relationTarget) return;

    const targetTableName = await this.getTableNameForEntity(field.relationTarget);
    if (!targetTableName) {
      this.logger.warn(`Cannot find table for entity ${field.relationTarget}, skipping junction table`);
      return;
    }

    const junctionTableName = `${tableName}_${field.name}`;
    const sourceColumnName = `${tableName}Id`;
    const targetColumnName = `${targetTableName}Id`;

    await queryRunner.query(`
      CREATE TABLE "${junctionTableName}" (
        "${sourceColumnName}" uuid NOT NULL,
        "${targetColumnName}" uuid NOT NULL,
        PRIMARY KEY ("${sourceColumnName}", "${targetColumnName}"),
        CONSTRAINT "fk_${junctionTableName}_source"
          FOREIGN KEY ("${sourceColumnName}")
          REFERENCES "${tableName}"("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_${junctionTableName}_target"
          FOREIGN KEY ("${targetColumnName}")
          REFERENCES "${targetTableName}"("id")
          ON DELETE CASCADE
      )
    `);
    this.logger.log(`Created junction table ${junctionTableName}`);
  }

  async getTableNameForEntity(entityName: string): Promise<string | null> {
    const moduleName = entityName.toLowerCase();
    const entityFilePath = path.join(this.entitiesPath, moduleName, `${moduleName}.entity.ts`);

    if (!fs.existsSync(entityFilePath)) {
      return null;
    }

    const content = fs.readFileSync(entityFilePath, 'utf-8');
    const match = content.match(/@Entity\('([^']+)'\)/);
    return match ? match[1] : moduleName;
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    this.logger.warn('dropColumn');
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}" CASCADE`);
      this.logger.log(`Dropped column ${columnName} from ${tableName}`);
    } finally {
      await queryRunner.release();
    }
  }

  async dropJunctionTable(tableName: string): Promise<void> {
    this.logger.warn('dropJunctionTable');
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      this.logger.log(`Dropped junction table: ${tableName}`);
    } catch (e) {
      this.logger.warn(`Failed to drop junction table ${tableName}: ${e.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async dropTableFromDatabase(tableName: string, relationTables: string[]): Promise<void> {
    this.logger.warn('dropTableFromDatabase');
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      for (const relationTable of relationTables) {
        try {
          await queryRunner.query(`DROP TABLE IF EXISTS "${relationTable}" CASCADE`);
          this.logger.log(`Dropped junction table: ${relationTable}`);
        } catch (e) {
          this.logger.warn(`Failed to drop junction table ${relationTable}: ${e.message}`);
        }
      }

      try {
        await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        this.logger.log(`Dropped table: ${tableName}`);
      } catch (e) {
        this.logger.warn(`Failed to drop table ${tableName}: ${e.message}`);
      }
    } finally {
      await queryRunner.release();
    }
  }
}
