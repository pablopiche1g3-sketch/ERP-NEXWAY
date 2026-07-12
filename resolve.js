const fs = require('fs');
const file = 'src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The conflicts are specifically around the path, description, iconBg, and glowClass.
// The HEAD side has the correct path and description.
// The 77956a3 side has the correct iconBg and glowClass.

// Regex to find conflict blocks
const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> 77956a3.*?(\r?\n|$)/g;

content = content.replace(regex, (match, head, mine) => {
  // Extract path and description from head
  let pathMatch = head.match(/path:\s*'.*?',/);
  let descMatch = head.match(/description:\s*'.*?',/);
  
  // Extract iconBg and glowClass from mine
  let iconBgMatch = mine.match(/iconBg:\s*'.*?',/);
  let glowClassMatch = mine.match(/glowClass:\s*'.*?',/);
  
  // Also we must preserve any lines that are in head but not captured above, 
  // actually let's reconstruct the object block part.
  // A safer approach: take the 'mine' block, but replace its path and description with head's.
  let result = mine;
  if (pathMatch) {
    result = result.replace(/path:\s*'.*?',/, pathMatch[0]);
  }
  if (descMatch) {
    result = result.replace(/description:\s*'.*?',/, descMatch[0]);
  }
  
  return result.trim() + '\n';
});

fs.writeFileSync(file, content, 'utf8');
console.log('Resolved!');
