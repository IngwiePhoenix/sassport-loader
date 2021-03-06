# Sass loader for [webpack](http://webpack.github.io/)

## This is a fork.
I forked `sass-loader` and left in most of the code for now - but I am planning to change this code so it will work with the [SassPort](https://github.com/davidkpiano/sassport) module. My goal is to keep API compatibility and have this module pass the same tests as the original `sass-loader`, just that this one has more features.

## Install

`npm install sassport-loader --save`

The sass/sassport-loader requires [node-sass](https://github.com/sass/node-sass) or [SassPort](https://github.com/davidkpiano/sassport) and [webpack](https://github.com/webpack/webpack).

---

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

``` javascript
var css = require("!raw!sassport!./file.scss");
// => returns compiled css code from file.scss, resolves imports
var css = require("!css!sassport!./file.scss");
// => returns compiled css code from file.scss, resolves imports and url(...)s
```

Use in tandem with the [`style-loader`](https://github.com/webpack/style-loader) and [`css-loader`](https://github.com/webpack/css-loader) to add the css rules to your document:

``` javascript
require("!style!css!sassport!./file.scss");
```
*NOTE: If you encounter module errors complaining about a missing `style` or `css` module, make sure you have installed all required loaders via npm.*

### Apply via webpack config

It's recommended to adjust your `webpack.config` so `style!css!sass!` is applied automatically on all files ending on `.scss`:

``` javascript
module.exports = {
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loaders: ["style", "css", "sassport"]
      }
    ]
  }
};
```

Then you only need to write: `require("./file.scss")`.

### SassPort modules and options

In order to pass additional things to the SassPort `.render()` function, use the SassPort entry within your config:

``` javascript
module.exports = {
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loaders: ["style", "css", "sassport"]
      }
    ]
  },
  Sassport: {
    modules: [
      // These modules will be passed to SassPort
      require('sassport-foo'),
      require('sassport-bar')
    ],
    outputStyle: "compressed",
    // ... and more ...
  }
};
```

See [node-sass](https://github.com/andrew/node-sass) for all available options. Just note that SassPort might not support all and every option.

### Imports

webpack provides an [advanced mechanism to resolve files](http://webpack.github.io/docs/resolving.html). The sass-loader uses node-sass' custom importer feature to pass all queries to the webpack resolving engine. Thus you can import your sass-modules from `node_modules`. Just prepend them with a `~` which tells webpack to look-up the [`modulesDirectories`](http://webpack.github.io/docs/configuration.html#resolve-modulesdirectories).

```css
@import "~bootstrap/less/bootstrap";
```

It's important to only prepend it with `~`, because `~/` resolves to the home-directory. webpack needs to distinguish between `bootstrap` and `~bootstrap` because CSS- and Sass-files have no special syntax for importing relative files. Writing `@import "file"` is the same as `@import "./file";`

### .sass files

For requiring `.sass` files, add `indentedSyntax` as a loader option:

``` javascript
module.exports = {
  module: {
    loaders: [
      {
        test: /\.sass$/,
        // Passing indentedSyntax query param to node-sass
        loaders: ["style", "css", "sassport"]
      }
    ]
  },
  Sassport: {
    indentedSyntax: true
  }
};
```

### Problems with `url(...)`

Since Sass/[libsass](https://github.com/sass/libsass) does not provide [url rewriting](https://github.com/sass/libsass/issues/532), all linked assets must be relative to the output.

- If you're just generating CSS without passing it to the css-loader, it must be relative to your web root.
- If you pass the generated CSS on to the css-loader, all urls must be relative to the entry-file (e.g. `main.scss`).

More likely you will be disrupted by this second issue. It is natural to expect relative references to be resolved against the `.scss`-file in which they are specified (like in regular `.css`-files). Thankfully there are a two solutions to this problem:

- Add the missing url rewriting using the [resolve-url-loader](https://github.com/bholloway/resolve-url-loader). Place it directly after the sass-loader in the loader chain.
- Library authors usually provide a variable to modify the asset path. [bootstrap-sass](https://github.com/twbs/bootstrap-sass) for example has an `$icon-font-path`. Check out [this working bootstrap example](https://github.com/jtangelder/sass-loader/tree/master/test/bootstrapSass).

## Source maps

To enable CSS Source maps, you'll need to pass the `sourceMap`-option to the sass- and the css-loader. Your `webpack.config.js` should look like this:

```javascript
module.exports = {
    ...
    devtool: "source-map", // or "inline-source-map"
    module: {
        loaders: [
            {
                test: /\.scss$/,
                loaders: ["style", "css?sourceMap", "sassport"]
            }
        ]
    },
    Sassport: {
        sourcemap: true
    }
};
```

If you want to edit the original Sass files inside Chrome, [there's a good blog post](https://medium.com/@toolmantim/getting-started-with-css-sourcemaps-and-in-browser-sass-editing-b4daab987fb0). Checkout [test/sourceMap](https://github.com/jtangelder/sass-loader/tree/master/test) for a running example.

## License

MIT (http://www.opensource.org/licenses/mit-license.php)

## Reminder
This is a fork. The code is likely to change since I am migrating it to use Sassport instead. Feel free to explore the code, though! :)

Fork is by: Ingwie Phoenix
