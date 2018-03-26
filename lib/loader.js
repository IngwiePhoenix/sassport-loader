"use strict";

const utils = require("loader-utils");
const sassport = require("sassport");
const path = require("path");
const os = require("os");
const async = require("neo-async");
const pify = require("pify");
const merge = require("merge").recursive;
const requireFresh = require("requirefresh");
const formatSassError = require("./formatSassError");
const webpackImporter = require("./webpackImporter");
const proxyCustomImporters = require("./proxyCustomImporters");
const createSassportImporter = require("sassport/dist/importer").default;

function applyRender({ sassportInstance, options }, done) {
    return sassportInstance.render(options, done);
}

// This queue makes sure node-sass leaves one thread available for executing
// fs tasks when running the custom importer code.
// This can be removed as soon as node-sass implements a fix for this.
const threadPoolSize = process.env.UV_THREADPOOL_SIZE || 4;
const asyncSassJobQueue = async.queue(applyRender, threadPoolSize - 1);

/**
 * The sass-loader makes node-sass available to webpack modules.
 *
 * @param {string} content
 * @returns {string}
 */
module.exports = function sassportLoader(content) {
    const callback = this.async();
    const isSync = typeof callback !== "function";
    const self = this;
    const resourcePath = this.resourcePath;
    const configOptions = utils.getOptions(this);

    if (isSync) {
        throw new Error("Synchronous compilation is not supported anymore. See https://github.com/webpack-contrib/sass-loader/issues/333");
    }

    // When files have been imported via the includePaths-option, these files need to be
    // introduced to webpack in order to make them watchable.
    function addIncludedFilesToWebpack(includedFiles) {
        includedFiles.forEach(addNormalizedDependency);
    }

    function addNormalizedDependency(file) {
        // node-sass returns UNIX-style paths
        self.dependency(path.normalize(file));
    }

    this.cacheable();

    const options = merge({}, configOptions);

    options.data = options.data ? (options.data + os.EOL + content) : content;

    // Modules
    options.modules = options.modules || [];

    // Define the job queue...
    const sassportInstance = sassport(options.modules, {
        // This hook allows the require()'d files to be added
        // to WebPack's deps.
        onRequire(file) {
            const scssModule = requireFresh(file);

            self.addDependency(file);

            return scssModule;
        }
    });

    // Set up fallback importer to allow importing of sassport modules
    const sassportImporter = createSassportImporter(sassportInstance);

    // Skip empty files, otherwise it will stop webpack, see issue #21
    if (options.data.trim() === "") {
        return callback(null, content);
    }

    // options.outputStyle
    if (!options.outputStyle && this.minimize) {
        options.outputStyle = "compressed";
    }

    // opt.sourceMap
    // Not using the `this.sourceMap` flag because css source maps are different
    // @see https://github.com/webpack/css-loader/pull/40
    if (options.sourceMap) {
        // Deliberately overriding the sourceMap option here.
        // node-sass won't produce source maps if the data option is used and options.sourceMap is not a string.
        // In case it is a string, options.sourceMap should be a path where the source map is written.
        // But since we're using the data option, the source map will not actually be written, but
        // all paths in sourceMap.sources will be relative to that path.
        // Pretty complicated... :(
        options.sourceMap = path.join(process.cwd(), "/sass.map");
        if ("sourceMapRoot" in options === false) {
            options.sourceMapRoot = process.cwd();
        }
        if ("omitSourceMapUrl" in options === false) {
            // The source map url doesn't make sense because we don't know the output path
            // The css-loader will handle that for us
            options.omitSourceMapUrl = true;
        }
        if ("sourceMapContents" in options === false) {
            // If sourceMapContents option is not set, set it to true otherwise maps will be empty/null
            // when exported by webpack-extract-text-plugin.
            options.sourceMapContents = true;
        }
    }

    // indentedSyntax is a boolean flag.
    const ext = path.extname(resourcePath);

    // If we are compiling sass and indentedSyntax isn't set, automatically set it.
    if (ext && ext.toLowerCase() === ".sass" && "indentedSyntax" in options === false) {
        options.indentedSyntax = true;
    } else {
        options.indentedSyntax = Boolean(options.indentedSyntax);
    }

    // Allow passing custom importers to `node-sass`. Accepts `Function` or an array of `Function`s.
    options.importer = options.importer ? proxyCustomImporters(options.importer, resourcePath) : [];
    options.importer.push(sassportImporter);
    options.importer.push(webpackImporter(
        resourcePath,
        pify(this.resolve.bind(this)),
        addNormalizedDependency
    ));

    // `node-sass` uses `includePaths` to resolve `@import` paths. Append the currently processed file.
    options.includePaths = (options.includePaths || [])
        .concat(path.dirname(resourcePath));

    return asyncSassJobQueue.push({ sassportInstance, options }, (err, result) => {
        if (err) {
            formatSassError(err, resourcePath);
            err.file && self.dependency(err.file);
            callback(err);
            return;
        }

        if (result.map && result.map !== "{}") {
            result.map = JSON.parse(result.map);
            // result.map.file is an optional property that provides the output filename.
            // Since we don"t know the final filename in the webpack build chain yet, it makes no sense to have it.
            delete result.map.file;
            // The first source is 'stdin' according to node-sass because we've used the data input.
            // Now let's override that value with the correct relative path.
            // Since we specified options.sourceMap = path.join(process.cwd(), "/sass.map"); in normalizeOptions,
            // we know that this path is relative to process.cwd(). This is how node-sass works.
            result.map.sources[0] = path.relative(process.cwd(), resourcePath);
            // node-sass returns POSIX paths, that's why we need to transform them back to native paths.
            // This fixes an error on windows where the source-map module cannot resolve the source maps.
            // @see https://github.com/webpack-contrib/sass-loader/issues/366#issuecomment-279460722
            result.map.sourceRoot = path.normalize(result.map.sourceRoot);
            result.map.sources = result.map.sources.map(path.normalize);
        } else {
            result.map = null;
        }

        addIncludedFilesToWebpack(result.stats.includedFiles);
        callback(null, result.css.toString(), result.map);
    });
};
