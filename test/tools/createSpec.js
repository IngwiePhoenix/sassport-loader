'use strict';

var sassport = require('sassport');
var fs = require('fs');
var path = require('path');

var testFolder = path.resolve(__dirname, '../');
var error = 'error';

function createSpec(ext) {
    var basePath = path.join(testFolder, ext);
    var testNodeModules = path.relative(basePath, path.join(testFolder, 'node_modules')) + path.sep;
    var pathToBootstrap = path.relative(basePath, path.resolve(testFolder, '..', 'node_modules', 'bootstrap-sass'));

    fs.readdirSync(path.join(testFolder, ext))
        .filter(function (file) {
            return path.extname(file) === '.' + ext && file.slice(0, error.length) !== error;
        })
        .map(function (file) {
            var fileName = path.join(basePath, file);
            var fileWithoutExt = file.slice(0, -ext.length - 1);
            var css;

            css = sassport().renderSync({
                file: fileName,
                importer: function (url) {
                    if (/\.css$/.test(url) === false) { // Do not transform css imports
                        url = url
                            .replace(/^~bootstrap-sass/, pathToBootstrap)
                            .replace(/^~/, testNodeModules);
                    }
                    return {
                        file: url
                    };
                },
                includePaths: [
                    path.join(testFolder, ext, 'another'),
                    path.join(testFolder, ext, 'from-include-path')
                ]
            }).css;
            fs.writeFileSync(path.join(basePath, 'spec', fileWithoutExt + '.css'), css, 'utf8');
        });
}

module.exports = createSpec;
