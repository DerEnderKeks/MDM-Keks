/**
 * Retrive configuration as array of lines from a file
 * 
 * globals: config (localStorage|sessionStorage)
 * 
 * @author  Philipp Miller
 * @license http://opensource.org/licenses/gpl-license.php GNU Public License
 * 
 */
(function(win, storage, undefined) {
  
  "use strict";
  
  var config = win.config = {
        require: require,
        clear:   clear,
      }
    , cache = Object.create(null)
    ;
  
  /// Functions
  
  function require(filename, parser, useStorage) {
    
    if (filename in cache) {
      return cache[filename];
    }
    
    if (typeof parser === "boolean") {
      useStorage = parser;
      parser = undefined;
    }
    useStorage = storage && (useStorage === undefined || useStorage);
    
    if (useStorage && storage.hasOwnProperty(filename)) {
      console.log("Config: Found config file '" + filename + "' in storage");
      return cache[filename] = Promise.resolve(JSON.parse(storage.getItem(filename)));
    }
    
    var interrupted = false;
    
    var errorLogger = function(action) {
      return function(e) {
        if (!interrupted) {
          console.log("Config: Error while " + action + " config file '" + filename + "': " + e);
          interrupted = true;
        }
        throw e;
      };
    };
    
    return cache[filename] = new Promise(function(success, fail) {
        console.log("Config: Loading config file '" + filename + "'...");
        var request = new XMLHttpRequest();
        request.open("GET", filename);
        request.responseType = "text";
        request.addEventListener("load", function() {
          if (request.status < 400) {
            success(request.responseText);
          }
          else {
            fail(Error(request.statusText));
          }
        });
        request.send();
      })
      .catch(errorLogger("loading"))
      
      .then(getParserFunction(parser))
      .catch(errorLogger("parsing"))
      
      .then(function(parsed) {
        if (useStorage) {
          storage.setItem(filename, JSON.stringify(parsed));
        }
        return parsed;
      })
      .catch(errorLogger("storing"));
  }
  
  /**
   * clear storage type in use
   * @return {Object} config (chaining)
   */
  function clear(filename) {
    if (storage) {
      if (filename) {
        delete storage.filename;
      }
      else {
        storage.clear();
      }
    }
    return config;
  }
  
  
  /// PARSING
  
  // regular expressions for parsers
  var reValue   = /^(\S+)\s*=\s*(.*)$/
    , reArray   = /^\[(\S+)\]$/
    , reComment = /^[^#"]*(:?"[^"]*"[^#"]*)*/
    ;
  
  /**
   * Returns a Function that will be used as parser.
   * 
   * @param  {string|Function} parser Functions are returned as is
   * @return {Function}
   */
  function getParserFunction(parser) {
    if (typeof parser === "function") {
      return parser;
    }
    
    switch(parser) {
      case undefined:
      case null:
      case "properties":
        return parseProperties;
      
      case "plain":
        return identity;
      
      case "lines":
        return getLines;
      
      case "json":
        return JSON.parse;
    }
    throw Error('Config: Unknown parser "' + parser + "'");
  }
  
  /**
   * split filecontents into an array of lines,
   * removing empty lines and comments after '#'
   * 
   * @param  {string} text
   * @return {array}           array of strings
   */
  function getLines(text) {
    return text.split("\n").map(trimComments).filter(identity);
  }
  
  /**
   * Smart properties parsing
   * 
   * @see config.require
   * 
   * @param  {string} text to be parsed
   * @return {Object}      object with assigned properties
   */
  function parseProperties(text) {
    var props = {},
        currentProp,
        line,
        total,
        matches;
    
    text.split("\n")
      .map(trimComments)
      .forEach(
        function(line, lineNum) {
          
          // kept empty lines until now for correct line numbers
          if (line === "") return;
          
          // property = value
          if (matches = reValue.exec(line)) {
            props[matches[1]] = (JSON ? JSON.parse(matches[2]) : matches[2]);
          }
          
          // [property] array definition
          else if (matches = reArray.exec(line)) {
            currentProp = matches[1];
            if (!props.hasOwnProperty(currentProp)) {
              props[currentProp] = [];
            }
          }
          
          // [property] array entry
          else if (currentProp) {
            props[currentProp].push(line);
          }
          
          else throw Error("Config: Syntax error on line " + (lineNum + 1)
            + " '" + line + "'");
    });
    
    return props;
  }
  
  /**
   * Remove comments preceded by "#" and trims whitespace.
   * Comments do not have to start at the beginning of the line.
   * 
   * @param  {string} string
   * @return {string}
   */
  function trimComments(string) {
    // var i = string.indexOf("#");
    // return (0 <= i ? string.slice(0, i) : string).trim();
    return reComment.exec(string)[0];
  }
  
  /**
   * returns first argument unchanged, does nothing
   * @param  {mixed} x
   * @return {mixed} x
   */
  function identity(x) {
    return x;
  }
  
})(window, localStorage);
