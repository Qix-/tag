class TagError extends Error {
	constructor(msg, unexpected = false) {
		super(msg);
		this.unexpected = unexpected;
	}
}

module.exports = {TagError};
