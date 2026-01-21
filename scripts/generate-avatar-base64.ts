import fs from 'fs';
import path from 'path';

const avatarDir = path.join(process.cwd(), 'public', 'img', 'avatars');
const files = fs.readdirSync(avatarDir).filter(f => f.endsWith('.png'));

const base64Map: Record<string, string> = {};

for (const file of files) {
  const filePath = path.join(avatarDir, file);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  base64Map[file] = base64;
}

console.log(JSON.stringify(base64Map, null, 2));