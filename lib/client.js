var SendEmitter = require('./send_emitter')
	, util = require('util')
	, net = require('net');

/**
 * Create a client
 */

function Client () {
	SendEmitter.call(this);

	// Ref or unref socket?  When unref'd, it won't keep the event loop
	// alive when everything else has quit.
	this._ref = true;
	this._timer = null;
	this._reconnect = false;

	// When we receive a start event from the server,
	// flag as ready to send queued data
	this.on('connect', function (config) {
		config || (config = {});
		this.objectMode = !!config.objectMode;
		this.enableAcks = !!config.enableAcks;
		this.ready = true;
	});

	// Log errors to console, if error logging is enabled
	this.on('error', function (err) {
		if (this.logErrors) {
			console.error(err.stack);
		}
	});

	// Allow server to invalidate sessions
	this.on('invalidateSession', function () {
		this.session = {};
		this.socket.destroy();
	});
}
util.inherits(Client, SendEmitter);
module.exports = Client;

/**
 * Connect the client to a net server
 * 
 * @param  {object}  Connection settings.  See the documentation for the
 *                   built-in net.connect() and tls.connect() functions.
 * @param  {function}  Callback, optional.  Added as a one-shot listener
 *                     for the 'connect' event.
 */

Client.prototype.connect = function (options, cb) {
	if (typeof(options) === 'object') {
		// Clone object so modifications don't affect the user's object
		options = Object.keys(options).reduce(function(o, k) {
			return o[k] = options[k], o;
		}, {});
	} else {
		// client.connect(port, [host])
		options = {
			port: arguments[0] | 0,
			host: arguments[1]
		};
	}

	if (typeof(cb) === 'function') {
		self.once('connect', cb);
	}

	// Store for reconnections
	this.options = options;

	options.createConnection = options.createConnection || function (options, cb) {
		cb(null, net.connect(options));
	};

	options.createConnection(options, onConnection.bind(this));
};

/**
 * Disconnect socket
 */

Client.prototype.disconnect = function () {
	this._reconnect = false;
	this.socket.destroySoon();
};

/**
 * Reconnect socket
 */

Client.prototype.reconnect = function (cb) {
	this.ready && (this.ready = false);
	this.socket.end();
	this.connect(this.options, cb);
};

/**
 * Enable exponential backoff reconnection system
 * 
 * @param  {number} min [Millisecond delay until first reconnect attempt]
 */

Client.prototype.autoReconnect = function (min, max) {
	// Setup the state and use min indirectly,
	// so we can reestablish the logic for the next disconnect.
	min || (min = 100);
	max || (max = 60000);
	this._reconnect = true;
	this._retries = 0;
	this._retryTimeout = min;
	this._retryTimeoutMax = max;

	function done () {
		this.once('connect', function () {
			this.autoReconnect(min, max);
		});
	}

	// When a connection completes, reset the backoff variables
	this.ready ? done.call(this) : this.once('connect', done);
};

/**
 * Ref the socket.  When ref'd, it keeps the event loop alive.  No-op when the
 * underlying socket object doesn't have a ref() method.  The ref/unref state
 * persists across reconnects.
 */

Client.prototype.ref = function () {
	if (this.socket && this.socket.ref) {
		this.socket.ref();
	}
	this._ref = true;
};

/**
 * Unref the socket.  When unref'd, it won't keep the event loop alive.  No-op
 * when the underlying socket object doesn't have an unref() method.
 * The ref/unref state persists across reconnects.
 */

Client.prototype.unref = function () {
	if (this.socket && this.socket.unref) {
		this.socket.unref();
	}
	this._ref = false;
};

function onConnection (err, socket) {
	var ev = this;

	if (err) {
		return ev.emit('error', err);
	}

	// Attach socket to emitter
	// On first connect, start a new session.
	// On subsequent connects, re-establish session.
	ev.socket = socket;
	ev.attach(socket);

	ev.syncSession();
	ev._send(['start', { objectMode: true, enableAcks: true }]);

	// Pass socket errors through to emitter
	socket.on('error', function (err) {
		ev.emit('error', err);
	});

	// If the socket closes, disable ready state and notify,
	// then attempt to backoff and reconnect
	socket.on('close', function () {
		ev.ready = false;
		ev.emit('disconnect');

		if (ev._reconnect === false) {
			return;
		}

		var delay = Math.min(
			ev._retryTimeoutMax,
			Math.pow(ev._retryTimeout, ev._retries));
		ev._retries++;

		ev._timer = setTimeout(function () {
			ev._timer = null;
			ev.reconnect();
		}, delay);

		if (ev._ref === false && ev._timer.unref) {
			ev._timer.unref();
		}
	});

	if (ev._ref) {
		ev.ref();
	} else {
		ev.unref();
	}

	ev.emit('connect');
}
