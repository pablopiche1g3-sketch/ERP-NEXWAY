const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Perform massive replacements
    let modified = content
      .replace(/glass-card/g, 'bg-card border-border shadow-sm')
      .replace(/glass-input/g, 'bg-background border-input')
      .replace(/glass-strong/g, 'bg-card border-border shadow-md')
      .replace(/\bglass\b/g, 'bg-card border-border shadow-sm');
      
    if (modified !== content) {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  }
});

console.log('Cleanup complete!');
