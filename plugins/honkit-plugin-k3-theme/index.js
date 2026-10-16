var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

/* Two things happen once the build has finished.

   1. Favicon. HonKit's default theme ships its own gitbook/images/favicon.ico (and Apple touch icon) and links them
      from every page. Plugin assets are copied to a different folder, so they cannot replace those files; the K3
      icons are written over them instead.

   2. Cache busting. The host serves scripts, styles and icons with a long cache lifetime (hours) under unchanged
      file names, so after a deploy readers keep running the previous script/stylesheet/icon until their cache
      expires, while the pages (cached for minutes) already reference the new behaviour. Every reference to these
      files in the built pages therefore gets "?v=<content hash>" appended: a changed file means a new URL, which
      nobody has cached. */
var FAVICON_DIR = path.join(__dirname, "favicon");
var ICONS = ["favicon.ico", "apple-touch-icon-precomposed-152.png"];
var VERSIONED = [
  "gitbook/honkit-plugin-k3-theme/k3-theme.css",
  "gitbook/honkit-plugin-k3-theme/k3-theme.js",
  "gitbook/images/favicon.ico",
  "gitbook/images/apple-touch-icon-precomposed-152.png"
];

function htmlFiles(dir, found) {
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) { if (name !== "node_modules") htmlFiles(p, found); }
    else if (/\.html$/.test(name)) found.push(p);
  });
  return found;
}

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
      ICONS.forEach(function (name) { fs.copyFileSync(path.join(FAVICON_DIR, name), path.join(imagesDir, name)); });

      var versions = {};
      VERSIONED.forEach(function (rel) {
        var file = path.join(out, rel);
        if (fs.existsSync(file)) versions[rel] = crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
      });
      htmlFiles(out, []).forEach(function (file) {
        var html = fs.readFileSync(file, "utf8"), next = html;
        Object.keys(versions).forEach(function (rel) {
          // only exact references ("…/k3-theme.js" followed by a quote), never ones that already carry a query
          next = next.split(rel + '"').join(rel + "?v=" + versions[rel] + '"').split(rel + "'").join(rel + "?v=" + versions[rel] + "'");
        });
        if (next !== html) fs.writeFileSync(file, next);
      });
    }
  }
};
