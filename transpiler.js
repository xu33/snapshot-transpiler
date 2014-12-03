/*
 * transpiler
 * https://github.com/Administrator/grunt_plugin
 *
 * Copyright (c) 2014 nanshi
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs')
var transpile = require('./deps/transpile')
var beautify = require('js-beautify').js_beautify
var EXT = 'ss'

module.exports = function(grunt) {
  grunt.registerMultiTask('transpiler', 'ss to js transpiler', function() {
    var sourcePath = this.data.source
    var targetPath = this.data.target
    var files = fs.readdirSync(sourcePath)

    for (var i = 0, filePath; filePath = files[i]; i++) {
      if (filePath.substr(filePath.length - 2) != EXT) {
        continue
      }

      // console.log(filePath)
      var fileContent = fs.readFileSync(sourcePath + filePath, { encoding: 'utf-8' })
      var output = transpile(fileContent)
      
      output = beautify(output)
      fs.writeFileSync(targetPath + filePath.replace('.ss', '.js'), output, { encoding: 'utf-8', flag: 'w' })
    }
  });
};