#!/usr/bin/env node
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const files = [
  'assets/app.js',
  'assets/packager.js',
  'assets/translate.js',
  'assets/jszip-mini.js',
];

const options = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
  sourceType: 'module',
};

for (const file of files) {
  const filePath = path.resolve(__dirname, file);
  const source = fs.readFileSync(filePath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, options);
  fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
  console.log(`Obfuscated: ${file}`);
}
