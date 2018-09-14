#!/usr/bin/env node --experimental-worker

const arg = require('arg');
const chalk = require('chalk');
const _debug = require('debug');
const fs = require('promise-fs');

_debug.names.push(/^tag$/);

const debug = _debug('tag');
let debugv = () => {};

const helpText = chalk`
 {bold tag} - yet another build script generator

 {dim $} tag -v [{underline task}...]
 {dim $} tag --help

 OPTIONS
   --help            shows this help message
   --version, -V     shows the version string
   --verbose, -v     verbose output
`;

const args = arg({
	'--help': Boolean,

	'--verbose': Boolean,
	'-v': '--verbose',

	'--version': Boolean,
	'-V': '--version'
});

if (args['--help']) {
	console.error(helpText);
	process.exit(2);
}

if (args['--version']) {
	console.error(require('./package.json').version);
	process.exit(2);
}

if (args['--verbose']) {
	_debug.names.push(/^tag:.+$/);
	debugv = _debug('tag:cli');
}

async function main() {
	await fs.access('./Tagfile', fs.constants.R_OK);
	debugv('correct access to Tagfile in:', process.cwd());
}

main().catch(error => {
	debug('fatal error: %O', error);
	process.exit(1);
});
