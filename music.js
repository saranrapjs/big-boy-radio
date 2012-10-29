var mpg = require('mpg123'),
	scp = require('scp'),
	plist = require('plist'),
	config = require('./config');

//convenience filenamer getter
String.prototype.filename = function() {
	return this.toString().replace(/^.*[\\\/]/, '');
}
// milliseconds 2 minutes
var ms2mn = function(ms) {
  var s = Math.floor(ms / 1000);
  return Math.floor(s / 60);
}

// general purpose time converter
var convertMS = function(ms) {
  var d, h, m, s;
  s = Math.floor(ms / 1000);
  m = Math.floor(s / 60);
  s = s % 60;
  h = Math.floor(m / 60);
  m = m % 60;
  d = Math.floor(h / 24);
  h = h % 24;
  return { d: d, h: h, m: m, s: s };
};

// random date between two dates
var randomDate = function(start, end) {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

var track = function(data) {
  this.name = data.Name;
  this.type = data['Track Type'];
  this.artist = data.Artist;
  this.duration = data['Total Time']; 
  this.dateAdded = new Date(data['Date Added']);
  this.path = decodeURIComponent(data.Location.replace('file://localhost',''));
  this.local = config.path + this.path.filename();
}
track.prototype.shouldAdd = function( startDate ) {
  return (this.type === 'File' && this.duration && this.duration < 60000 && this.dateAdded < startDate ) ? true : false;
}
track.prototype.date = function() {
	var monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
	return monthNames[this.dateAdded.getMonth()] + " " + this.dateAdded.getDate() + ", " + this.dateAdded.getFullYear();
}
track.prototype.readable = function() {
  return this.name + " / " + this.artist + " (" + ms2mn(this.duration) + "m, " + this.date() + ")";
}
track.prototype.transfer = function(callback) {
	scp.get({
		file:"\""+this.path.replace(/(["\s'$`\\\()])/g,'\\$1')+"\"",
		//file: "\"/Users/jeffsisson/Music/iTunes/iTunes Music/Erykah Badu/Baduizm/05 Sometimes (mix#9).mp3\"".replace(/(["\s'$`\\\()])/g,'\\$1'), // remote file to grab
		user: 'jeffsisson',   // username to authenticate as on remote system
		host: 'localhost',   // remote host to transfer from, set up in your ~/.ssh/config
		port: '22',         // remote port, optional, defaults to '22'
		path: config.path           // local path to save to (this would result in a ~/file.txt on the local machine)
	},function(err){
		if (err) {
			console.log("tranfser error!");
			callback(false);
		} else {
			callback(true);			
		}
	});
}

var playlist = function(obj) {
	for (var i in obj) this[i] = obj[i];
	this.position = 0;
	this.successfullyTransferred = 0;
	this.allTransfers = 0;
}
playlist.prototype.play = function(position) {
	console.log("Playing: "+this.list[position].readable());
	var self = this,
		player = new mpg()
			.play(this.list[position].path)
			.on('end', function () {
				self.position++;
				if (self.list[self.position]) {
					self.play(self.position);
				} else {
					console.log('playlist finished!')
					if (self.finish) self.finish();
				}
			});
}
playlist.prototype.onFinish = function(callback) {
	this.finish = callback;
	return this;
}
playlist.prototype.transferCheck = function( success ) {
	if (success === true) this.successfullyTransferred++;
	this.allTransfers++;
	if (this.allTransfers == this.list.length) {
		console.log('Transfers finished!');
		if (this.transferCallback) this.transferCallback();
	}
}
playlist.prototype.transfer = function(callback) {
	var self = this;
	this.transferCallback = callback;
	this.list.forEach(function(t) {
		t.transfer(function(success) { self.transferCheck(success); });
	});
}
playlist.prototype.start = function(filename) {
	var self = this;
	this.transfer(function() {
		self.play(self.position);
	})
	return this;
}
playlist.prototype.cleanup = function() {

}
playlist.prototype.current = function() {
	return this.list[this.position];
}
playlist.prototype.reverse = function() {
	return this.list.slice(0).splice(0,this.position+1).reverse();
}

var music = {
	current:{
		list:[]
	},
	playlist:function() {
		return this.current;
	},
	getLibrary:function(callback) {
		console.log('transferring library file...');
		scp.get({
			file:"\"~/Music/iTunes/iTunes\\ Music\\ Library.xml\"",
			user: 'jeffsisson',   // username to authenticate as on remote system
			host: 'localhost',   // remote host to transfer from, set up in your ~/.ssh/config
			port: '22',         // remote port, optional, defaults to '22'
			path: "\"./iTunes\ Music\ Library.xml\""          // local path to save to (this would result in a ~/file.txt on the local machine)
		},function(err){
			if (err) {
				console.log("Couldn't transfer iTunes library xml!");
			} else {
				console.log('library transfer complete')
				callback();
			}
		});
	},
	load:function() {
		var self = this;
		this.getLibrary(function() {
			self.current = new playlist(self.import());
			self.current.start().onFinish(function() {
				console.log('starting over')
				self.load();
			});
		})
	},
	lists:[],
	import:function() {
		console.log("reading in library");
		var added = [],
			dict = plist.parseFileSync('iTunes\ Music\ Library.xml');
			tracks = dict['Tracks'],
			keys = Object.keys( tracks ),
			first = new Date(tracks[ keys[0] ]['Date Added']),
			last = new Date(tracks[ keys[keys.length-1] ]['Date Added']),
			startDate = randomDate(first,last),
			setDuration = 0,
			maxInMinutes = 5,
			i = keys.length-1;
		console.log('Importing Library from '+first+" to "+last);
		while ( ms2mn(setDuration) < maxInMinutes) {
			var t = new track(tracks[ keys[ i ] ]);
			if ( t.shouldAdd( startDate ) === true) {
				console.log( t.readable() );
				added.push(t);
				setDuration += parseInt(t.duration);
			}
			i--;
		}
		var beginning = added[added.length-1].dateAdded;
		console.log('Beginning: '+added[0].date()+' ending: '+added[added.length-1].date() );
		console.log("Total: "+ms2mn(setDuration) + "m");
		return {
			list:added,
			ending:startDate,
			beginning:beginning
		}
	}
}

music.load();
exports.playlist = function() {
	return music.playlist();
};


// walk(process.env.HOME+"/Music/iTunes/iTunes\ Music", function(err, results) {
//   if (err) throw err;
//   console.log(results);
// });