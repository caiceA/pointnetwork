// Modified from JSON RPC

// **Github:** https://github.com/teambition/jsonrpc-lite
//
// http://www.jsonrpc.org/specification
// **License:** MIT
'use strict';

const BSON = require('./good-bson');

const undef = void 0;
const toString = Object.prototype.toString;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const isArray = Array.isArray || function (obj) {
    return toString.call(obj) === '[object Array]';
};
const isInteger = Number.isSafeInteger || function (num) {
    return num === Math.floor(num);
};

/**
 * JsonRpc Class
 *
 * @return {Object} JsonRpc object
 * @api public
 */
class JsonRpc {
    constructor () {
        this.jsonrpc = '2.0';
    }
    serialize () {
        return BSON.serialize(this);
    }
}

JsonRpc.VERSION = '2.0';
JsonRpc.prototype.toString = JsonRpc.prototype.serialize;

class RequestObject extends JsonRpc {
    constructor (id, method, params) {
        super();

        this.id = id;
        this.method = method;
        if (params !== undef) this.params = params;
    }
}
RequestObject.prototype.name = 'request';

class NotificationObject extends JsonRpc {
    constructor (method, params) {
        super();

        this.method = method;
        if (params !== undef) this.params = params;
    }
}
NotificationObject.prototype.name = 'notification';

class SuccessObject extends JsonRpc {
    constructor (id, result) {
        super();

        this.id = id;
        this.result = result;
    }
}
SuccessObject.prototype.name = 'success';

class ErrorObject extends JsonRpc {
    constructor (id, error) {
        super();
        this.id = id;
        this.error = error;
    }
}
ErrorObject.prototype.name = 'error';

/**
 * JsonRpcParsed Class
 *
 * @param  {String} message
 * @param  {Integer} code
 * @return {String} name: optional
 * @api public
 */

function JsonRpcParsed (payload, type) {
    this.payload = payload;
    this.type = type || payload.name;
}

/**
 * JsonRpcError Class
 *
 * @param  {String} message
 * @param  {Integer} code
 * @return {String} name: optional
 * @api public
 */
class JsonRpcError extends Error {
    constructor (message, code, data) {
        super();

        this.message = message === undef ? '' : String(message);
        this.code = isInteger(code) ? code : 0;
        if (data != null) this.data = data;
    }
}
JsonRpcError.prototype.name = 'JsonRpcError';

JsonRpcError.invalidRequest = function (data) {
    return new JsonRpcError('Invalid request', -32600, data);
};

JsonRpcError.methodNotFound = function (data) {
    return new JsonRpcError('Method not found', -32601, data);
};

JsonRpcError.invalidParams = function (data) {
    return new JsonRpcError('Invalid params', -32602, data);
};

JsonRpcError.internalError = function (data) {
    return new JsonRpcError('Internal error', -32603, data);
};

JsonRpcError.parseError = function (data) {
    return new JsonRpcError('Parse error', -32700, data);
};

const jsonrpc = {
    JsonRpc: JsonRpc,
    JsonRpcError: JsonRpcError
};

/**
 * Creates a JSON-RPC 2.0 request object
 *
 * @param  {String|Integer} id
 * @param  {String} method
 * @param  {Object|Array} [params]: optional
 * @return {Object} JsonRpc object
 * @api public
 */
jsonrpc.request = function (id, method, params) {
    let object = new RequestObject(id, method, params);
    validateMessage(object, true);
    return object;
};

/**
 * Creates a JSON-RPC 2.0 notification object
 *
 * @param  {String} method
 * @param  {Object|Array} [params]: optional
 * @return {Object} JsonRpc object
 * @api public
 */
jsonrpc.notification = function (method, params) {
    let object = new NotificationObject(method, params);
    validateMessage(object, true);
    return object;
};

/**
 * Creates a JSON-RPC 2.0 success response object
 *
 * @param  {String|Integer} id
 * @param  {Mixed} result
 * @return {Object} JsonRpc object
 * @api public
 */
jsonrpc.success = function (id, result) {
    let object = new SuccessObject(id, result);
    validateMessage(object, true);
    return object;
};

/**
 * Creates a JSON-RPC 2.0 error response object
 *
 * @param  {String|Integer} id
 * @param  {Object} JsonRpcError error
 * @return {Object} JsonRpc object
 * @api public
 */
jsonrpc.error = function (id, error) {
    let object = new ErrorObject(id, error);
    validateMessage(object, true);
    return object;
};

/**
 * Takes a JSON-RPC 2.0 payload (String) and tries to parse it into a JSON.
 * If successful, determine what object is it (response, notification,
 * success, error, or invalid), and return it's type and properly formatted object.
 *
 * @param  {String} msg
 * @return {Object|Array} an array, or an object of this format:
 *
 *  {
 *    type: <Enum, 'request'|'notification'|'success'|'error'|'invalid'>
 *    payload: <JsonRpc|JsonRpcError>
 *  }
 *
 * @api public
 */
jsonrpc.parse = function (message) {
    if (!message || (typeof message !== 'string' && !Buffer.isBuffer(message))) {
        return new JsonRpcParsed(JsonRpcError.invalidRequest(message), 'invalid');
    }

    if (!Buffer.isBuffer(message)) {
        message = Buffer.from(message, 'ascii');
    }

    try {
        message = BSON.deserialize(message);
    } catch (err) {
        return new JsonRpcParsed(JsonRpcError.parseError(err+message), 'invalid');
    }

    if (!isArray(message)) return parseObject(message);
    if (!message.length) return new JsonRpcParsed(JsonRpcError.invalidRequest(message), 'invalid');
    for (let i = 0, len = message.length; i < len; i++) {
        message[i] = parseObject(message[i]);
    }

    return message;
};

/**
 * Takes a JSON-RPC 2.0 payload (Object) and tries to parse it into a JSON.
 * If successful, determine what object is it (response, notification,
 * success, error, or invalid), and return it's type and properly formatted object.
 *
 * @param  {Object} msg
 * @return {Object|Array} an array, or an object of this format:
 *
 *  {
 *    type: <Enum, 'request'|'notification'|'success'|'error'|'invalid'>
 *    payload: <JsonRpc|JsonRpcError>
 *  }
 *
 * @api public
 */
jsonrpc.parseObject = parseObject;
function parseObject (obj) {
    let error = null;
    let payload = null;

    if (!obj || obj.jsonrpc !== JsonRpc.VERSION) error = JsonRpcError.invalidRequest(obj);
    else if (!hasOwnProperty.call(obj, 'id')) {
        payload = new NotificationObject(obj.method, obj.params);
        error = validateMessage(payload);
    } else if (hasOwnProperty.call(obj, 'method')) {
        payload = new RequestObject(obj.id, obj.method, obj.params);
        error = validateMessage(payload);
    } else if (hasOwnProperty.call(obj, 'result')) {
        payload = new SuccessObject(obj.id, obj.result);
        error = validateMessage(payload);
    } else if (hasOwnProperty.call(obj, 'error')) {
        if (!obj.error) {
            error = JsonRpcError.internalError(obj);
        } else {
            let err = new JsonRpcError(obj.error.message, obj.error.code, obj.error.data);
            if (err.message !== obj.error.message || err.code !== obj.error.code) {
                error = JsonRpcError.internalError(obj);
            } else {
                payload = new ErrorObject(obj.id, err);
                error = validateMessage(payload);
            }
        }
    }

    if (!error && payload) return new JsonRpcParsed(payload);
    return new JsonRpcParsed(error || JsonRpcError.invalidRequest(obj), 'invalid');
}

// if error, return error, else return null
function validateMessage (data, throwIt) {
    let error = null;
    switch (data.name) {
        case RequestObject.prototype.name:
            error = checkId(data.id) || checkMethod(data.method) || checkParams(data.params);
            break;
        case NotificationObject.prototype.name:
            error = checkMethod(data.method) || checkParams(data.params);
            break;
        case SuccessObject.prototype.name:
            error = checkId(data.id) || checkResult(data.result);
            break;
        case ErrorObject.prototype.name:
            error = checkId(data.id, true) || checkError(data.error);
            break;
    }
    if (error && throwIt) throw error;
    return error;
}

function checkId (id, maybeNull) {
    if (maybeNull && id === null) return null;
    return (isString(id) || isInteger(id)) ? null : JsonRpcError.internalError('"id" must be provided, a string or an integer.');
}

function checkMethod (method) {
    return isString(method) ? null : JsonRpcError.methodNotFound(method);
}

function checkResult (result) {
    return result === undef ? JsonRpcError.internalError('Result must exist for success Response objects') : null;
}

function checkParams (params) {
    if (params === undef) return null;
    if (isArray(params) || isObject(params)) {
        // ensure params can be stringify.
        try {
            BSON.serialize(params);
            return null;
        } catch (err) {
            return JsonRpcError.parseError(params);
        }
    }
    return JsonRpcError.invalidParams(params);
}

function checkError (error) {
    if (!(error instanceof JsonRpcError)) {
        return JsonRpcError.internalError('Error must be an instance of JsonRpcError.');
    }

    if (!isInteger(error.code)) {
        return JsonRpcError.internalError('Invalid error code. It must be an integer.');
    }

    if (!isString(error.message)) {
        return JsonRpcError.internalError('Message must exist or must be a string.');
    }

    return null;
}

function isString (obj) {
    return obj && typeof obj === 'string';
}

function isObject (obj) {
    return obj && typeof obj === 'object' && !isArray(obj);
}

module.exports = { JsonRpc, JsonRpcError, jsonrpc };
module.exports = jsonrpc;
