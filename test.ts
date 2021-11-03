import { resolve } from "path";
const expressFile = require.resolve("express");
console.log(resolve(expressFile, "..", ".."));
