const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'admin.tsx',
  'login.tsx',
  'search.tsx'
];

const basePath = '/Users/azharhama/Downloads/project_backup_2026-06-27_21-00-42(1) 2/artifacts/barcode-app/src/pages';

filesToUpdate.forEach(file => {
  const filePath = path.join(basePath, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace colors in constants (admin.tsx)
  content = content.replace(/const BG_PAGE\s*=\s*"[^"]+";/g, 'const BG_PAGE   = "hsl(var(--background))";');
  content = content.replace(/const BG_CARD\s*=\s*"[^"]+";/g, 'const BG_CARD   = "hsl(var(--card))";');
  content = content.replace(/const BG_INPUT\s*=\s*"[^"]+";/g, 'const BG_INPUT  = "hsl(var(--input))";');
  content = content.replace(/const BG_TAB\s*=\s*"[^"]+";/g, 'const BG_TAB    = "hsl(var(--muted))";');
  content = content.replace(/const TAB_ACTIVE\s*=\s*"[^"]+";/g, 'const TAB_ACTIVE = "hsl(var(--primary))";');
  content = content.replace(/const BTN_GREEN\s*=\s*"[^"]+";/g, 'const BTN_GREEN = "hsl(var(--primary))";');
  content = content.replace(/const BTN_BLUE\s*=\s*"[^"]+";/g, 'const BTN_BLUE  = "hsl(var(--primary))";');

  // Replace inline colors
  content = content.replace(/text-white/g, 'text-foreground');
  content = content.replace(/text-\[#8b9ab2\]/g, 'text-muted-foreground');
  content = content.replace(/border-white\/10/g, 'border-border');
  content = content.replace(/border-white\/20/g, 'border-border');
  content = content.replace(/bg-white\/10/g, 'hover:bg-muted');
  content = content.replace(/focus:border-blue-500/g, 'focus:border-primary');
  content = content.replace(/border-transparent/g, 'border-border');
  content = content.replace(/shadow-lg/g, 'shadow-sm'); // less shadow for flat design
  content = content.replace(/shadow-md/g, 'shadow-sm');

  // DarkInput tweaks
  content = content.replace(/hover:text-white/g, 'hover:text-foreground');
  
  // Specific styling in SearchTab
  content = content.replace(/border-primary\/20/g, 'border-border');

  // Tab colors
  content = content.replace(/color: activeTab === id \? "#fff" : "#8b9ab2"/g, 'color: activeTab === id ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))"');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
