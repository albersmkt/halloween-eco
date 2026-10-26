const fs = require('node:fs');
require('esbuild').buildSync({entryPoints:['selfie.js'],bundle:true,minify:true,outfile:'selfie.bundle.js',platform:'browser'});
fs.rmSync('dist', {recursive:true,force:true});
fs.mkdirSync('dist');
for (const name of ['index.html','style.css','app.js','idle.js','selfie.bundle.js','media']) fs.cpSync(name,`dist/${name}`,{recursive:true});
