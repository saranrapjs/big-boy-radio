var plistParser = require("node_modules/sax/lib/sax.js").parser(false, {lowercasetags:true, trim:true}),
  sys = require("sys"),
  fs = require("fs");

function entity (str) {
  return str.replace('"', '&quot;');
}

plistParser.getInteger = function (string) {
    this.value = parseInt(string, 10);
}
plistParser.getString = function (string) {
    this.value = string;
}
plistParser.getData = function(string) {
    // todo: parse base64 encoded data
    this.value = string;
}
plistParser.getDate = function (string) {
    this.value = new Date(string);
}

plistParser.addToDict = function (value) {
    this.dict[this.key] = value;
}
plistParser.addToArray = function (value) {
    this.array.push(value);
}

plistParser.stack = [ ];
plistParser.context = {
    callback: function (value) {
//        console.log('value:', value);
    },
    value: function() {},
    setKey: function(key) {},
    setValue: function(value) {
        this.callback(null, value);
    },
}
plistParser.onopentag = function (tag) {
    switch (tag.name) {
    case 'plist':
        break;
    case 'dict':
        this.stack.push(this.context);
        this.context = {
            value: function() {
                return this.dict;
            },
            dict: {},
            setKey: function(key) {
                this.key = key;
            },
            setValue: function(value) {
                this.dict[this.key] = value;
            }
        }
        break;
    case 'array':
        this.stack.push(this.context);
        this.context = {
            value: function() {
                return this.array;
            },
            array: [],
            setKey: function(key) {
                console.log('unexpected <key> element in array');
            },
            setValue: function(value) {
                this.array.push(value);
            }
        }
        break;
    case 'key':
        this.ontext = function (text) {
            this.context.setKey(text);
        }
        break;
    case 'integer':
        this.ontext = this.getInteger;
        break;
    case 'string':
        this.ontext = this.getString;
        break;
    case 'data':
        this.ontext = this.getData;
        break;
    case 'true':
        this.value = true;
        break;
    case 'false':
        this.value = false;
        break;
    case 'date':
        this.ontext = this.getDate;
        break;
    default:
        console.log('ignored tag', tag.name);
        break;
    }
}
plistParser.onclosetag = function (tag) {
    var value;
    switch (tag) {
    case 'dict':
    case 'array':
        var value = this.context.value();
        this.context = this.stack.pop();
        this.context.setValue(value);
        break;
    case 'true':
    case 'false':
    case 'string':
    case 'integer':
    case 'date':
    case 'data':
        this.context.setValue(this.value);
        break;
    case 'key':
    case 'plist':
        break;
    default:
        console.log('closing', tag, 'tag ignored');
    }

}
plistParser.oncdata = function (data) {
    console.log('cdata not recognized');
}
plistParser.oncomment = function (comment) {
}
plistParser.onerror = function (error) {
  sys.debug(error);
  throw error;
}

exports.parse = function (xmlfile, callback) {
    fs.open(xmlfile, "r", 0666, function (er, fd) {
        if (er) callback(er);
        plistParser.context.callback = callback;
        (function R () {
            fs.read(fd, 1024, null, "utf8", function (er, data, bytesRead) {
                if (er) throw er;
                if (data) {
                    plistParser.write(data);
                    R();
                } else {
                    fs.close(fd);
                    plistParser.close();
                }
            });
        })();
    });
}