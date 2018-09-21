const chalk = require('chalk');

function visualizeSyntaxError(debug, error) {
	if (!error || !error.location || !error.filename || !error.source) {
		return;
	}

	const message = [];
	message.push(chalk`in {bold ${error.filename}} line {bold ${error.location.start.line}}`);

	const lines = error.source.split('\n');

	for (let lineno = error.location.start.line; lineno <= error.location.end.line; lineno++) {
		let adjust = 0;
		const line = lines[lineno - 1].replace(/\t/g, () => {
			adjust += 3;
			return '    ';
		});

		let start = lineno === error.location.start.line ? error.location.start.column - 1 : 0;
		let end = lineno === error.location.end.line ? error.location.end.column - 1 : line.length;

		start += adjust;
		end += adjust;

		const pointer = ' '.repeat(start) + '^'.repeat(end - start);
		message.push(line);
		message.push(chalk.greenBright(pointer));
	}

	debug(`%s\n${'\n%s'.repeat(message.length - 1)}\n`, message[0], ...message.slice(1));
}

module.exports = {visualizeSyntaxError};
