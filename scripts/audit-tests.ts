import fs from 'fs';

const content = fs.readFileSync('tests/run-all-tests.ts', 'utf8');
const lines = content.split('\n');
const asserts: { line: number; name: string }[] = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('assert(')) {
    // find test name in next 10 lines
    let foundName = '';
    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
      const match = lines[j].match(/['"](Test [^'"]+)['"]/);
      if (match) {
        foundName = match[1];
        break;
      }
    }
    asserts.push({ line: i + 1, name: foundName || `[Unlabelled assert at line ${i + 1}]` });
  }
}

console.log(`\nExact Assert() Count in run-all-tests.ts: ${asserts.length}\n`);
asserts.forEach((a, i) => console.log(`${String(i + 1).padStart(3, ' ')}. [Line ${String(a.line).padStart(4, ' ')}] ${a.name}`));

