import fs from 'fs';
import path from 'path';

export function loadConfig(baseDir = process.env.ENV_CONFIG_PATH || '../../configs/juice-junkiez') {
  const base = path.resolve(process.cwd(), baseDir);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'));
  return {
    booking: read('booking.json'),
    forms: read('forms.json'),
    templates: read('templates.json'),
    env: read('environment.json'),
    messaging: read('messaging.json')
  };
}
