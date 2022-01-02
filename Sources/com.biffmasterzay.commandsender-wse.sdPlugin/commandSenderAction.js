var websocket = null;
var pluginUUID = null;
var settingsCache = {};
var webSocketInitialized = false;
var commandSenderWebSocket = null;

var DestinationEnum = Object.freeze({ "HARDWARE_AND_SOFTWARE": 0, "HARDWARE_ONLY": 1, "SOFTWARE_ONLY": 2 })

var commandsenderAction = {

    type: "com.elgato.commandsender.action",

    onKeyDown: function (context, settings, coordinates, userDesiredState) {
        
        if (settings != null && settings.hasOwnProperty('ipaddress') && settings.hasOwnProperty('port') && settings.hasOwnProperty('commandPressed')) {
            ipAddress = settings["ipaddress"];
            port = settings["port"];
            commandPressed = settings["commandPressed"];

            if(!webSocketInitialized)
            {
                this.InitializeCommandSenderWebSocket(ipAddress, port);
            }
            
            this.SendMessage(commandPressed)
        }
    },

    onKeyUp: function (context, settings, coordinates, userDesiredState) {
        if (settings != null && settings.hasOwnProperty('ipaddress') && settings.hasOwnProperty('port') && settings.hasOwnProperty('commandReleased')) {
            ipAddress = settings["ipaddress"];
            port = settings["port"];
            commandReleased = settings["commandReleased"];

            if(!webSocketInitialized)
            {
                this.InitializeCommandSenderWebSocket(ipAddress, port);
            }
            
            this.SendMessage(commandReleased)
        }
    },

    onWillAppear: function (context, settings, coordinates) {

        var ipAddress = "";
        if (settings != null && settings.hasOwnProperty('ipaddress')) {
            ipAddress = settings["ipaddress"];
        }

        var port = "";
        if (settings != null && settings.hasOwnProperty('port')) {
            port = settings["port"];
        }

        var commandPressed = "";
        if (settings != null && settings.hasOwnProperty('commandPressed')) {
            commandPressed = settings["commandPressed"];
        }

        var commandReleased = "";
        if (settings != null && settings.hasOwnProperty('commandReleased')) {
            commandReleased = settings["commandReleased"];
        }

        if(!webSocketInitialized)
        {
            this.InitializeCommandSenderWebSocket(ipAddress, port);
        }

        settingsCache[context] = { 'port': port, 'ipaddress': ipAddress, 'commandPressed' : commandPressed, 'commandReleased' : commandReleased };
    },

    SetTitle: function (context, newValue) {
        var json = {
            "event": "setTitle",
            "context": context,
            "payload": {
                "title": "" + newValue,
                "target": DestinationEnum.HARDWARE_AND_SOFTWARE
            }
        };

        websocket.send(JSON.stringify(json));
    },

    SetSettings: function (context, settings) {
        var json = {
            "event": "setSettings",
            "context": context,
            "payload": settings
        };

        websocket.send(JSON.stringify(json));
    },

    AddToSettings: function (context, key, value) {
        settingsCache[context][key] = value;
    },

    SetSettingsWithCache: function (context, key, value) {
        settingsCache[context][key] = value;
        var json = {
            "event": "setSettings",
            "context": context,
            "payload": settingsCache[context]
        };

        websocket.send(JSON.stringify(json));
    },

    InitializeCommandSenderWebSocket: function(ipAddress, port){

        // Regular expression to check if string is a IP address
        const regexExpIpAddress = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
        
        // Regular expression to check if number is a valid port number
        const regexExpPort = /^((6553[0-5])|(655[0-2][0-9])|(65[0-4][0-9]{2})|(6[0-4][0-9]{3})|([1-5][0-9]{4})|([0-5]{0,5})|([0-9]{1,4}))$/gi;

        // String with IP address
        if(regexExpIpAddress.test(ipAddress) && regexExpPort.test(port))
        {
            try
            {
                commandSenderWebSocket = new WebSocket("ws://" + ipAddress +":" + port);
                commandSenderWebSocket.onclose = function () {
                    webSocketInitialized = false;
                }
                commandSenderWebSocket.onerror = function () {
                    webSocketInitialized = false;
                }
                webSocketInitialized = true;
            }
            catch
            {
                webSocketInitialized = false;
            }
            
        }
    },

    SendMessage: function(message){
        try
        {
            if (commandSenderWebSocket.readyState === WebSocket.OPEN) 
            {
                commandSenderWebSocket.send(message)
            } 
            else if (commandSenderWebSocket.readyState == WebSocket.CONNECTING) 
            {
                // Wait for the open event, maybe do something with promises
                // depending on your use case. I believe in you developer!
                commandSenderWebSocket.addEventListener('open', () => this.SendMessage(message))
            } 
            else 
            {
                // etc.
            }
        }
        catch
        {
            webSocketInitialized = false;
        }
    },
};

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID

    // Open the web socket
    websocket = new WebSocket("ws://127.0.0.1:" + inPort);

    function registerPlugin(inPluginUUID) {
        var json = {
            "event": inRegisterEvent,
            "uuid": inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    };

    websocket.onopen = function () {
        // WebSocket is connected, send message
        registerPlugin(pluginUUID);
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        var jsonObj = JSON.parse(evt.data);
        var event = jsonObj['event'];
        var action = jsonObj['action'];
        var context = jsonObj['context'];
        var jsonPayload = jsonObj['payload'] || {};

        if (event == "keyDown") {
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];
            var userDesiredState = jsonPayload['userDesiredState'];
            commandsenderAction.onKeyDown(context, settings, coordinates, userDesiredState);
        }
        else if (event == "keyUp") {
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];
            var userDesiredState = jsonPayload['userDesiredState'];
            commandsenderAction.onKeyUp(context, settings, coordinates, userDesiredState);
        }
        else if (event == "willAppear") {
            var settings = jsonPayload['settings'];
            var coordinates = jsonPayload['coordinates'];
            commandsenderAction.onWillAppear(context, settings, coordinates);
        }
        else if (event == "sendToPlugin") {

            if (jsonPayload.hasOwnProperty('setIpAddress')) {

                var newIpAddress = jsonPayload.setIpAddress;
                commandsenderAction.SetSettingsWithCache(context, "ipaddress", newIpAddress);
            }

            if (jsonPayload.hasOwnProperty('setPort')) {

                var newPort = jsonPayload.setPort;
                commandsenderAction.SetSettingsWithCache(context, "port", newPort);
            }

            if (jsonPayload.hasOwnProperty('setCommandPressed')) {

                var newCommandPressed = jsonPayload.setCommandPressed;
                commandsenderAction.SetSettingsWithCache(context, "commandPressed", newCommandPressed);
            }

            if (jsonPayload.hasOwnProperty('setCommandReleased')) {

                var newCommandReleased = jsonPayload.setCommandReleased;
                commandsenderAction.SetSettingsWithCache(context, "commandReleased", newCommandReleased);
            }
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };
};