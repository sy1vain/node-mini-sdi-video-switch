var util	= require('util'),
	net		= require('net'),
	events	= require('events'),
	extend 	= require('extend');

var SDI = function(options){
	this._options = extend(true, {host: 'localhost', port: 40}, options);

	this._reset();
	this._connect();
}
util.inherits(SDI, events.EventEmitter);

var proto = SDI.prototype;


proto.route = function(input, output, cb){
	var cmd = 'X' + output + ',' + input;
	this._addCommand({
		cmd: cmd,
		cb: cb
	});
	this._queryStatus();
}

proto.getRoutes = function(){
	return this._routes;
}

proto.getRouteTo = function(out){
	for(var i=0; i<this._routes.length; i++){
		if(this._routes[i].to == out) return this._routes[i];
	}
	return null;
}

proto.isConnected = function(){
	return this._connected;
}

proto._handleData = function(data){
	if(!this._currentCommand) return this._sendNext();

	var cmd = this._currentCommand;
	this._currentCommand = null;

	if(cmd.cb){
		if(data.length==0){
			cmd.cb();
		}else{
			try{
				cmd.cb(null, JSON.parse(data));
			}catch(e){
				cmd.cb(new Error(data));
			}
		}
	}

	this._sendNext();
}


proto._reset = function(){
	clearTimeout(this._queryTimer);
	this._connected = false;
	this._connection = null;
	this._data = '';
	this._commands = [];
	this._currentCommand = null;
	this._routes = [];
}

proto._connect = function(){
	this._connection = net.connect({port: this._options.port, host: this._options.host});
	this._connection.on('connect', this._onConnect.bind(this));
	this._connection.on('data', this._onData.bind(this));
	this._connection.on('error', this._onError.bind(this));
	this._connection.on('close', this._onClose.bind(this));
	this._connection.on('timeout', this._onTimeout.bind(this));
}

proto._onConnect = function(){
	this._connected = true;
	this._queryStatus();
	this._queryTimer = setInterval(this._queryStatus.bind(this), 1000);
	this.emit('connect');
}

proto._queryStatus = function(){
	clearTimeout(this._queryTimer);
	this._addCommand({cmd: 'MtxCfg7', cb: this._updateStatus.bind(this)});
}

proto._sendCommand = function(cmd){
	if(!cmd) return;
	if(!this._connection){
		if(cmd.cb){
			cmd.cb(new Error('Not connected'));
		}
		return this._sendNext();
	}
	this._currentCommand = cmd;
	this._connection.write(cmd.cmd + '\r');
}

proto._onData = function(data){

	this._data += data.toString();

	var index = this._data.indexOf('>');
	if(index==-1) return;

	var data = this._data.substr(0,index);
	this._data = this._data.substr(index+1);

	data = data.trim();

	this._handleData(data);
}

proto._onError = function(err){
}

proto._onClose = function(){
	this._reset();
	this.emit('close');
	setTimeout(this._connect.bind(this), 500);
}

proto._onTimeout = function(){
}

proto._addCommand = function(cmd){
	this._commands.push(cmd);
	this._sendNext();
}

proto._sendNext = function(){
	if(this._currentCommand) return;

	if(this._commands.length==0) return;
	this._sendCommand(this._commands.shift());
}

proto._updateStatus = function(err, data){
	this._queryTimer = setTimeout(this._queryStatus.bind(this), 1000);

	if(!data || typeof data != 'object') return;

	if(!data.hasOwnProperty('levels')) return;

	var oldRoutes = this._routes;

	this._routes = [];
	for(var i=0; i<data.levels.length; i++){
		var level = data.levels[i];
		for(var s=0; s<level.state.length; s++){
			var route = {to: s+1, from: level.state[s]}
			this._routes.push(route);
		}
	}

	if(JSON.stringify(oldRoutes)!=JSON.stringify(this._routes)){
		this.emit('change', this.getRoutes());
	}

}



module.exports = SDI;
