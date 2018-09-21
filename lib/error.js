class TagError extends Error {
	constructor(thing, msg) {
		super(msg);
		this.location = thing.location;
	}
}

module.exports = {TagError};
