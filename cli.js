#!/usr/bin/env node --experimental-worker

const arg = require('arg');
const chalk = require('chalk');
const _debug = require('debug');
const fs = require('promise-fs');

// NOTE: don't import anything before this line that
//       uses the `tag:*` namespaces.
_debug.names.push(/^tag$/, /^tag:echo$/);

const debug = _debug('tag');
let debugv = () => {};

const variablePattern = /^([a-z_+][a-z0-9_+:]*)=(.+)?$/i;

const helpText = chalk`
 {bold tag} - yet another build script generator

 {dim $} tag -v [{underline task} ...] [+{underline tag} ...] [{underline NAME}=[{underline value}] ...]
 {dim $} tag --help

 OPTIONS
   --help            shows this help message
   --version, -V     shows the version string
   --verbose, -v     verbose output

   +{underline tag_name}         enables a tag by name
                     (can be specified multiple times)

   {underline NAME}=[{underline value}]      sets a variable
                     (can be specified multiple times)
`;

const args = arg({
	'--help': Boolean,

	'--verbose': Boolean,
	'-v': '--verbose',

	'--version': Boolean,
	'-V': '--version',

	'--tag': [String],
	'-T': '--tag'
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

const namespace = {};

{
	const newArgs = [];

	for (const arg of args._) {
		let variable;

		if (arg[0] === '+') {
			// TODO validate tag format
			namespace[arg.substring(1)] = {
				type: 'tag',
				enabled: true
			};
		} else if ((variable = variablePattern.exec(arg))) {
			namespace[variable[1]] = {
				type: 'variable',
				value: variable[2]
			};
		} else {
			newArgs.push(arg);
		}
	}

	args._ = newArgs;
}

const tasks = args._;
if (tasks.length === 0) {
	tasks.push('all');
}

// TODO validate task formats
debugv('tasks to run:', ...tasks);

async function main() {
	await fs.access('./Tagfile', fs.constants.R_OK);
	debugv('correct access to Tagfile in:', process.cwd());

	const buf = await fs.readFile('./Tagfile');
	debugv('read Tagfile completely: %d bytes', buf.length);
	const contents = buf.toString('utf-8');

	const {parseTagfile} = require('./lib/parser');
	const {TagAPI} = require('./lib/api');

	const api = new TagAPI();

	const tagfile = parseTagfile(contents, './Tagfile', api);

	// XXX DEBUG
	debug('%O', tagfile);
}

main().catch(error => {
	debug('fatal error: %O', error);
	process.exit(1);
});
