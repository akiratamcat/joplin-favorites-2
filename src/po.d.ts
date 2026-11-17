// PO files are imported as raw strings (webpack asset/source emits CommonJS
// "module.exports = <string>"), so use: import x = require("../locales/xx.po");
declare module '*.po' {
  const content: string;
  export = content;
}
