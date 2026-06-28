const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");

const read = (file) => fs.readFileSync(path.join(src, file), "utf8");

let html = read("index.html");
const css = read("styles.css");
const data = read("universities.js");
const app = read("app.js");

html = html.replace('  <link rel="stylesheet" href="styles.css">', () => `  <style>\n${css}\n  </style>`);
html = html.replace(
  '  <script src="universities.js" defer></script>\n  <script src="app.js" defer></script>',
  () => `  <script>\n${data}\n  </script>\n  <script>\n${app}\n  </script>`
);

fs.writeFileSync(path.join(root, "index.html"), html);
console.log(`Built ${path.join(root, "index.html")}`);
