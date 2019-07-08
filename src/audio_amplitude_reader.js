'use strict';



// Create a new audio-amplitude-reader with audio input stream with deviceId 'id'
function AAR(promise) {
	this.onopen = promise.then((stream) => {
		// Create audiocontext and analyser
		this.context = new (window.AudioContext || window.webkitAudioContext)();
		this.analyser = new AnalyserNode(this.context, {fftSize: 32});
		this.data = new Float32Array(this.analyser.frequencyBinCount);
		this.stream = stream;
		this.intervalId = null;

		// Settings for reading amplitude
		this.prev = null;
		this.max = 128;
		this.out = 128;
		this.in = 0;

		// Connect stream to analyser
		this.context.createMediaStreamSource(stream).connect(this.analyser);
	});
};

// Get highest amplitude if it has changed
AAR.prototype.get = function (callback) {
	// Get amplitude mapped linearly to settings in and out points
	this.analyser.getFloatTimeDomainData(this.data);
	let value = Math.floor(((Math.sqrt(Math.max(...this.data)) || 0) * this.max - this.in) / (this.out - this.in) * this.max);

	// Cut off values outside range
	if (value < 0) value = 0;
	if (value > this.max) value = this.max;

	// Abort if value has not changed since previous call
	if (value === this.prev) return;
	this.prev = value;

	// Run callback with 'value' and return 'this' for chainability
	callback(value);
	return this;
};

// Create interval loop when open and return 'this' for chainability
AAR.prototype.createLoop = function (callback, interval) {
	this.onopen.then(() => {
		this.intervalId = setInterval(this.get.bind(this, callback), interval);
	});
	return this;
};

// Close audio stream, audio context and interval loop
AAR.prototype.close = function () {
	this.stream.getTracks().forEach((track) => track.stop());
	this.context.close();
	clearInterval(this.intervalId);
};

// Listen to audio stream and return 'this' for chainability
AAR.prototype.listen = function () {
	this.onopen.then(() => this.analyser.connect(this.context.destination));
	return this;
};

// Stop listening to audio stream and return 'this' for chainability
AAR.prototype.mute = function () {
	this.onopen.then(() => this.analyser.disconnect());
	return this;
};



// Create a new audio-amplitude-reader for audio input with deviceID 'id' or default
function readAudioInputAmplitude(id) {
	return new AAR(navigator.mediaDevices.getUserMedia({
		audio: {
			deviceId: id,
			autoGainControl: false,
			echoCancellation: false,
			noiseSuppression: false
		},
		video: false
	})
	.catch((err) => {
		throw err;
	}));
};



/*
When using audio elements
	new AAR(new Promise((resolve) => {
		resolve(document.querySelector('audio').captureStream());
	}))
*/
