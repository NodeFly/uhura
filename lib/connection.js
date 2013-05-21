var SendEmitter = require('./send_emitter')
	, util = require('util');

/**
 * Client connection event emitter
 * 
 * @param {net.Socket} socket [Net socket client]
 * @param {net.Server} server [Net server the socket is a client of]
 */

function Connection (socket, server) {
	var ev = this;

	SendEmitter.call(this);
	this.attach(socket);
	this.socket = socket;

	// Attach session right away
	this.sessionStore = server.sessionStore;
	this.sessionStore.generate(this);

	// Starting a new connection
	this.once('start', this.start.bind(this));
	socket.once('close', this.disconnect.bind(this));
}
util.inherits(Connection, SendEmitter);
module.exports = Connection;

/**
 * Start a new connection session
 */

Connection.prototype.start = function () {
	if (this.session.sessionID) {
		return this.resume(this.session.sessionID);
	}
	this.set('sessionID', this.sessionID);
	this.ready = true;
	this.emit('connect');
	this.send('connect');
};

/**
 * Resume existing connection session
 * 
 * @param  {string} id [Session id to resume]
 */

Connection.prototype.resume = function (id) {
	var ev = this;

	this.sessionStore.get(id, function (err, session) {
		if (err || ! session) { return ev.start(); }
		ev.sessionStore.createSession(ev, session);
		ev.syncSession();
		ev.ready = true;
		ev.emit('connect');
		ev.send('connect');
	});
};

/**
 * Save session state after a disconnect
 */

Connection.prototype.disconnect = function () {
	var ev = this;
	this.emit('disconnect');
	if (this.ready) {
		this.ready = false;
		this.session.resetMaxAge();
		this.session.save(function (err) {
			if (err) console.error(err.stack);
			ev.socket.end();
		});
	}
};