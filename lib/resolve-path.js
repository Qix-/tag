const fs = require('fs');

function resolveAgainst(value, pathvar, tries = []) {
	const paths = pathvar.split(':');

	for (const pth of paths) {
		const testPath = pth.replace(/%%?/g, m => m === '%%' ? '%' : value).trim();
		tries.push(testPath);
		// Yes, it must be synchronous.
		try {
			const stat = fs.statSync(testPath);
			if (stat.isFile()) {
				return testPath;
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}
}

module.exports = {resolveAgainst};
