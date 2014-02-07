var Uhura = require('../');
var assert = require('assert');
var tls = require('tls');

function after (t, fn) {
	return function () {
		t-- && t == 0 && fn();
	}
}

describe('basics', function () {
	this.timeout(5000);

	var s, c, server;
	beforeEach(function (next) {
		var done = after(1, next);
		server = Uhura.createServer(function (socket) {
			s = socket;
			done();
		});
		server.listen(0, '127.0.0.1', function () {
			c = Uhura.createClient({
				host: this.address().address,
				port: this.address().port,
			});
		});
	});

	afterEach(function (next) {
		server.close(next);
		c.disconnect();
	});

	it('should connect to server', function (next) {
		c.once('connect', function () { next(); });
	});

	it('should receive server events', function (next) {
		c.once('ping', next);
		s.send('ping');
	});

	it('should receive client events', function (next) {
		s.once('ping', next);
		c.send('ping');
	});

	it('should emit disconnect on socket.destroy()', function (next) {
		c.once('disconnect', next);
		s.socket.destroy();
	});

	it('should log errors when enabled', function (next) {
		c.logErrors = true;
		var oldError = console.error;
		console.error = function () {
			next();
			console.error = oldError;
		};
		c.socket.emit('error', new Error('This is an error'));
		s.socket.destroy();
	});

	it('should not crash on malformed JSON', function (next) {
		s.on('error', function (err) {
			assert(/Unexpected "." at position/.test(err.message));
			next();
		});
		c.socket.write('.');
	});

	it('should flush on disconnect', function (next) {
		s.once('ping', function () { next() });
		c.once('connect', function () {
			c.send('ping', Array(1 << 20).join('.'));
			c.disconnect();
		});
	});

	it('should support TLS', function (next) {
		// Ideally, we'd use something like AECDH-NULL-SHA here but
		// node.js v0.10 doesn't support no-auth/no-enc ciphers...
		// See https://github.com/joyent/node/issues/6887
		var cert = '-----BEGIN CERTIFICATE-----\n' +
			'MIIBfjCCASgCCQDmmNjAojbDQjANBgkqhkiG9w0BAQUFADBFMQswCQYDVQQGEwJB\n' +
			'VTETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0\n' +
			'cyBQdHkgTHRkMCAXDTE0MDExNjE3NTMxM1oYDzIyODcxMDMxMTc1MzEzWjBFMQsw\n' +
			'CQYDVQQGEwJBVTETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJu\n' +
			'ZXQgV2lkZ2l0cyBQdHkgTHRkMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAPKwlfMX\n' +
			'6HGZIt1xm7fna72eWcOYfUfSxSugghvqYgJt2Oi3lH+wsU1O9FzRIVmpeIjDXhbp\n' +
			'Mjsa1HtzSiccPXsCAwEAATANBgkqhkiG9w0BAQUFAANBAHOoKy0NkyfiYH7Ne5ka\n' +
			'uvCyndyeB4d24FlfqEUlkfaWCZlNKRaV9YhLDiEg3BcIreFo4brtKQfZzTRs0GVm\n' +
			'KHg=\n' +
			'-----END CERTIFICATE-----';
		var key = '-----BEGIN RSA PRIVATE KEY-----\n' +
			'MIIBPQIBAAJBAPKwlfMX6HGZIt1xm7fna72eWcOYfUfSxSugghvqYgJt2Oi3lH+w\n' +
			'sU1O9FzRIVmpeIjDXhbpMjsa1HtzSiccPXsCAwEAAQJBAM4uU9aJE0OfdE1p/X+K\n' +
			'LrCT3XMdFCJ24GgmHyOURtwDy18upQJecDVdcZp16fjtOPmaW95GoYRyifB3R4I5\n' +
			'RxECIQD7jRM9slCSVV8xp9kOJQNpHjhRQYVGBn+pyllS2sb+RQIhAPb7Y+BIccri\n' +
			'NWnuhwCW8hA7Fkj/kaBdAwyW7L3Tvui/AiEAiqLCovMecre4Yi6GcsQ1b/6mvSmm\n' +
			'IOS+AT6zIfXPTB0CIQCJKGR3ymN/Qw5crL1GQ41cHCQtF9ickOq/lBUW+j976wIh\n' +
			'AOaJnkQrmurlRdePX6LvN/LgGAQoxwovfjcOYNnZsIVY\n' +
			'-----END RSA PRIVATE KEY-----';
		var options = {
			cert: cert,
			ciphers: 'NULL-MD5',
			createServer: tls.createServer,
			key: key
		};
		Uhura.createServer(options, function (c) {
			c.on('ping', next);
		}).listen(0, '127.0.0.1', function () {
			var options = {
				ciphers: 'NULL-MD5',
				host: this.address().address,
				port: this.address().port,
				rejectUnauthorized: false  // Self-signed cert
			};
			options.createConnection = function (options, cb) {
				cb(null, tls.connect(options));
			};
			Uhura.createClient(options).send('ping');
		});
	});

	it('should send acknowledgements', function (next) {
		c.send('ping', next);
	});
});
