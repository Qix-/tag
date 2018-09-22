const chalk = require('chalk');

function visualizeSyntaxError(debug, error) {
	if (!error || !error.location || !error.filename || !error.source) {
		return;
	}

	const message = [];
	message.push(chalk`in {bold ${error.filename}} line {bold ${error.location.start.line}}`);

	const lines = error.source.split('\n');

	let start = error.location.start.line === error.location.end.line ? error.location.start.column - 1 : 0;

	let adjust = 0;
	const line = lines[error.location.start.line - 1].replace(/\t/g, () => {
		adjust += 3;
		return '    ';
	});

	let end = error.location.start.line === error.location.end.line ? error.location.end.column - 1 : line.length;

	start += adjust;
	end += adjust;

	const pointer = ' '.repeat(start) + '^'.repeat(end - start);
	message.push(line);
	message.push(chalk.greenBright(pointer));

	debug(`%s\n${'\n    %s'.repeat(message.length - 1)}\n`, message[0], ...message.slice(1));
}

module.exports = {visualizeSyntaxError};
