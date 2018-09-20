#!/usr/bin/env node --experimental-worker

const path = require('path');

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
   --help                    shows this help message
   --version, -V             shows the version string
   --verbose, -v             verbose output

   --tagfile, -F {underline filename}    the filename to read as the Tagfile
                             (defaults to './Tagfile')

   +{underline tag_name}                 enables a tag by name
                             (can be specified multiple times)

   {underline NAME}=[{underline value}]              sets a variable
                             (can be specified multiple times)
`;

const args = arg({
	'--help': Boolean,

	'--verbose': Boolean,
	'-v': '--verbose',

	'--version': Boolean,
	'-V': '--version',

	'--tagfile': String,
	'-F': '--tagfile'
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

const namespace = {
	TAGPATH: {
		type: 'variable',
		value: [
			path.join(__dirname, 'stdlib/%.tag'),
			'./%.tag',
			'./%.js',
			'./%',
			'./node_modules/%/index.tag',
			'./node_modules/%/index.js',
			'./node_modules/%.tag',
			'./node_modules/%.js',
			'./node_modules/%'
		].join(':')
	}
};

{
	const newArgs = [];

	for (const arg of args._) {
		let variable;

		// TODO make sure they're not overwriting an existing value.
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

args['--tagfile'] = args['--tagfile'] || './Tagfile';

const tasks = args._;
if (tasks.length === 0) {
	tasks.push('all');
}

// TODO validate task formats
debugv('tasks to run:', ...tasks);

async function main() {
	await fs.access(args['--tagfile'], fs.constants.R_OK);
	const resolvedPath = path.resolve(args['--tagfile']);
	debugv('correct access to Tagfile:', resolvedPath);

	const buf = await fs.readFile(resolvedPath);
	debugv('read Tagfile completely: %d bytes', buf.length);
	const contents = buf.toString('utf-8');

	const parseTagfile = require('tag-parser');

	const tagfile = (() => {
		try {
			return parseTagfile(contents);
		} catch (error) {
			error.source = contents;
		}
	})();

	debugv(tagfile);
}

main().catch(error => {
	debug('fatal error: %O', error);
	process.exit(1);
});
