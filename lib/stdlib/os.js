const os = require('os');

module.exports = {
	namespace: {
		windows: {type: 'tag', enabled: os.platform() === 'win32'},
		darwin: {type: 'tag', enabled: os.platform() === 'darwin'},
		linux: {type: 'tag', enabled: os.platform() === 'linux'},
		openbsd: {type: 'tag', enabled: os.platform() === 'openbsd'},
		sunos: {type: 'tag', enabled: os.platform() === 'sunos'},
		aix: {type: 'tag', enabled: os.platform() === 'aix'},
		freebsd: {type: 'tag', enabled: os.platform() === 'freebsd'},

		x32: {type: 'tag', enabled: os.arch() === 'x32'},
		x64: {type: 'tag', enabled: os.arch() === 'x64'},
		arm: {type: 'tag', enabled: os.arch() === 'arm'},
		arm64: {type: 'tag', enabled: os.arch() === 'arm64'},
		ia32: {type: 'tag', enabled: os.arch() === 'ia32'},
		mips: {type: 'tag', enabled: os.arch() === 'mips'},
		mipsel: {type: 'tag', enabled: os.arch() === 'mipsel'},
		ppc: {type: 'tag', enabled: os.arch() === 'ppc'},
		ppc64: {type: 'tag', enabled: os.arch() === 'ppc64'},
		s390: {type: 'tag', enabled: os.arch() === 's390'},
		s390x: {type: 'tag', enabled: os.arch() === 's390x'},

		singlecore: {type: 'tag', enabled: os.cpus().length <= 1},
		multicore: {type: 'tag', enabled: os.cpus().length > 1},

		littleendian: {type: 'tag', enabled: os.endianness() === 'LE'},
		bigendian: {type: 'tag', enabled: os.endianness() === 'BE'},

		OS_PLATFORM: {type: 'variable', value: [{literal: os.platform()}]},
		OS_RELEASE: {type: 'variable', value: [{literal: os.release()}]},
		OS_ARCH: {type: 'variable', value: [{literal: os.arch()}]},
		OS_CPUCOUNT: {type: 'variable', value: [{literal: os.cpus().length.toString()}]},
		OS_ENDIANNESS: {type: 'variable', value: [{literal: os.endianness()}]},
		OS_UNAME: {type: 'variable', value: [{literal: os.type()}]},

		HOMEDIR: {type: 'variable', value: [{literal: os.homedir()}]},
		TMPDIR: {type: 'variable', value: [{literal: os.tmpdir()}]},
		HOSTNAME: {type: 'variable', value: [{literal: os.hostname()}]}
	}
};
