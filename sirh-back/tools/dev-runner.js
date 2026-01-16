/**
 * Script de développement qui lance NestJS avec un watcher intelligent
 * qui ignore les changements pendant les opérations du générateur
 */
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const treeKill = require('tree-kill');

const projectRoot = path.join(__dirname, '..');
const srcPath = path.join(projectRoot, 'src');
const lockFilePath = path.join(projectRoot, '.generator-lock');

let nestProcess = null;
let restartTimeout = null;
let isLocked = false;

// Couleurs pour le terminal
const colors = {
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(color, message) {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-FR', { hour12: false }) + '.' + now.getMilliseconds().toString().padStart(3, '0');
  console.log(`${color}[${time}] ${message}${colors.reset}`);
}

function killNest() {
  return new Promise((resolve) => {
    if (!nestProcess) {
      resolve();
      return;
    }

    log(colors.cyan, 'Arrêt de NestJS...');

    const pidToKill = nestProcess.pid;
    nestProcess = null;

    log(colors.cyan, `Envoi tree-kill SIGTERM au processus ${pidToKill}...`);

    treeKill(pidToKill, 'SIGTERM', (err) => {
      if (err) {
        log(colors.cyan, `Erreur tree-kill: ${err.message}`);
      } else {
        log(colors.cyan, `Arborescence de processus ${pidToKill} tuée`);
      }
      resolve();
    });
  });
}

async function waitForPort(port, maxWaitMs = 10000) {
  const { execSync } = require('child_process');
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Vérifier si quelque chose écoute sur le port
      const result = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      if (!result) {
        log(colors.cyan, `Port ${port} libéré`);
        return true;
      }
      log(colors.cyan, `Port ${port} encore occupé (PID: ${result}), attente...`);
    } catch (e) {
      // lsof non disponible, fallback
      log(colors.cyan, `Vérification port échouée: ${e.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function startNest() {
  await killNest();

  // Forcer le kill de tout ce qui utilise le port 3000
  const { execSync } = require('child_process');
  try {
    const pids = execSync('lsof -ti:3000 2>/dev/null || true', { encoding: 'utf8' }).trim();
    if (pids) {
      log(colors.cyan, `Kill forcé des processus sur port 3000: ${pids}`);
      execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null || true`, { encoding: 'utf8' });
    }
  } catch (e) {
    log(colors.cyan, `Erreur kill port: ${e.message}`);
  }

  // Attendre que le port soit libéré
  await waitForPort(3000, 5000);

  log(colors.cyan, 'Démarrage de NestJS...');

  // Utiliser node directement avec le chemin vers ts-node
  const tsNodePath = path.join(projectRoot, 'node_modules', '.bin', 'ts-node');
  nestProcess = spawn(tsNodePath, ['-r', 'tsconfig-paths/register', 'src/main.ts'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  log(colors.cyan, `Processus NestJS démarré (PID: ${nestProcess.pid})`);

  nestProcess.on('error', (err) => {
    log(colors.cyan, `Erreur NestJS: ${err.message}`);
  });

  nestProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      log(colors.cyan, `NestJS s'est arrêté avec le code ${code}`);
    }
    nestProcess = null;
  });
}

function scheduleRestart() {
  // Annuler le redémarrage précédent si en attente
  if (restartTimeout) {
    clearTimeout(restartTimeout);
  }

  // Attendre un peu pour grouper les changements
  restartTimeout = setTimeout(async () => {
    // Vérifier si le lock existe toujours
    if (fs.existsSync(lockFilePath)) {
      log(colors.cyan, 'Lock actif, attente...');
      scheduleRestart();
      return;
    }

    await startNest();
  }, 300);
}

function checkLock() {
  const wasLocked = isLocked;
  isLocked = fs.existsSync(lockFilePath);

  if (wasLocked && !isLocked) {
    log(colors.cyan, 'Lock libéré, redémarrage programmé...');
    scheduleRestart();
  }

  return isLocked;
}

// Watcher pour le fichier lock
const lockWatcher = chokidar.watch(lockFilePath, {
  persistent: true,
  ignoreInitial: true,
});

lockWatcher.on('unlink', () => {
  log(colors.cyan, 'Lock supprimé - redémarrage...');
  isLocked = false;
  scheduleRestart();
});

lockWatcher.on('add', () => {
  log(colors.cyan, 'Lock acquis - watcher en pause');
  isLocked = true;
});

// Watcher pour les fichiers source
const srcWatcher = chokidar.watch(srcPath, {
  ignored: [
    /(^|[\/\\])\../,
    /node_modules/,
    /\.spec\.ts$/,
  ],
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50,
  },
});

srcWatcher
  .on('add', (filePath) => {
    if (checkLock()) {
      log(colors.cyan, `[IGNORÉ] Fichier ajouté: ${path.relative(projectRoot, filePath)}`);
      return;
    }
    log(colors.cyan, `Fichier ajouté: ${path.relative(projectRoot, filePath)}`);
    scheduleRestart();
  })
  .on('change', (filePath) => {
    if (checkLock()) {
      log(colors.cyan, `[IGNORÉ] Fichier modifié: ${path.relative(projectRoot, filePath)}`);
      return;
    }
    log(colors.cyan, `Fichier modifié: ${path.relative(projectRoot, filePath)}`);
    scheduleRestart();
  })
  .on('unlink', (filePath) => {
    if (checkLock()) {
      log(colors.cyan, `[IGNORÉ] Fichier supprimé: ${path.relative(projectRoot, filePath)}`);
      return;
    }
    log(colors.cyan, `Fichier supprimé: ${path.relative(projectRoot, filePath)}`);
    scheduleRestart();
  })
  .on('addDir', (dirPath) => {
    if (checkLock()) return;
    log(colors.cyan, `Dossier ajouté: ${path.relative(projectRoot, dirPath)}`);
  })
  .on('unlinkDir', (dirPath) => {
    if (checkLock()) return;
    log(colors.cyan, `Dossier supprimé: ${path.relative(projectRoot, dirPath)}`);
  });

// Gestion de l'arrêt propre
async function cleanup() {
  log(colors.cyan, 'Arrêt...');
  await killNest();
  if (fs.existsSync(lockFilePath)) {
    fs.unlinkSync(lockFilePath);
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Démarrage initial
log(colors.cyan, `Watching: ${srcPath}`);
log(colors.cyan, `Lock file: ${lockFilePath}`);
startNest();
