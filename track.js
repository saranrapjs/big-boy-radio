var config = require('./config'),
	scp = require('scp');

//convenience filenamer getter
String.prototype.filename = function() {
	return this.toString().replace(/^.*[\\\/]/, '');
}
String.prototype.ms2mn = function() {
  var s = Math.floor(parseInt(this.toString()) / 1000);
  return Math.floor(s / 60);
}
Date.prototype.iso = function(){
 function pad(n){return n<10 ? '0'+n : n};
 return this.getFullYear()+'-'
      + pad(this.getMonth()+1)+'-'
      + pad(this.getDate())+'T'
      + pad(this.getHours())+':'
      + pad(this.getMinutes())+':'
      + pad(this.getSeconds())+'Z'
}

var track = function(data) {
	if (!data) data = {};
	for (var i in data) {
		if (i == 'dateAdded') data[i] = new Date(data[i]);
		this[i] = data[i];
	}
}
track.prototype.import = function(data) {
  this.name = data.Name;
  this.type = data['Track Type'];
  this.artist = data.Artist;
  this.duration = data['Total Time']; 
  this.dateAdded = new Date(data['Date Added']);
  this.path = decodeURIComponent(data.Location.replace('file://localhost',''));
  this.local = config.path + this.path.filename();
}
track.prototype.shouldAdd = function( startDate ) {
	console.log(this.duration.ms2mn() < 30 && /mp4|m4a|m4v/gi.test(this.local) !== true);
  return (this.type === 'File' && this.dateAdded < startDate ) ? true : false;
}
track.prototype.date = function() {
	var monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
	return monthNames[this.dateAdded.getMonth()] + " " + this.dateAdded.getDate() + ", " + this.dateAdded.getFullYear();
}
track.prototype.readable = function() {
  return this.name + " / " + this.artist + " (" + this.duration.ms2mn() + "m, " + this.date() + ")";
}
track.prototype.transfer = function(callback) {
	scp.get({
		file:"\""+this.path.replace(/(["\s'$`\\\()])/g,'\\$1')+"\"",
		user: config.user,
		host: config.host,
		port: config.port,
		path: config.path
	},function(err){
		if (err) {
			console.log("tranfser error!");
			callback(false);
		} else {
			callback(true);			
		}
	});
}
track.prototype.export = function() {
	return [this.name,this.type,this.artist,this.duration,this.dateAdded.iso(),this.path,this.local];
}
exports.track = track;