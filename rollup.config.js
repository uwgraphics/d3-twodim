// with inspiration from <https://code.lengstorf.com/learn-rollup-js/> and
// <http://rollupjs.org/guide/#using-config-files>, and
// <http://stackoverflow.com/questions/38637220/how-to-include-use-of-node-modules-in-rollup-compile>
//
// necessary to enable rollup to package up d3-hexbin dependency (see `bins.js`) 
// into library

import resolve from 'rollup-plugin-node-resolve';

// should capture the following string: 
// rollup -f umd -u d3-twodim -n d3_twodim -o build/d3-twodim.js -- build/bundle.js
export default {
  format: "umd",
  dest: "build/d3-twodim.js",
  moduleName: "d3_twodim",
  moduleId: "d3-twodim",
  plugins: [
    resolve({
      jsnext: true,
      main: true,
      browser: true
    })
  ]
}
