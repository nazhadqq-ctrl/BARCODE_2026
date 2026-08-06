const fs = require('fs');

const adminFile = './src/pages/admin.tsx';
let content = fs.readFileSync(adminFile, 'utf8');

// Remove BG constants
content = content.replace(/const BG_PAGE\s*=\s*"[^"]+";\n/g, '');
content = content.replace(/const BG_CARD\s*=\s*"[^"]+";\n/g, '');
content = content.replace(/const BG_INPUT\s*=\s*"[^"]+";\n/g, '');
content = content.replace(/const BG_TAB\s*=\s*"[^"]+";\n/g, '');
content = content.replace(/const TAB_ACTIVE\s*=\s*"[^"]+";\n/g, '');

// Replace inline styles with class names
content = content.replace(/style=\{\{\s*background:\s*BG_PAGE\s*\}\}/g, '');
content = content.replace(/style=\{\{\s*background:\s*BG_CARD\s*\}\}/g, '');
content = content.replace(/style=\{\{\s*background:\s*BG_INPUT\s*\}\}/g, '');

// Actually, merging classes is tricky with regex. Let's just remove the style entirely and add bg-muted where appropriate.
// In most cases, these divs already have className. We can just add bg-muted to the className.
// Instead of complex regex, let's just do:
content = content.replace(/className="(.*?)"\s*style=\{\{\s*background:\s*BG_PAGE\s*\}\}/g, 'className="$1 bg-background"');
content = content.replace(/className="(.*?)"\s*style=\{\{\s*background:\s*BG_CARD\s*\}\}/g, 'className="$1 bg-card"');
content = content.replace(/className="(.*?)"\s*style=\{\{\s*background:\s*BG_INPUT\s*\}\}/g, 'className="$1 bg-muted"');

// Handle borderTop inline style in UsersTab
content = content.replace(/style=\{\{\s*borderTop:\s*i > 0 \? `1px solid \$\{BG_PAGE\}` : undefined\s*\}\}/g, 'className={i > 0 ? "border-t border-background" : ""}');

// Handle ActiveTab styles
content = content.replace(/background:\s*activeTab\s*===\s*id\s*\?\s*TAB_ACTIVE\s*:\s*BG_TAB/g, '');
content = content.replace(/style=\{\{\s*,\s*\}\}/g, '');
content = content.replace(/style=\{\{\s*\}\}/g, '');

content = content.replace(/className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all"/g, 'className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}');

// Replace remaining rounded-xl, rounded-2xl
content = content.replace(/rounded-xl/g, 'rounded-md');
content = content.replace(/rounded-2xl/g, 'rounded-lg');
content = content.replace(/border-2/g, 'border');
content = content.replace(/border-dashed/g, 'border');

// Remove the flashlight emoji look-alike
content = content.replace(/<Zap className="w-4 h-4 text-yellow-400" \/>/g, '<Zap className="w-4 h-4 text-foreground" />');

// Remove Note: flashlight since it's just visual noise and user complained about it
content = content.replace(/<div className="rounded-md px-4 py-3 text-xs text-muted-foreground border border-border" style=\{\{\s*background:\s*BG_PAGE\s*\}\}>\s*Note: Flashlight is only available.*?\s*<\/div>/g, '');
content = content.replace(/<div className="rounded-md px-4 py-3 text-xs text-muted-foreground border border-border bg-background">\s*Note: Flashlight is only available.*?\s*<\/div>/g, '');
content = content.replace(/<div className="rounded-md px-4 py-3 text-xs text-muted-foreground border border-border">\s*Note: Flashlight is only available.*?\s*<\/div>/g, '');

fs.writeFileSync(adminFile, content);

console.log("admin.tsx cleaned up");
