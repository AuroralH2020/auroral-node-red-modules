module.exports = function(RED) {
    function Registrations(config) {
        RED.nodes.createNode(this,config);
        this.agent = RED.nodes.getNode(config.agent);
        const node = this

        // incoming message
        this.on('input', function(msg, send, done) {
            try {
                (async function() {
                    const registrations = await getAgent(node, '/api/registration')
                    if(registrations){
                        send({payload: JSON.parse(registrations)})
                    }
                })();
            } catch (error) {
                this.error('ERROR:' + error)
                done();
            }
        });
    }
    RED.nodes.registerType("registrations",Registrations);
}

// get request with given URL, returns body or undefined
async function getAgent(node, url){
    const got = require('got');
    try {
        const response = await got.get('http://' + node.agent.host + ':' + node.agent.port + url);
        return response.body
    } catch (error) {
        node.error('Error getAgent: ' + error)
        return undefined
    }
}