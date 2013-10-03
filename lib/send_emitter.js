var events = require('events')
	, JSONStream = require('JSONStream')
	, util = require('util')
	, Acks = require('./ack');

/**
 * Basic event emitter that interacts with a stream
 */

function SendEmitter () {
	events.EventEmitter.call(this);

	// Handle ready state
	var ready = false;
	this.buffer = [];
	this.__defineSetter__('ready', function (v) {
		var step;
		ready = v;
		if (ready) {
			while (step = this.buffer.shift()) step();
		}
	});
	this.__defineGetter__('ready', function () {
		return ready;
	});

	// Create queue
	this.queue = [];
	this.maxQueueLength = Infinity;

	// Maintain an active ack list
	this.acks = new Acks();

	// Handle shared session store data
	this.session = {};
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
	this.emit('_set', key, val);
	this._send({ args: ['_set', key, val] });
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
	this._send({ args: ['_set', this.session] });
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
		// Send acks on messages that are, themselves, not acks
		if (args.id) ev._send({ args: ['ack::' + args.id] });
		ev.emit.apply(ev, args.args);
	});

	// Attach stream
	this.stream = stream;

	// Start pipes
	this.serializer.pipe(stream).pipe(this.parser);
};

/**
 * Queue event to be sent to the server
 *
 * @param {string} [eventName] [Name of event to emit on the server]
 * @param {mixed}  [...]       [All following arguments are passed to receiver]
 */

SendEmitter.prototype.send = function () {
	var args = Array.prototype.slice.call(arguments);
	var cb = (typeof args[args.length - 1] === 'function')
		? args.pop()
		: function () {};

	// Create ack listener
	var ack = this.acks.create(cb);
	this.once('ack::' + ack.id, function () {
		this.removeListener('disconnect', requeue);
		this.acks.resolve(ack.id);
	});

	var ev = this;
	function requeue () {
		if (ev.buffer.length > ev.maxQueueLength) {
			console.warn('Uhura exceeded maximum queue length, released stale data');
			ev.buffer.shift();
		}
		ev.buffer.push(function () {
			ev._send({ id: ack.id, args: args });
		});
	}
	this.once('disconnect', requeue);

	if (this.ready) {
		return this._send({ id: ack.id, args: args });
	}

	requeue();
};

/**
 * Explicitly send data, regardless of ready state
 *
 * @param {string} [eventName] [Name of event to emit on the server]
 * @param {mixed}  [...]       [All following arguments are passed to receiver]
 */

SendEmitter.prototype._send = function (data) {
	this.serializer.write(data);
};
