import fs from 'fs';

const dirs = ['output'];
const files = {
  'data.html': '<!-- Paste the chapter list page HTML here -->\n',
};

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created  ${dir}/`);
  } else {
    console.log(`Exists   ${dir}/`);
  }
}

for (const [file, content] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
    console.log(`Created  ${file}`);
  } else {
    console.log(`Exists   ${file}`);
  }
}

console.log('\nDone. Edit config.json, then fill in data.html and run:');
console.log('  node getChapters.js');
console.log('  node run.js');
