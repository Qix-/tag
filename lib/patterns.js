module.exports = {
	variableAssignment: /^([a-z_+][a-z0-9_+:]*)=(.+)?$/i,
	variable: /^[a-z_+][a-z0-9_+:]*$/i,
	task: /^[a-z_+][a-z0-9_+:]*$/i,
	tag: /^[a-z_+][a-z0-9_+:]*$/i,
	method: /^[a-z_+][a-z0-9_+]*(:[a-z_+][a-z0-9_+]*)+$/i
};
