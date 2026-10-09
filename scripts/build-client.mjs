import {build} from 'esbuild';
await build({entryPoints:['client/models.js'],outfile:'public/models.bundle.js',bundle:true,minify:true,format:'esm',target:'es2022',legalComments:'linked'});
console.log('Built local Spine renderer');
