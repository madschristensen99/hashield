// Import the actual polyfills we installed
import pathBrowserify from 'path-browserify';
import { Buffer } from 'buffer';
import process from 'process';

// Create global shims for Node.js modules
window.Buffer = Buffer;
window.process = process;

// Create shims for monero-ts to use
const fs = {
  readFileSync: () => '',
  writeFileSync: () => {},
  existsSync: () => false,
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({ isDirectory: () => false }),
  unlinkSync: () => {},
  rmdirSync: () => {},
  createWriteStream: () => ({
    write: () => {},
    end: () => {},
    on: () => {}
  }),
  createReadStream: () => ({
    pipe: () => ({}),
    on: () => {}
  })
};

const path = pathBrowserify;

const assert = function(condition, message) {
  if (!condition) {
    console.error(message || 'Assertion failed');
  }
};
assert.strictEqual = (actual, expected, message) => {
  if (actual !== expected) {
    console.error(message || `Expected ${expected}, got ${actual}`);
  }
};
assert.deepStrictEqual = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(message || `Objects are not equal`);
  }
};

const http = {
  request: (options, callback) => {
    const req = {
      write: () => {},
      end: () => {},
      on: () => {}
    };
    return req;
  }
};

const https = {
  request: (options, callback) => {
    const req = {
      write: () => {},
      end: () => {},
      on: () => {}
    };
    return req;
  }
};

const child_process = {
  spawn: () => ({
    on: () => {},
    stdout: { on: () => {} },
    stderr: { on: () => {} }
  }),
  exec: (cmd, options, callback) => {
    if (callback) {
      callback(new Error('Not supported in browser'), null, null);
    }
    return { on: () => {} };
  }
};

// Make them available globally
window.fs = fs;
window.path = path;
window.assert = assert;
window.http = http;
window.https = https;
window.child_process = child_process;

// Export them for ESM imports
export { fs, path, assert, http, https, child_process };
