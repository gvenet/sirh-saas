const chokidar = require('chokidar');
const path = require('path');

// Fonction pour afficher du texte en violet dans le terminal avec l'heure
function logViolet(message) {
  const violet = '\x1b[35m';
  const reset = '\x1b[0m';

  const now = new Date();
  const time =
    now.toLocaleTimeString('fr-FR', { hour12: false }) +
    '.' +
    now.getMilliseconds().toString().padStart(3, '0');

  console.log(`${violet}[${time}] ${message}${reset}`);
}

const folderToWatch = path.join(__dirname, '../src');

const watcher = chokidar.watch(folderToWatch, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('add', filePath =>
    logViolet(`Fichier ajouté: ${filePath}`)
  )
  .on('change', filePath =>
    logViolet(`Fichier modifié: ${filePath}`)
  )
  .on('unlink', filePath =>
    logViolet(`Fichier supprimé: ${filePath}`)
  )
  .on('addDir', dirPath =>
    logViolet(`Dossier ajouté: ${dirPath}`)
  )
  .on('unlinkDir', dirPath =>
    logViolet(`Dossier supprimé: ${dirPath}`)
  );

logViolet(`Watching folder: ${folderToWatch}`);
