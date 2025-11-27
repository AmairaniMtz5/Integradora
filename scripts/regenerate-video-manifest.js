const fs = require('fs');
const path = require('path');

const videosRoot = path.join(__dirname, '..', 'front-end', 'Administrador', 'Ejercicios', 'videos');
const manifestPath = path.join(videosRoot, 'manifest.json');

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function buildManifest() {
  if (!fs.existsSync(videosRoot)) {
    console.error('videos directory not found at', videosRoot);
    process.exit(1);
  }

  const entries = [];
  const folders = fs.readdirSync(videosRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  folders.forEach(folder => {
    const folderPath = path.join(videosRoot, folder.name);
    const files = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.toLowerCase().endsWith('.mp4'))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    files.forEach(file => {
      const videoName = file.name.replace(/\.mp4$/i, '');
      const idPrefix = slugify(folder.name + ' ' + videoName);
      entries.push({
        id: idPrefix,
        name: videoName,
        path: `videos/${folder.name}/${file.name}`,
        notes: folder.name
      });
    });
  });

  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2) + '\n');
  console.log('Manifest actualizado en', manifestPath);
}

buildManifest();
