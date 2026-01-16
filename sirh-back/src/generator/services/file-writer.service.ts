import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface FileToWrite {
  path: string;
  content: string;
}

@Injectable()
export class FileWriterService {
  private readonly logger = new Logger(FileWriterService.name);
  private readonly lockFilePath = path.join(process.cwd(), '.generator-lock');

  /**
   * Crée le fichier lock pour désactiver le watcher
   */
  private acquireLock(): void {
    fs.writeFileSync(this.lockFilePath, Date.now().toString());
  }

  /**
   * Supprime le fichier lock pour réactiver le watcher (après un délai)
   */
  private releaseLock(delayMs: number = 500): void {
    setTimeout(() => {
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    }, delayMs);
  }

  /**
   * Écrit tous les fichiers avec lock du watcher
   */
  writeAllFiles(files: FileToWrite[]): void {
    this.logger.warn('writeAllFiles');

    if (files.length === 0) return;

    // Acquérir le lock avant d'écrire
    this.acquireLock();

    try {
      // Créer tous les dossiers nécessaires d'abord
      const directories = new Set<string>();
      for (const file of files) {
        directories.add(path.dirname(file.path));
      }

      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Écrire tous les fichiers
      for (const file of files) {
        fs.writeFileSync(file.path, file.content);
      }

      this.logger.log(`Written ${files.length} files in batch`);
    } finally {
      // Relâcher le lock après un délai
      this.releaseLock();
    }
  }

  /**
   * Supprime tous les fichiers/dossiers d'un coup
   */
  deleteAll(paths: string[]): void {
    this.logger.warn('deleteAll');

    this.acquireLock();

    try {
      for (const p of paths) {
        if (fs.existsSync(p)) {
          const stat = fs.statSync(p);
          if (stat.isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
          } else {
            fs.unlinkSync(p);
          }
        }
      }

      this.logger.log(`Deleted ${paths.length} paths in batch`);
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Supprime des chemins ET écrit des fichiers en une seule opération
   */
  deleteAndWriteAll(pathsToDelete: string[], filesToWrite: FileToWrite[]): void {
    this.logger.warn('deleteAndWriteAll');

    this.acquireLock();

    try {
      // 1. Supprimer les dossiers/fichiers
      for (const p of pathsToDelete) {
        if (fs.existsSync(p)) {
          const stat = fs.statSync(p);
          if (stat.isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
          } else {
            fs.unlinkSync(p);
          }
        }
      }

      // 2. Écrire les fichiers
      for (const file of filesToWrite) {
        const dir = path.dirname(file.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file.path, file.content);
      }

      this.logger.log(`Deleted ${pathsToDelete.length} paths and written ${filesToWrite.length} files in batch`);
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Vérifie si un chemin existe
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Lit le contenu d'un fichier
   */
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Écrit un seul fichier
   */
  writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  }
}
