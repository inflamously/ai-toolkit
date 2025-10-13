import fs from 'fs';
import path from 'path';
import { TOOLKIT_ROOT } from '@/paths';

export const isWindows = process.platform === 'win32';

export const getPythonPath = () => {
  let pythonPath = 'python';
  // use .venv or venv if it exists
  if (fs.existsSync(path.join(TOOLKIT_ROOT, '.venv'))) {
    if (isWindows) {
      pythonPath = path.join(TOOLKIT_ROOT, '.venv', 'Scripts', 'python.exe');
    } else {
      pythonPath = path.join(TOOLKIT_ROOT, '.venv', 'bin', 'python');
    }
  } else if (fs.existsSync(path.join(TOOLKIT_ROOT, 'venv'))) {
    if (isWindows) {
      pythonPath = path.join(TOOLKIT_ROOT, 'venv', 'Scripts', 'python.exe');
    } else {
      pythonPath = path.join(TOOLKIT_ROOT, 'venv', 'bin', 'python');
    }
  }
  return pythonPath;
};
