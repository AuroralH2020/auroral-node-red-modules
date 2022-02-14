module.exports = function(RED) {
    function Registrations(config) {
        RED.nodes.createNode(this,config);
        this.agent = RED.nodes.getNode(config.agent);
        const node = this
        // console.log(this.agent) 

        // incoming message
        this.on('input', function(msg, send, done) {
            try {
                (async function() {
                    const registrations = await getAgent(node, 'admin/registrations')
                if(!registrations){
                    node.error('Agent is offline')
                    return
                }
                //get registrationData with pids and adapterId
                let regDetails = await Promise.all(registrations.map(async (reg) => {
                    var returnObj = await getAgent(node, 'admin/registrations/' + reg)
                    returnObj.oid = reg
                    return returnObj
                }));
                if(regDetails){
                    send({payload: regDetails})
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
        const response = await got.get(url, node.agent.requestOptions);
        return response.body
    } catch (error) {
        node.error('Error getAgent: ' + error)
        return undefined
    }
}