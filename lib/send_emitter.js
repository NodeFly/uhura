var events = require('events')
	, JSONStream = require('JSONStream')
	, util = require('util')
	, Acks = require('./ack');

/**
 * Basic event emitter that interacts with a stream
 */

function SendEmitter () {
	events.EventEmitter.call(this);

	// Create queue
	this.queue = [];

	// Handle ready state
	var ready = false;
	// FIXME(bnoordhuis) Setter with far ranging side effects, questionable.
	this.__defineSetter__('ready', function (v) {
		ready = v;
		if (ready) {
			while (this.queue.length > 0) {
				this.queue.shift()();
			}
		}
	});
	this.__defineGetter__('ready', function () {
		return ready;
	});

	// Object-mode is disabled by default, for backwards-compatibility
	// Old versions of uhura expect array-formatted messages
	this.objectMode = false;

	// ACK support is disabled by default, depends on object-mode
	this.enableAcks = false;
	this.acks = new Acks();

	// Handle shared session store data
	this.session = {};

	// For backwards compatibility with older clients we can't rename
	// the '_set' event but at least we can give the local version a
	// different name so it's possible to discern between the two.
	this.on('uhura:local:_set', this._set);
	this.on('_set', this._set);
}
util.inherits(SendEmitter, events.EventEmitter);
module.exports = SendEmitter;

/**
 * Set a property of the shared data structure between the server and client
 *
 * @param {mixed} [key] [String key to assign value to, or key/value pair hash]
 * @param {mixed} [val] [Value to assign to designated key, ignored for hashes]
 */

SendEmitter.prototype.set = function (key, val) {
	this.emit('uhura:local:_set', key, val);
	this._send(['_set', key, val]);
};

/**
 * Get value of share data property
 * 
 * @param  {string} key [Name of shared property to access]
 */

SendEmitter.prototype.get = function (key) {
	return key ? this.session[key] : this.session;
};

/**
 * Synchronize session state with remote stream
 */

SendEmitter.prototype.syncSession = function () {
	this._send(['_set', this.session]);
};

/**
 * Set local session values
 *
 * @param {mixed} [key] [String key to assign value to, or key/value pair hash]
 * @param {mixed} [val] [Value to assign to designated key, ignored for hashes]
 */

SendEmitter.prototype._set = function (key, val) {
	if (typeof key === 'string')  {
		this.session[key] = val;
		return;
	}

	for (var i in key) {
		this.session[i] = key[i];
	}
};

/**
 * Attach a stream to interact with
 * 
 * @param  {Stream} stream [Stream to interact with]
 */

SendEmitter.prototype.attach = function (stream) {
	var ev = this;

	// Create new parser and serializer
	this.serializer = JSONStream.stringify();
	this.parser = JSONStream.parse([true]);
	this.parser.on('data', function (args) {
		// Make server backwards-compatible with old clients
		if (Array.isArray(args)) {
			ev.emit.apply(ev, args);
			return;
		}

		// Send acks on messages that are, themselves, not acks
		if (ev.enableAcks && args.id) {
			ev._send({ args: ['ack::' + args.id] });
		}

		ev.emit.apply(ev, args.args);
	});

	// Propagate parse errors to the SendEmitter object
	this.parser.on('error', this.emit.bind(this, 'error'));

	// Attach stream
	this.stream = stream;

	// Start pipes
	this.serializer.pipe(stream).pipe(this.parser);

	// Dequeue pending actions.
	while (this.queue.length > 0) {
		this.queue.shift()();
	}
};

/**
 * Queue event to be sent to the server
 *
 * @param {string} [eventName] [Name of event to emit on the server]
 * @param {mixed}  [...]       [All following arguments are passed to receiver]
 */

SendEmitter.prototype.send = function () {
	var args = Array.prototype.slice.call(arguments);
	var ev = this;
	
	// Pop the last argument off of the argument list to act as the callback
	// NOTE: Do this here to ensure ACK callbacks get ignored by old servers
	var cb = (typeof args[args.length - 1] === 'function')
		? args.pop()
		: function () {};

	function withAck (data) {
		// In the event of a message not being acknowledged,
		// we should requeue the message with modified ACK id.
		function requeue () {
			ev.queue.push(ev._send.bind(ev, data));
		}

		// Create ack listener and add id to data object
		var ack = ev.acks.create(cb);
		data.id = ack.id;

		// When the correct ACK event is received,
		// resolve and detach disconnect event
		ev.once('ack::' + ack.id, function () {
			ev.removeListener('uhura:local:disconnect', requeue);
			ev.acks.resolve(ack.id);
		});

		// Trigger a requeue event if the connection is lost. This ensures
		// that the message is moved to the ACK queue for the new connection.
		ev.once('uhura:local:disconnect', requeue);

		return data;
	}

	// Ready to send data, determine how
	function sendNow () {
		// Attempt to send data in object mode,
		// adding ack functionality, if enabled
		if (ev.objectMode) {
			var data = { args: args };
			if (ev.enableAcks) {
				data = withAck(data);
				ev._send(data);
				return;
			}

			ev._send(data);
			cb();
			return;
		}

		ev._send(args);
		cb();
	}

	// Determine if we should send immediately, or queue for later
	if (ev.ready) {
		sendNow();
	} else {
		ev.queue.push(sendNow);
	}
};

/**
 * Explicitly send data, regardless of ready state
 *
 * @param {string} [eventName] [Name of event to emit on the server]
 * @param {mixed}  [...]       [All following arguments are passed to receiver]
 */

SendEmitter.prototype._send = function (data) {
	if (this.serializer) {
		this.serializer.write(data);
	} else {
		this.queue.push(this._send.bind(this, data));
	}
};
