module.exports = function(RED) {
    function AuroralDataCollector(config) {
        RED.nodes.createNode(this,config);
        // get agent settings
        this.agent = RED.nodes.getNode(config.agent);
        const node = this
        //set status to waiting 
        this.status({fill:"red",shape:"ring",text:"waiting"});

        //register
        this.agentNode = (node.context().global).get('auroral_agent')
        this.agentNode.emit('registerDevice', { "objectId": config.objectId, "name": config.name, pids: [], "registering": config.registering,"node": this }, 'Service')

        this.on('request', function() {
            node.error('Service are not allowed to recieve requests')
        });
        // incoming msg
        this.on('input', function(msg, send, done) {
            //  NOT READY
            if(this.oid == undefined){
                node.error('Not registered yet')
                done();
                return;
            }
            // Unknown OID and PID
            if(!msg.oid || !msg.pid) {
                node.error('Set msg.oid and msg.pid')
                done()
                return;
            }
            // get requested data
            try {
                (async function() {
                    const requestedData = await getAgent(node, 'api/properties/' + node.oid + '/' + msg.oid + '/' + msg.pid)
                    if(requestedData){
                        send({payload: requestedData})
                    }
                })();
            } catch (error) {
                this.error('ERROR:' + error)
                done();
                return;

            }
        });

        // device is registered -> change status to green
        this.on('registered', function(oid) {
            this.status({ fill:"green", shape:"dot", text:"registered" });
            node.oid = oid
        });

        // closing flow, or removing node
        this.on('close', function(removed, done) {
            const node = this
            // if node removed and unregistering is enabled 
            if (removed && node.config.unregistering) {
                // call agent to unregister
                this.agentNode.emit('unregisterDevice', config.objectId)
            }
            done();
        });
    }
    RED.nodes.registerType("auroralDataCollector",AuroralDataCollector);
}

// get request with given URL, returns body or undefined
async function getAgent(node, url){
    const got = require('got');
    try {
        const response = await got.get(url, node.agent.requestOptions);
        return response.body
    } catch (error) {
        node.error('Error getAgent: ' + error)
        return undefined
    }
}