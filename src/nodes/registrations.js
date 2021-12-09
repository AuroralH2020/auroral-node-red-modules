module.exports = function(RED) {
    function Registrations(config) {
        RED.nodes.createNode(this,config);
        const node = this
        this.on('input', function(msg, send, done) {

            var http = require('http');
            this.agent = RED.nodes.getNode(config.agent);
            // test if properly filled agent
            if(this.agent == undefined){
                this.status({fill:"red",shape:"ring",text:"disconnected"});
            }
            try {
                http.get('http://' + this.agent.host + ':' + this.agent.port+ '/api/registration', res => {
                let data = [];
                const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
                if(res.statusCode!==200){
                    this.error("Auroral status code: " + res.statusCode);
                }
                res.on('data', chunk => {
                    data.push(chunk);
                });

                res.on('end', () => {
                    const registrations = JSON.parse(Buffer.concat(data).toString());
                    this.log('Auroral response: '+ registrations);
                    msg.payload = registrations
                    this.status({fill:"green",shape:"dot",text:"connected"});
                    send(msg)
                });
                }).on('error', err => {
                    this.error('HTTP error: '+ err.message);
                    this.status({fill:"red",shape:"ring",text:"disconnected"});
                    done()
                });
                
            } catch (error) {
                this.error('ERROR')
                done();
            }
        });

        this.on('close', function(removed, done) {
            if (removed) {
                // This node has been disabled/deleted
            } else {
                // This node is being restarted
            }
            done();
        });
        
        
        
    }
    RED.nodes.registerType("registrations",Registrations);
}
