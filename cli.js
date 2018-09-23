#!/usr/bin/env node --experimental-worker

Error.stackTraceLimit = Infinity;

const path = require('path');

const arg = require('arg');
const chalk = require('chalk');
const _debug = require('debug');
const fs = require('promise-fs');
const parseTagfile = require('tag-parser');

const {visualizeSyntaxError} = require('./lib/syntax-error');
const pattern = require('./lib/patterns');

// NOTE: don't import anything before this line that
//       uses the `tag:*` namespaces.
_debug.names.push(/^tag$/, /^tag:echo$/);

const debug = _debug('tag');
let debugv = () => {};

const helpText = chalk`
 {bold tag} - yet another task runner

 {dim $} tag -v [{underline task} ...] [@{underline tag} ...] [{underline NAME}=[{underline value}] ...]
 {dim $} tag --help

 OPTIONS
   --help                    shows this help message
   --version, -V             shows the version string
   --verbose, -v             verbose output

   --tagfile, -F {underline filename}    the filename to read as the Tagfile
                             (defaults to './Tagfile')

   @{underline tag_name}                 enables a tag by name
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

args['--tagfile'] = args['--tagfile'] || './Tagfile';

async function main() {
	debugv('arguments: %O', args);

	const namespace = {
		TAGPATH: {
			type: 'variable',
			value: [{literal: [
				path.join(__dirname, 'lib/stdlib/%.tag.js'),
				path.join(__dirname, 'lib/stdlib/%.tag'),
				'./%.tag',
				'./%.tag.js',
				'./%',
				'./node_modules/%/index.tag',
				'./node_modules/%/index.tag.js',
				'./node_modules/%.tag',
				'./node_modules/%.tag.js',
				'./node_modules/%'
			].join(':')}]
		}
	};

	const tasks = [];

	for (const arg of args._) {
		let variable;

		if (arg[0] === '@') {
			const name = arg.substring(1);

			if (!pattern.tag.test(name)) {
				throw new Error(`invalid tag format: ${name}`);
			}

			if (namespace[name] && namespace[name].type !== 'tag') {
				throw new Error(`attempting to enable non-tag '${name}' which is of type '${namespace[name].type}'`);
			}

			namespace[name] = {
				type: 'tag',
				enabled: true
			};
		} else if ((variable = pattern.variableAssignment.exec(arg))) {
			const name = variable[1];

			if (namespace[name] && namespace[name].type !== 'variable') {
				throw new Error(`attempting to enable non-variable '${name}' which is of type '${namespace[name].type}'`);
			}

			namespace[name] = {
				type: 'variable',
				value: [{literal: variable[2]}]
			};
		} else {
			tasks.push(arg);
		}
	}

	if (tasks.length === 0) {
		tasks.push('all');
	}

	tasks.forEach(task => {
		if (!pattern.task.test(task)) {
			throw new Error(`task name is invalid: ${task}`);
		}
	});

	debugv('tasks to run:', ...tasks);

	await fs.access(args['--tagfile'], fs.constants.R_OK);
	const resolvedPath = path.resolve(args['--tagfile']);
	debugv('correct access to Tagfile:', resolvedPath);

	const buf = await fs.readFile(resolvedPath);
	debugv('read Tagfile completely: %d bytes', buf.length);
	const contents = buf.toString('utf-8');

	debugv('initial namespace (before plugin): %O', namespace);

	try {
		const {Context, parseStatement} = require('./lib/context');

		const tagfile = parseTagfile(contents);
		debugv('tagfile: %O', tagfile);

		const ctx = new Context({namespace});

		await ctx.use('tag');

		for (const statement of tagfile) {
			// Linters are annoying sometimes.
			// This is required to allow for any async plugins to work
			// in a synchronous fashion.
			// eslint-disable-next-line no-await-in-loop
			await parseStatement(ctx, statement);
		}
	} catch (error) {
		if (!error.filename || !error.source) {
			error.filename = resolvedPath;
			error.source = contents;
		}
		throw error;
	}
}

main()
	.catch(error => {
		debug('fatal error: %s', args['--verbose'] ? error.stack : error.message.replace(/^[^ ]\s+/, ''));
		visualizeSyntaxError(debug, error);
		process.exit(1);
	})
	.catch(error => {
		// Something went wrong internall.
		// Fail-safe error report here.
		console.error(error.stack);
		process.exit(10);
	});
