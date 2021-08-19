const fs = require('fs');
const path = require('path');
const knex = require('../knex');
const uuid = require('uuid');

class Directory {
    constructor() {
        this.id = uuid();
        this.name = '';
        this.files = [];
        this.originalPath = null;
        this.size = 0;
        // todo: include 'version' and 'compat' fields
    }

    setCtx(ctx) {
        this.ctx = ctx;
    }

    setHost(host) {
        this.host = host;
    }

    async save() {
        // save to postgres via knex
        const attrs = (({ id, type, original_path, parent_dir, size, host }) => ({ id, type: 'dir', original_path: this.originalPath, parent_dir: path.join(this.originalPath, '..'), size, host}))(this);
        
        // TODO: we're not storing directories on LevelDB. What do we return? Is this okay?
        // We're returning on file.js, chunk.js, etc. the result of storing stuff on LevelDB.
        return knex('files')
            .insert(attrs)
            .onConflict("id")
            .merge()
            .returning("*");
    }

    async getFileIdByPath(filePath) {
        let fragments = filePath.split('/');
        if (fragments[0] === '') fragments.shift();
        let firstFragment = fragments.shift();
        for(let f of this.files) {
            if (f.name === firstFragment) {
                if (f.type === 'fileptr') {
                    return f.id
                } else if (f.type === 'dirptr') {
                    if (! f.downloaded) {
                        let subdir = new Directory();
                        subdir.unserialize(await this.ctx.client.storage.readFile(f.id, 'utf-8')); // dir spec is always in utf-8
                        f.downloaded = true;
                        f.dirObj = subdir;
                        f.dirObj.setCtx(this.ctx);
                    }
                    // fragments here are without the first item due to shift in the beginning
                    return f.dirObj.getFileIdByPath(fragments.join('/'));
                } // todo: else
            }
        }
        throw Error('getFileIdByPath failed: Path for '+filePath+' not found');
    }

    async readFileByPath(filePath, encoding = 'utf-8') {
        let id = await this.getFileIdByPath(filePath);
        return await this.ctx.client.storage.readFile(id, encoding);
    }

    setOriginalPath(originalPath) {
        this.originalPath = originalPath;
    }

    addFilesFromOriginalPath() {
        this.addFilesFromPath(this.originalPath);
    }

    addFilesFromPath(dirPath) {
        if (!fs.existsSync(dirPath)) throw Error('Directory '+this.ctx.utils.htmlspecialchars(dirPath)+' does not exist');
        if (!fs.statSync(dirPath).isDirectory()) throw Error('dirPath '+this.ctx.utils.htmlspecialchars(dirPath)+' is not a directory');

        fs.readdirSync(dirPath).forEach(fileName => {
            const combinedFullPath = path.join(dirPath, fileName);
            this.addFile(combinedFullPath, fileName);
        });
    }

    addFile(filePath, name) {
        let size;
        if (fs.statSync(filePath).isDirectory()) {
            let subdir = new Directory();
            subdir.setOriginalPath(filePath);
            subdir.addFilesFromOriginalPath();
            size = subdir.size;
            this.files.push({
                type: 'dirptr',
                name: name,
                dirObj: subdir,
                originalPath: filePath,
                size,
            });
        } else {
            size = fs.statSync(filePath).size;
            this.files.push({
                type: 'fileptr',
                name: name,
                originalPath: filePath,
                size
            });
        }
        this.size += size;
    }

    serialize() {
        let result = {
            type: 'dir',
            files: []
        };
        for(let f of this.files) {
            if (f.type === 'fileptr') {
                result.files.push({
                    type: 'fileptr',
                    name: f.name,
                    size: f.size,
                    id: f.id
                });
            } else if (f.type === 'dirptr') {
                result.files.push({
                    type: 'dirptr',
                    name: f.name,
                    size: f.size,
                    id: f.id
                });
            } else throw Error('invalid file/dir type: '+f.type); // todo: sanitize
        }

        return JSON.stringify(result);
    }

    unserialize(jsonString) {
        let obj = JSON.parse(jsonString);
        if (obj.type !== 'dir') throw Error('directory unserialize fail: type is not a directory')
        this.size = 0;
        for(let f of obj.files) {
            if (f.type === 'fileptr') {
                this.files.push({
                    type: 'fileptr',
                    name: f.name,
                    size: f.size,
                    id: f.id,
                    downloaded: false,
                });
            } else if (f.type === 'dirptr') {
                this.files.push({
                    type: 'dirptr',
                    name: f.name,
                    size: f.size,
                    id: f.id,
                    downloaded: false,
                });
            } else throw Error('unserialize directory failed: invalid item type: '+f.type); // todo: sanitize
            this.size += f.size;
        }
    }

    serializeToFile(filePath) {
        fs.writeFileSync(filePath, this.serialize(), 'utf-8');
    }


}

module.exports = Directory;
