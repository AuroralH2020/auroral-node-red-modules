module.exports = function(RED) {
    function AuroralResponse(config) {
        RED.nodes.createNode(this,config);
        const node = this

        // incoming msg
        this.on('input', function(msg, send, done) {
            try {
                if(msg._auroralReqId == undefined) {
                    // _auroralReqId is not in the message
                    this.error('Message is not comming from AuroralRequest node ( missing _auroralReqId )')
                    done(); 
                    return
                }
                const statusCode = msg.statusCode ? msg.statusCode : 200
                this.log('Recieving:' + msg._auroralReqId)
                // get requests from global storage
                var auroral_requests = (node.context().global).get('auroral_requests')
                if(auroral_requests[msg._auroralReqId] !== undefined) {
                    // send payload and end request
                    const res = auroral_requests[msg._auroralReqId].res
                    let headers = {'Content-Type': 'application/json'}
                    if(msg.timestamp) {
                        headers['x-timestamp'] = msg.timestamp
                    }
                    // Mapping handling 
                    // msg has higher priority than config
                    if(msg.mapping !== undefined) {
                        // -> boolean conversion
                        headers['x-mapping'] = Boolean(msg.mapping)
                    } else {
                        if(config.mapping === "true") {
                            headers['x-mapping'] = true
                        } else if(config.mapping === "false") {
                            headers['x-mapping'] = false
                        }
                    }
                    res.writeHead(statusCode, headers);
                    res.write(JSON.stringify(msg.payload));
                    res.end()
                } else {
                    // object doesn't exists
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
