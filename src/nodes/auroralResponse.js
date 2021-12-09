module.exports = function(RED) {
    function AuroralResponse(config) {
        RED.nodes.createNode(this,config);
        const node = this
        this.on('input', function(msg, send, done) {
            try {
                if(msg._auroralReqId == undefined) {
                    this.error('Message is not comming from AuroralRequest node')
                    done(); 
                    return
                }
                const payload = typeof msg.payload != 'object' ? {'value': msg.payload } : msg.payload
                this.log('Recieving:' + msg._auroralReqId)
                var auroral_requests = (node.context().global).get('auroral_requests')
                if(auroral_requests[msg._auroralReqId] !== undefined) {
                    const res = auroral_requests[msg._auroralReqId].res
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.write(JSON.stringify(payload));
                    res.end()
                } else {
                    this.error('Error getting response object')
                    done();
                    return
                }
                // remove from global variable
                delete auroral_requests[msg._auroralReqId];
                (node.context().global).set('auroral_requests', auroral_requests)
            } catch (error) {
                this.error('ERROR' + error)
                done();
            }
        });
    }
    RED.nodes.registerType("auroralResponse",AuroralResponse);
}
