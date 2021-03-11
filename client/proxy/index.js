const http = require('http');
const _ = require('lodash');
const fs = require('fs');
const Renderer = require('../zweb/renderer');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const mime = require('mime-types');
const sanitizingConfig = require('./sanitizing-config');

class ZProxy {
    constructor(ctx) {
        this.ctx = ctx;
        this.config = ctx.config.client.zproxy;
        this.port = parseInt(this.config.port); // todo: put default if null/void
    }

    async start() {
        this.server = http.createServer(this.request.bind(this));
        this.server.listen(parseInt(this.port), '127.0.0.1'); // '127.0.0.1' = only listen to local requests
        this.ctx.log.info('ZProxy server listening on port '+parseInt(this.port)+' on localhost');
    }

    abort404(response, message = 'domain not found') {
        const headers = {};
        response.writeHead(404, headers);
        response.write('404 '+message); // todo: come on, write a better msg
        response.end();
    }

    abortError(response, err) {
        const headers = {};
        response.writeHead(500, headers);
        response.write('500: '+err); // todo: come on, write a better msg
        response.end();
    }

    async request(request, response) {
        // console.log(request);

        // console.log(request);
        // console.log(request.headers);
        let host = request.headers.host;
        // console.log(host);
        if (! _.endsWith(host, '.z')) return this.abort404(response);

        try {
            let rendered;

            let parsedUrl;
            // console.log(request);
            try {
                parsedUrl = new URL(request.url);
            } catch(e) {
                parsedUrl = { pathname: '/error' }; // todo
            }

            console.debug(parsedUrl); // todo: remove
            let contentType = 'text/html';
            if (_.startsWith(parsedUrl.pathname, '/_storage/')) {
                let hash = parsedUrl.pathname.replace('/_storage/', '');
                let hashWithoutExt = hash.split('.').slice(0, -1).join('.');
                let ext = hash.split('.').slice(-1);
                if (ext !== hashWithoutExt) {
                    contentType = this.getContentTypeFromExt(ext);
                    if (contentType.includes('html')) contentType = 'text/html'; // just in case
                }
                rendered = await this.ctx.client.storage.readFile(hashWithoutExt); // todo: what if doesn't exist?
            } else if (_.startsWith(parsedUrl.pathname, '/_keyvalue_append/')) {
                try {
                    rendered = await this.keyValueAppend(host, request);
                } catch(e) {
                    return this.abortError(response, e);
                }
            } else if (_.startsWith(parsedUrl.pathname, '/_contract_send/')) {
                try {
                    rendered = await this.contractSend(host, request);
                } catch(e) {
                    return this.abortError(response, e);
                }
            } else {
                let zroute_id = await this.getZRouteIdFromDomain(host);
                if (zroute_id === null || zroute_id === '' || typeof zroute_id === "undefined") return this.abort404(response, 'route file not specified for this domain'); // todo: replace with is_valid_id

                let routes = await this.ctx.client.storage.readJSON(zroute_id); // todo: check result
                if (!routes) return this.abort404(response, 'cannot parse json of zroute_id '+zroute_id);

                let template_id = routes[ parsedUrl.pathname ]; // todo: what if route doens't exist?
                if (!template_id) return this.abort404(response, 'route not found'); // todo: write a better msg
                let template_file_contents = await this.ctx.client.storage.readFile(template_id, 'utf-8');

                let renderer = new Renderer(ctx);
                let request_params = {};
                for(let k of parsedUrl.searchParams.entries()) request_params[ k[0] ] = k[1];
                rendered = await renderer.render(template_file_contents, host, request_params); // todo: sanitize
            }

            let sanitized;
            if (contentType === 'text/html' && this.config.sanitize_html) {
                console.log('Sanitizing...' + contentType + this.config.sanitize_html + rendered);
                sanitized = this.sanitize(rendered);
            } else {
                // todo: potential security vulnerability here, e.g. if browser still thinks it's to be interpreted as html,
                // todo: and you didn't sanitize it, could get ugly. is contentType!=='text/html' check enough?
                sanitized = rendered;
            }

            if (typeof sanitized === 'undefined') sanitized = ''; // to avoid "response expected a string but got undefined"

            const headers = {
                'Content-Type': contentType
            };
            response.writeHead(200, headers);
            response.write(sanitized/*, 'utf-8'*/);
            response.end();

        } catch(e) {
            // throw 'ZProxy Error: '+e; // todo: remove
            return this.abortError(response, 'ZProxy Error: '+e);
        }

        // todo:?
        // console.log(request.headers.host);
        // console.log(request.port);
        // console.log(request.method);
        // console.log(request.url);
    }

    sanitize(html) {
        return sanitizeHtml(html, sanitizingConfig);
    }

    getContentTypeFromExt(ext) {
        // Note: just "css" won't work, so we prepend a dot
        return mime.lookup('.'+ext) || 'application/octet-stream';
    }

    keyValueAppend(host, request, response) {
        return new Promise(async(resolve, reject) => {
            let body = '';
            request.on('data', (chunk) => {
                body += chunk;
            });
            request.on('end', async() => {
                if (request.method.toUpperCase() !== 'POST') return 'Error: Must be POST';

                let parsedUrl = new URL(request.url);
                let key = parsedUrl.pathname.split('/_keyvalue_append/')[1];
                let currentList = await this.ctx.keyvalue.list(host, key);
                let newIdx = currentList.length;
                let newKey = key + newIdx;

                let entries = new URL('http://localhost/?'+body).searchParams.entries();
                let postData = {};
                for(let entry of entries){
                    postData[ entry[0] ] = entry[1];
                }

                let redirect = request.headers.referer;
                for(let k in postData) {
                    let v = postData[k];
                    if (k === '__redirect') {
                        redirect = v;
                        delete postData[k];
                    } else if (_.startsWith(k, 'storage[')) {
                        // storage
                        const cache_dir = path.join(this.ctx.datadir, this.config.cache_path);
                        this.ctx.utils.makeSurePathExists(cache_dir);
                        const tmpPostDataFilePath = path.join(cache_dir, this.ctx.utils.hashFnHex(v));
                        fs.writeFileSync(tmpPostDataFilePath, v);
                        let uploaded = await this.ctx.client.storage.putFile(tmpPostDataFilePath);
                        let uploaded_id = uploaded.id;

                        delete postData[k];
                        postData[k.replace('storage[', '').replace(']', '')] = uploaded_id;
                    }
                }

                postData.__from = this.ctx.config.client.wallet.account;
                postData.__time = Math.floor(Date.now() / 1000);
                let data = JSON.stringify(postData);

                await this.ctx.keyvalue.propagate(host, newKey, data);

                console.log('Redirecting to '+redirect+'...');
                const redirectHtml = '<html><head><meta http-equiv="refresh" content="0;url='+redirect+'" /></head></html>';  // todo: sanitize! don't trust it
                resolve(redirectHtml);
            });
            request.on('error', (e) => {
                reject('Error:', e);
            });
        });
    }

    contractSend(host, request, response) {
        return new Promise(async(resolve, reject) => {
            let body = '';
            request.on('data', (chunk) => {
                body += chunk;
            });
            request.on('end', async() => {
                if (request.method.toUpperCase() !== 'POST') return 'Error: Must be POST';

                let parsedUrl = new URL(request.url);
                let contractAndMethod = parsedUrl.pathname.split('/_contract_send/')[1];
                let [contractName, methodNameAndParams] = contractAndMethod.split('.');
                let [methodName, paramsTogether] = methodNameAndParams.split('(');
                paramsTogether = paramsTogether.replace(')', '');
                let paramNames = paramsTogether.split(',');

                let entries = new URL('http://localhost/?'+body).searchParams.entries();
                let postData = {};
                for(let entry of entries){
                    postData[ entry[0] ] = entry[1];
                }

                let redirect = request.headers.referer;
                for(let k in postData) {
                    let v = postData[k];
                    if (k === '__redirect') {
                        redirect = v;
                        delete postData[k];
                    } else if (_.startsWith(k, 'storage[')) {
                        // storage
                        const cache_dir = path.join(this.ctx.datadir, this.config.cache_path);
                        this.ctx.utils.makeSurePathExists(cache_dir);
                        const tmpPostDataFilePath = path.join(cache_dir, this.ctx.utils.hashFnHex(v));
                        fs.writeFileSync(tmpPostDataFilePath, v);
                        let uploaded = await this.ctx.client.storage.putFile(tmpPostDataFilePath);
                        let uploaded_id = uploaded.id;

                        delete postData[k];
                        postData[k.replace('storage[', '').replace(']', '')] = uploaded_id;
                    }
                }

                let params = [];
                for(let paramName of paramNames) {
                    params.push(postData[paramName]);
                }

                await this.ctx.web3bridge.sendContract(host, contractName, methodName, params);

                console.log('Redirecting to '+redirect+'...');
                const redirectHtml = '<html><head><meta http-equiv="refresh" content="0;url='+redirect+'" /></head></html>';
                resolve(redirectHtml); // todo: sanitize! don't trust it
            });
            request.on('error', (e) => {
                reject('Error:', e);
            });
        });
    }

    async getZRouteIdFromDomain(host) {
        const result = await this.ctx.web3bridge.getZRecord(host);
        console.log('getZRouteIdFromDomain result for '+host, result);
        return result;

        // const records = await this.getZDNSRecordsFromDomain(host);
        //
        // // todo: subdomains
        // for(let rec of records) {
        //     let [subdomain, type, value] = rec;
        //
        //     if (type === 'Z' && subdomain === '') return value;
        // }
        //
        // return null;
    }
}

module.exports = ZProxy;