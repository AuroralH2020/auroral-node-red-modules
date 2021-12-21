module.exports = function(RED) {
    function AuroralResponse(config) {
        RED.nodes.createNode(this,config);
        const node = this

        // incoming msg
        this.on('input', function(msg, send, done) {
            try {
                if(msg._auroralReqId == undefined) {
                    // _auroralReqId is no in message
                    this.error('Message is not comming from AuroralRequest node')
                    done(); 
                    return
                }
                // encpsulate message if is string or number
                const payload = typeof msg.payload != 'object' ? {'value': msg.payload } : msg.payload
                const statusCode = msg.statusCode ? msg.statusCode : 200
                this.log('Recieving:' + msg._auroralReqId)
                // get requests from global storage
                var auroral_requests = (node.context().global).get('auroral_requests')
                if(auroral_requests[msg._auroralReqId] !== undefined) {
                    // send payload and end request
                    const res = auroral_requests[msg._auroralReqId].res
                    res.writeHead(statusCode, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify(payload));
                    res.end()
                } else {
                    // object doesnt exists
                    // unexpected error 
                    this.error('Error getting response connection object')
                    done();
                    return
                }
                // remove from global variable
                delete auroral_requests[msg._auroralReqId];
                (node.context().global).set('auroral_requests', auroral_requests)
            } catch (error) {
                // unexpected error 
                this.error('ERROR' + error)
                done();
            }
        });
    }
    RED.nodes.registerType("auroralResponse",AuroralResponse);
}
