var mpg = require('mpg123'),
	scp = require('scp'),
	fs = require('fs'),
	track = require('./track').track,
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('library.db'),
	config = require('./config');

Date.prototype.iso = function(){
 function pad(n){return n<10 ? '0'+n : n};
 return this.getFullYear()+'-'
      + pad(this.getMonth()+1)+'-'
      + pad(this.getDate())+'T'
      + pad(this.getHours())+':'
      + pad(this.getMinutes())+':'
      + pad(this.getSeconds())+'Z'
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
			.play(this.list[position].local)
			.on('error',function(error) { console.log(error); })
			.on('end', function () {
				player.close();
				console.log('track ended')
				self.position++;
				if (self.list[self.position]) {
					console.log('next track')
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
	console.log('cleaning up');
	this.list.forEach(function(t) {
		console.log(t.local);
		fs.unlinkSync(t.local);
	});
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
	load:function() {
		var self = this;
		this.getLibrary
		this.import(function(data) {
			self.current = new playlist(data);
			self.current.start().onFinish(function() {
				self.current.cleanup();
				console.log('starting over');
				self.load();
			});
		})
	},
	lists:[],
	import:function(callback) {
		console.log("Reading in library");
		var tracks = [],
			startDate;
		db.get("SELECT * FROM library ORDER BY RANDOM() LIMIT 1;",function(err,row) {
			startDate = new Date(row.dateAdded);
			//console.log("select * from library where julianday(dateAdded) < julianday('"+startDate.iso()+"') order by julianday(dateAdded) desc limit 100;");
			db.each("select * from library where julianday(dateAdded) < julianday('"+startDate.iso()+"') order by julianday(dateAdded) desc limit 100;",
			function(err,row) {
				if (!err) tracks.push(row);
			},
			function() {
				console.log(tracks.length+" total tracks")
				var added = [],
					setDuration = 0,
					maxInMinutes = config.length,
					i = tracks.length-1;
				console.log('Importing Library ...');

				while ( ms2mn(setDuration) < maxInMinutes) {
					var t = new track(tracks[ i ]);
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
				callback({
					list:added,
					ending:startDate,
					beginning:beginning
				});
			});
		});
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