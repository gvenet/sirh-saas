const chokidar = require('chokidar');
const path = require('path');

// Fonction pour afficher du texte en violet dans le terminal
function logViolet(message) {
  const violet = '\x1b[35m'; // code ANSI violet
  const reset = '\x1b[0m';   // réinitialisation de la couleur
  console.log(`${violet}${message}${reset}`);
}

const folderToWatch = path.join(__dirname, '../src');

const watcher = chokidar.watch(folderToWatch, {
  ignored: /(^|[\/\\])\../, // ignore les fichiers cachés
  persistent: true,
  ignoreInitial: true       // <-- ignore les fichiers déjà présents au démarrage
});

watcher
  .on('add', filePath => logViolet(`Fichier ajouté: ${filePath}`))
  .on('change', filePath => logViolet(`Fichier modifié: ${filePath}`))
  .on('unlink', filePath => logViolet(`Fichier supprimé: ${filePath}`));

logViolet(`Watching folder: ${folderToWatch}`);
