// communication with auroral agent
const got = require('got');
const config = require('./config')

class Agent {
    constructor( baseUrl, ignoreCertificate, username, password ) {
        // create GOT options
        this.requestOptions = {
            prefixUrl: baseUrl,
            responseType: 'json',
            username,
            password,
            https: {
                rejectUnauthorized: ignoreCertificate? false : true,
            },
            timeout: {
                response: config.agentTimeout
            }
        };
        this.requestOptionsText = {
            prefixUrl: baseUrl,
            responseType: 'text',
            username,
            headers:{ 
                "Content-Type": "text/plain"
            },
            password,
            https: {
                rejectUnauthorized: ignoreCertificate? false : true,
            },
            timeout: {
                response: config.agentTimeout
            }
        };
    }
    // get all registrations from agent
    getRegistrations = async function () {
        try {
            const response = await got.get('api/registration/', this.requestOptions);
            if(response) {
                if(response.statusCode == 200) {
                    return response.body.message
                }
                throw new Error('StatusCode:' + response.body.statusCode)
            }
        } catch (error) {
            throw new Error('Error getting registrations: ' + error)
        }
    }
    // get properties for registration
    getRegistration = async function (id) {
        try {
            const response = await got.get('api/registration/' + id, this.requestOptions);
            if(response) {
                if(response.statusCode == 200) {
                    return response.body.message
                }
                throw new Error('StatusCode:' + response.body.statusCode)
            }
        } catch (error) {
            throw new Error('Error getting registration: ' + error)
        }
    }
    // get properties for registration
    getRegistrationByAdapterId = async function (adapterId) {
        // console.log('get registration by adapterId')
        try{
            const response = await got.get('api/registration/oid/' + adapterId,  {...this.requestOptions, responseType: 'text'});
            if(response.statusCode === 200) {
                const body = JSON.parse(response.body)
                if(body.message){
                    const device = await this.getRegistration(body.message)
                    return {...device, oid: body.message}
                } else {
                   return null
                }
            }
        } catch(error) {
            throw new Error('Error getting registration by adapterId: ' + error)
        }
    }
    // returns thing description
    getTd = async function (id) {
        console.log('getting thing')
        try {
            const response = await got.get('api/discovery/local/td/' + id, this.requestOptions);
            // console.log(response.body)
            if(response.statusCode !== 200){
                throw new Error('Error getting TD from agent')
            }
            return response.body.message
        } catch (error) {
            throw new Error('Error getting TD from agent')
        }
    }
    // register object
    postRegistration = async function (obj) {
        console.log('registering thing')
        try {
            const response = await got.post('api/registration/', {...this.requestOptions, json: obj});
            if(response.statusCode >= 400){
                throw new Error(response.message)
            }
            return response.body.message
        } catch (error) {
            throw new Error('Error new registration: ' + error)
        }
    }
    // register object
    putRegistration = async function (obj) {
        try {
            if(!obj.td.id){
                throw new Error('TD update - ID is missing')
            }
            console.log('Updating TD: ' + obj.td.id )
            const response = await got.put('api/registration/', {...this.requestOptions, json: obj});
            return response.body.message
        } catch (error) {
            throw new Error('Error updating registration: ' + error)
        }
    }
    // removing registration
    removeRegistrations = async function (oids) {
        console.log('Removing registration: ' + oids)
        try {
            const response = await got.post('api/registration/remove' , {...this.requestOptions, json: {oids: oids}});
            if(response.statusCode == 200) {
                return response.body.message
            } else {
                throw new Error('statusCode: ' + response.statusCode)
            }
        } catch (error) {
            throw new Error('Error removing registration: ' + error)
        }
    }
    // getting properties
    getProperties = async function (id, oid, pid, query) {
        console.log('Getting property as ID:' + id + " OID:"+ oid + ' PID:' + pid)
        try {
            const response = await got.get('api/properties/'+id+'/'+oid+'/'+pid , {...this.requestOptions, searchParams: query})
            // console.log(response)
            if(response.statusCode !== 200 || !response.body.message){
                throw new Error('Error getting properties from agent')
            }
            return response.body.message
        } catch (error) {
            throw new Error('Error getting properties: ' + error)
        }
    }

    // getting properties
    putProperties = async function (id, oid, pid, payload, query) {
        console.log('Getting property as ID:' + id + " OID:"+ oid + ' PID:' + pid)
        try {
            const response = await got.put('api/properties/' + id + '/' + oid + '/' + pid , {json: payload, ...this.requestOptions, searchParams: query}) 
            // console.log(response)
            if(response.statusCode !== 200 || !response.body.message){
                throw new Error('Error getting properties from agent')
            }
            return response.body.message
        } catch (error) {
            throw new Error('Error getting properties: ' + error)
        }
    }

    sendEventToChannel = async function (oid, eid, data, options) {
        console.log('Sending event to channel: ' + " OID:"+ oid + ' EID:' + eid + ' DATA: '+ data)
        try {
            const headers = {
                "Content-Type": "text/plain",
            }
            if(options.mapping !== undefined || options.mapping !== 'undefined'){
                headers['x-mapping'] = options.mapping
            }
            if(options.timestamp && options.timestamp !== undefined){
                headers['x-timestamp'] = options.timestamp
            }
            const response = await got.put('api/events/local/' + oid + '/' + eid , { body: JSON.stringify(data), ...this.requestOptionsText, headers: headers});
            if(response.statusCode !== 200){
                throw new Error('Error sending event')
            }
            return response.body.message
        } catch (err) {
            throw new Error(err.message)
        }
    }

    createEventChannel = async function (oid, eid) {
        console.log('Create event channel: ' + " OID:"+ oid + ' EID:' + eid)
        try {
            const response = await got.post('api/events/local/' + oid + '/' + eid , {...this.requestOptions});
            // console.log(response)
            if(response.statusCode !== 200){
                throw new Error('Error creating event channel')
            }
            return response.body.message
        } catch (err) {
            throw new Error(err.message)
        }
    }

    removeEventChannel = async function (oid, eid) {
        console.log('Removing event channel: ' + " OID:"+ oid + ' EID:' + eid)
        try {
            const response = await got.delete('api/events/local/' + oid + '/' + eid , {...this.requestOptions});
            // console.log(response)
            if(response.statusCode !== 200){
                throw new Error('Error removing event channel')
            }
            return response.body.message
        } catch (err) {
            throw new Error(err.message)
        }
    }

    subscribeToEventChannel = async function (id, oid, eid) {
        console.log('Subscribing to event channel ID: ' + id + " OID: "+ oid + ' EID:' + eid)
        try {
            const response = await got.post('api/events/remote/' + id + '/' + oid + '/' + eid , {...this.requestOptions});
            if(response.statusCode !== 200){
                throw new Error('Error subscribing event channel')
            }
            return response.body.message
        } catch (err) {
            throw new Error(err.message)
        }
    }
    unSubscribeFromEventChannel = async function (id, oid, eid) {
        console.log('Unsubscribing from event channel: ' + " OID:"+ oid + ' EID:' + eid)
        try {
            const response = await got.delete('api/events/remote/' + id + '/' + oid + '/' + eid , {...this.requestOptions});
            if(response.statusCode !== 200){
                throw new Error('Error unsubscribing event channel')
            }
            return response.body.message
        } catch (err) {
            throw new Error(err.message)
        }
    }
    eventChannelStatus = async function (id, eid) {
        try {
            const response = await got.get('api/events/remote/' + id + '/' + eid , {...this.requestOptions});
            if(response.statusCode !== 200){
                throw new Error('Error getting event channel status')
            }
            return response.body.message
        } catch (err) {
            throw new Error(err.message)
        }
    }
    responseMessageFormat = function (data) {
        // return typeof data != 'object' ? {'value': data } : data
        return data
    }
  }

module.exports =  Agent