const fs = require('promise-fs');

async function resolvePath(value, pathvar, tries = []) {
	const paths = pathvar.split(':');

	const resolved = await Promise.all(paths.map(async pth => {
		const testPath = pth.replace(/%%?/g, m => m === '%%' ? '%' : value).trim();

		tries.push(testPath);

		try {
			const stat = await fs.stat(testPath);
			if (stat.isFile()) {
				return testPath;
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}
	}));

	return resolved.filter(v => Boolean(v))[0];
}

module.exports = {resolvePath};
