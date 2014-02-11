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
	this.queues = {
		control: [],
		payload: [],
	};

	// Handle ready state
	var ready = false;
	// FIXME(bnoordhuis) Setter with far ranging side effects, questionable.
	this.__defineSetter__('ready', function (v) {
		ready = v;
		if (ready) {
			dequeue(this.queues.control);
			dequeue(this.queues.payload);
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
	this._send(['_set', key, val], {
		control: true,
		enableAcks: false,  // Suspect but backwards compatible.
	});
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
	this._send(['_set', this.session], {
		control: true,
		enableAcks: false,  // Suspect but backwards compatible.
	});
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
			var ack = { args: ['ack::' + args.id] };
			ev._send(ack, { control: true, enableAcks: false });
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
	dequeue(this.queues.control);
	dequeue(this.queues.payload);
};

SendEmitter.prototype.send = function () {
	return this._send([].slice.call(arguments));
}

SendEmitter.prototype._send = function (args, options) {
	var ev = this;

	options = options || {};
	options = Object.keys(options).reduce(function (acc, key) {
		return acc[key] = options[key], acc;
	}, {
		control: false,
		enableAcks: ev.enableAcks,
		objectMode: ev.objectMode,
	});

	var queue = options.control ? ev.queues.control : ev.queues.payload;

	// Pop the last argument off of the argument list to act as the callback
	// NOTE: Do this here to ensure ACK callbacks get ignored by old servers
	var cb = (typeof args[args.length - 1] === 'function')
		? args.pop()
		: function () {};

	function withAck (data) {
		// In the event of a message not being acknowledged,
		// we should requeue the message with modified ACK id.
		function requeue () {
			queue.push(ev._send.bind(ev, data));
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

	var data = args;
	if (options.objectMode) {
		data = { args: args };
		if (options.control) {
			data.control = true;
		}
		if (options.enableAcks) {
			data = withAck(data);
		}
	}

	if (ev.serializer) {
		ev.serializer.write(data);
		cb();
	} else {
		queue.push(function () {
			ev.serializer.write(data);
			cb();
		});
	}
};

function dequeue (queue) {
	// Make a copy and clear the original.  If we'd operate on the original
	// and something pushes itself back onto the queue, that will result in
	// an infinite loop.
	var copy = queue.splice(0, queue.length);
	while (copy.length > 0) {
		copy.shift()();
	}
}
