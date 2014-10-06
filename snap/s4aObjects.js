SpriteMorph.prototype.arduinoShowMessage = function(msg) {
	var sprite = this;

	if (!sprite.arduino.message) {
		sprite.arduino.message = new DialogBoxMorph();
	}
	
    var txt = new TextMorph(
        msg,
        this.fontSize,
        this.fontStyle,
        true,
        false,
        'center',
        null,
        null,
        MorphicPreferences.isFlat ? null : new Point(1, 1),
        new Color(255, 255, 255)
    );

    if (!sprite.arduino.message.key) {
        sprite.arduino.message.key = 'message' + sprite.name + msg;
    }

    sprite.arduino.message.labelString = sprite.name;
    sprite.arduino.message.createLabel();
    if (msg) {
        sprite.arduino.message.addBody(txt);
    }
    sprite.arduino.message.drawNew();
    sprite.arduino.message.fixLayout();
    sprite.arduino.message.popUp(world);
    sprite.arduino.message.show();
}

SpriteMorph.prototype.arduinoHideMessage = function(text) {
	var sprite = this;

	if (sprite.arduino.message) {
		sprite.arduino.message.cancel();
		sprite.arduino.message = null;
	}
}


SpriteMorph.prototype.arduinoAttemptConnection = function() {
	var sprite = this;

	if (!sprite.arduino.connecting) {
		if (sprite.arduino.board === undefined) {

			// Get list of ports (arduino compatible)
			var ports = world.arduino.getSerialPorts(function(ports) {
				
				var port;
				
				// Check if there is at least one port on ports object (which for some reason was defined as an array)
				if (Object.keys(ports).length == 0) {
					inform(sprite.name, localize('Could not connect an Arduino\nNo boards found'));
					return;
				} else if (Object.keys(ports).length == 1) {
					port = ports[Object.keys(ports)[0]]; //Choose the first compatible port
					sprite.arduinoConnect(port);
				} else if (Object.keys(ports).length > 1) { 
					var portMenu = new MenuMorph(this, 'select a port');
					Object.keys(ports).forEach(function(each) {
						portMenu.addItem(each, function() { 
							port = each;
							sprite.arduinoConnect(port);
						})
					});
					portMenu.popUpAtHand(world);		
				}

			});
		} else {
			inform(sprite.name, localize('There is already a board connected to this sprite'));
		}
	}

	if (sprite.arduino.justConnected) {
		sprite.arduino.justConnected = undefined;
		return;
	}

}

SpriteMorph.prototype.arduinoConnect = function(port) {
	
	var sprite = this;

	sprite.arduinoShowMessage("Connecting board at port\n"+port);
	sprite.arduino.connecting = true;

	sprite.arduino.board = new world.arduino.firmata.Board(port, function(err) { 
		if (!err) { 
			var disconnectionAction = function() {
				sprite.arduino.disconnected = true;
				var port = sprite.arduino.board.sp.path;
			}
			
			var closeAction = function() {
				var port = sprite.arduino.board.sp.path;

				sprite.arduino.board.removeListener('disconnect', disconnectionAction);
				sprite.arduino.board.removeListener('close', closeAction);
				sprite.arduino.board.removeListener('error', errorAction);
				world.arduino.unlockPort(sprite.arduino.port);
				sprite.arduino.connecting = false;

				//Following is a trick to keep oldboards alive in case of conflict with pending processes
				if (!sprite.arduino.oldboards) {sprite.arduino.oldboards = []};
				sprite.arduino.oldboards.push(sprite.arduino.board);

				sprite.arduino.board = undefined;

				if (sprite.arduino.disconnected) {
					inform(sprite.name, localize('Board was disconnected from port\n')+port+'\n\nIt seems that someone pulled the cable!');
					sprite.arduino.disconnected = false;
				} else {
					inform(sprite.name, localize('Board was disconnected from port\n')+port);
				}
			}
						
			var errorAction = function(err) {
				inform(sprite.name, localize('An error was detected on the board\n\n')+err)
			}
						
			sprite.arduino.board.sp.on('disconnect', disconnectionAction);
			sprite.arduino.board.sp.on('close', closeAction);
			sprite.arduino.board.sp.on('error', errorAction);

			world.arduino.lockPort(port);
			sprite.arduino.port = sprite.arduino.board.sp.path;
			sprite.arduino.connecting = false;
			sprite.arduino.justConnected = true;
			sprite.arduino.board.connected = true;

			sprite.arduinoHideMessage();
			inform(sprite.name, localize('An Arduino board has been connected. Happy prototyping!'));   
		} else {
			sprite.arduinoHideMessage();
			inform(sprite.name, localize('Error connecting the board.')+' '+err);
		}
		return;
	});

	// Set timeout to check if device does not speak firmata (in such case new Board callback was never called, but board objects exists) 
	setTimeout(function() {
		// If board.versionReceived = false, the board has not established a firmata connection
		if (sprite.arduino.board && !sprite.arduino.board.versionReceived) {
			var port = sprite.arduino.board.sp.path;

			sprite.arduinoHideMessage();
			inform(sprite.name, localize('Could not talk to Arduino in port\n')+port+ '\n\n'+localize('Check if firmata is loaded.'))
							
			// Close the board connection
			sprite.arduino.board.sp.close();
			world.arduino.unlockPort(sprite.arduino.port);
			sprite.arduino.connecting = false;
							
			//Following is a trick to keep oldboards alive in case of conflict with pending processes
			if (!sprite.arduino.oldboards) {sprite.arduino.oldboards = []};
			sprite.arduino.oldboards.push(sprite.arduino.board);

			sprite.arduino.board = undefined;
		}
	}, 20000)
}

SpriteMorph.prototype.arduinoDisconnect = function() {
	var sprite = this;

	if (sprite.arduino.board) {
		sprite.arduino.board.sp.close();
	} else {
		inform(sprite.name, localize('Board is not connected'))
	}
}

// Definition of a new Arduino Category

SpriteMorph.prototype.categories.push('arduino');
SpriteMorph.prototype.blockColor['arduino'] = new Color(64, 136, 182);

SpriteMorph.prototype.originalInitBlocks = SpriteMorph.prototype.initBlocks;

SpriteMorph.prototype.initBlocks = function() {
	
	this.originalInitBlocks();

	this.blocks.reportAnalogReading = 
	{
		only: SpriteMorph,
       	type: 'reporter',
        category: 'arduino',
        spec: 'analog reading %analogPin'
	};

	this.blocks.reportDigitalReading = 
	{
		only: SpriteMorph,
        type: 'reporter',
		category: 'arduino',
		spec: 'digital reading %digitalPin',
	};

	this.blocks.connectArduino =
	{
		only: SpriteMorph,
		type: 'command',
		category: 'arduino',
		spec: 'connect arduino at %port'
	};

	this.blocks.setPinMode =
	{
		only: SpriteMorph,
		type: 'command',
		category: 'arduino',
		spec: 'setup digital pin %digitalPin as %pinMode'
	};

	this.blocks.digitalWrite =
	{
		only: SpriteMorph,
		type: 'command',
		category: 'arduino',
		spec: 'set digital pin %digitalPin to %b'
	};

	this.blocks.servoWrite =
	{
		only: SpriteMorph,
		type: 'command',
		category: 'arduino',
		spec: 'set servo %servoPin to %servoValue'
	};

	this.blocks.pwmWrite =
	{
		only: SpriteMorph,
		type: 'command',
		category: 'arduino',
		spec: 'set PWM pin %pwmPin to %n'
	};

}

// blockTemplates proxy

SpriteMorph.prototype.originalBlockTemplates = SpriteMorph.prototype.blockTemplates;

// Definition of our new primitive blocks

SpriteMorph.prototype.blockTemplates = function(category) {
	var myself = this;

	var blocks = myself.originalBlockTemplates(category); 

	if (!this.arduino) {
		this.arduino = {
			board : undefined,		// Reference to arduino board - to be created by new firmata.Board()
			connecting : false,		// Mark to avoid multiple attempts to connect
			justConnected: false,	// Mark to avoid double attempts
		};
	}

	//  Button that triggers a connection attempt 

    var arduinoConnectButton = new PushButtonMorph(
            null,
            function () {
                myself.arduinoAttemptConnection();
            },
            'Connect Arduino'
    );

    //  Button that triggers a disconnection from board

    var arduinoDisconnectButton = new PushButtonMorph(
            null,
            function () {
                myself.arduinoDisconnect();;
            },
            'Disconnect Arduino'
    );

	function blockBySelector(selector) {
		console.log(selector);
        var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
        newBlock.isTemplate = true;
        return newBlock;
    };

	if (category === 'arduino') {
		blocks.push(arduinoConnectButton);
        blocks.push(arduinoDisconnectButton);
		blocks.push('-');
        blocks.push(blockBySelector('setPinMode'));
		blocks.push('-');
        blocks.push(blockBySelector('servoWrite'));
        blocks.push(blockBySelector('digitalWrite'));
        blocks.push(blockBySelector('pwmWrite'));
		blocks.push('-');
        blocks.push(blockBySelector('reportAnalogReading'));
        blocks.push(blockBySelector('reportDigitalReading'));
	};

	return blocks;
}
