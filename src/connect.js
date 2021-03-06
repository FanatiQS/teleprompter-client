'use strict';



// Create new Project connection to the server
function Project(inp1, inp2, socket) {
	// Make work with or without 'new' operator
	if (!(this instanceof Project)) return new Project(inp1, inp2, socket);



	// Create new websocket if it is not supplied in arguments
	if (!socket) {
		// Get websocket 'protocol' to use with websocket connection
		var url = (inp1 && inp1.host) || (inp2 && inp2.host) || document.URL;
		var separator = url.indexOf('://');
		var protocol = url.slice(0, Math.max(0, separator)).replace('http', 'ws') || 'ws';

		// Error handling for if 'protocol' is not 'ws' or 'wss'
		if (protocol !== 'ws' && protocol !== 'wss') {
			throw "Invalid protocol for websocket: " + protocol;
		}

		// Create new websocket connection
		socket = new WebSocket(protocol + '://' + ((separator !== -1) ? url.slice(separator + 3) : url));
	}

	// Link to 'socket' for prototypes
	this._socket = socket;



	// Use 'inp1.id', 'inp1' or null as 'id'
	this.id = ((inp1 && typeof inp1 === 'object') ? inp1.id : inp1) || null;

	// Error handling for if 'id' is defined but not a string
	if (this.id && typeof this.id !== 'string') {
		throw TypeError("Type for 'id' needs to be a string: " + typeof this.id);
	}






	// Reach 'this' inside event handlers
	var self = this;

	// Buffer data for server until connection is open
	this._buffer = [function () {
		// Send authentication data to server
		this.tx({
			id: this.id,
			pwd: (typeof inp2 === 'string') ? inp2 : (inp1 && inp1.pwd) || (inp2 && inp2.pwd),
			init: (inp1 && inp1.init) || (inp2 && inp2.init || undefined)
		});
	}];






	// Initialize when socket opens
	socket.onopen = this.open;

	// Initialize already opened sockets
	if (socket.readyState === 1) this.onopen();

	// Terminate client on socket error
	socket.onerror = function () {
		console.log("Error in socket connection, closing client");
		self.close();
	}

	// Handle incoming messages from 'socket'
	socket.onmessage = function (event) {
		self.message(event.data);
	};

	// Handle close request from 'socket'
	socket.onclose = function () {
		self.close();
	};

// Run buffered functions when connection to server is established
Project.prototype.open = function () {
	for (var i = 0; i < this._buffer.length; i++) {
		this._buffer[i].call(this);
		delete this._buffer[i];
	}
};


	// All connected documents for this project
	this.docs = {};

	// This connections ID on the server
	this.serverID = null;

	// Event listeners
	this.onServerError = null;
	this.onAuthError = null;
}

// Handle incoming messages
Project.prototype.message = function (data) {
	// Parse 'data' object and abort if undefined or false
	try {
		var obj = ((typeof data === 'string') ? JSON.parse(data) : data).Zayght;
		if (!obj) return;
	}
	// Error handling for parse error
	catch (err) {
		console.error("Error parsing data from the server", err);//!!
		return;
	}

	// Message for a document
	if (obj.doc) {
		this.docs[obj.doc.id]._rx(obj.doc);
	}
	// Authentication successfull
	else if (obj.authed) {
		this.id = obj.authed.id;
		this.serverID = obj.authed.serverID;
	}
	// Authentication error
	else if (obj.authErr) {
		if (this.onAuthError) {
			this.onAuthError(obj.authErr);
		}
		else {
			console.error("AUTHENTICATION ERROR:", obj.authErr.message);
		}
	}
	// Server error messages related to this connection
	else if (obj.err) {
		if (this.onServerError) {
			this.onServerError(obj.err);
		}
		else {
			console.error("SERVER ERROR:", obj.err.message)
		}
	}
};

// Transmit object stringified to the server
Project.prototype.tx = function (obj) {
	try {
		this._socket.send(JSON.stringify({Zayght: obj}));
	}
	catch (err) {
		err.data = obj
		console.error("Error sending data to the server:", err);//!!
	}
};
