var fs = require("fs");
var path = require("path");

/* Favicon: HonKit's default theme ships its own gitbook/images/favicon.ico (and the Apple touch icon) and links
   to them from every page. Plugin assets are copied to a different folder, so they cannot replace those files;
   instead the K3 icons are written over them once the build has finished. */
var FAVICON_DIR = path.join(__dirname, "favicon");
var TARGETS = {
  "favicon.ico": "favicon.ico",
  "apple-touch-icon-precomposed-152.png": "apple-touch-icon-precomposed-152.png"
};

module.exports = {
  book: {
    assets: "./assets",
    css: ["k3-theme.css"],
    js: ["k3-theme.js"]
  },
  hooks: {
    finish: function () {
      var out = (typeof this.output.root === "function" ? this.output.root() : this.options.output);
      var imagesDir = path.join(out, "gitbook", "images");
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      Object.keys(TARGETS).forEach(function (src) {
        fs.copyFileSync(path.join(FAVICON_DIR, src), path.join(imagesDir, TARGETS[src]));
      });
    }
  }
};
