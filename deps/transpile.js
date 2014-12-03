var OPEN_RE = /^<([-A-Za-z0-9_]+)((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|[^>\s]+))?)*)\s*(\/?)>/
var CLOSE_RE = /^<\/([-A-Za-z0-9_]+)[^>]*>/
var ATTR_RE = /([\-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g
var UNARYS = keyMirror("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed")
var PROPS = keyMirror("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected")
var NORMAL_TAGS = keyMirror('div,p,table,span,input,tr,td,th,tbody,section,article,select,strong,i,b,ul,ol,li,dl,dt,form,button,img')
var JS_VARIABLE_RE = /{([^{}]+)}/
var OPEN_BRACKET = '<'

function keyMirror(str) {
    var map = {}
    var items = str.split(",")
    for (var i = 0; i < items.length; i++) {
        map[items[i]] = true
    }
    return map
}

function isUnary(tagName) {
	return UNARYS[tagName] || !!unary
}

function consumeHTMLPair(html) {
    var index
    var chars
    var match
    var tokens = []
    var last = html
    var originalInput = html
    var n = 0

    function parseOpenTag(tag, tagName, rest, hasUnaryMark) {
        var attrs = []
        var unary = UNARYS[tagName] || !!hasUnaryMark

        // console.log('is this unary?', tagName, !!unary)
        rest.replace(ATTR_RE, function(match, name) {
            var args = arguments
            var value = args[2] ? args[2] :
                args[3] ? args[3] :
                args[4] ? args[4] :
                PROPS[name] ? name : "";

            attrs.push({
                name: name,
                value: value
            })
        })

        tokens.push({
            type: unary ? 'unary' : 'start',
            tagName: tagName,
            attrs: attrs
        })

        if (unary) {
        	n--
        }
    }

    function parseCloseTag(tag, tagName) {
        tokens.push({
            tagName: tagName,
            type: 'end'
        })
    }

    while (html) {
        chars = true;
        if (html.indexOf("</") == 0) {
        	n--
            match = html.match(CLOSE_RE);

            if (match) {
                html = html.substring(match[0].length); // 移动下标
                match[0].replace(CLOSE_RE, parseCloseTag);
                chars = false;
            }
        } else if (html.indexOf("<") == 0) {
        	n++
            match = html.match(OPEN_RE);
            if (match) {
                html = html.substring(match[0].length); // 移动下标
                match[0].replace(OPEN_RE, parseOpenTag);
                chars = false;
            }
        }

        if (chars) {
            index = html.indexOf("<");

            var text = index < 0 ? html : html.substring(0, index);
            html = index < 0 ? "" : html.substring(index);

            if (/\S+/.test(text)) {
                tokens.push({
                    type: 'text',
                    value: text
                })
            }
        }

        if (n == 0) {
        	var moveLength = originalInput.length - html.length
        	return [tokens, moveLength]
        }

        if (html == last) {
            // console.log("Parse Error: " + html)
            return false
        }

        last = html;
    }

    parseCloseTag();
    return tokens;
}

function isVar(text) {
	return JS_VARIABLE_RE.test(text)
}

function getVarName(text) {
	return text.replace(JS_VARIABLE_RE, function(all, name) {
		return name
	})
}

function spaces(n) {
	var space = ''
	for (var i = 1; i < n; i++) {
		space += ' '
	}
	return space
}

function wrapTagName(tagName) {
	if (NORMAL_TAGS.hasOwnProperty(tagName.toLowerCase())) {
		return '"' + tagName + '"'
	} else {
		return tagName
	}
}

function attrsToString(attrs) {
	var attrLength = attrs.length
	var attr
	var str = ''
	for (var j = 0; j < attrLength; j++) {
		attr = attrs[j]
		str += attr.name + ':'
		if (isVar(attr.value)) {
			str += getVarName(attr.value)
		} else {
			str +=  '"' + attr.value + '"'
		}
		if (j < attrLength - 1) {
			str += ', '
		}
	}

	return str
}

function transform(tokens) {
	if (tokens.length < 1) {
		if (tokens[0].type === 'unary') {
			var str = 'Snap.createElement("' + token.tagName + '"'
			if (token.attrs.length > 0) {
				str += ', {'
				str += attrsToString(token.attrs)
				str += '}'
			}
			str += ')'

			return str
		} else {
			// console.log('transform error', tokens)
			return false
		}
	}

	var str = ''
	var stack = []
	var i = 0
	var length = tokens.length
	
	while (i < length) {
		var token = tokens[i] 
		if (token.type === 'start' || token.type === 'unary') {
			if (stack.length > 0) {
				str += ','
				str += '\n'
				for (var j = 1; j <= stack.length; j++) {
					str += '\t'
				}
			}

			str += 'Snap.createElement(' + wrapTagName(token.tagName)
			if (token.attrs.length > 0) {
				str += ', {'
				str += attrsToString(token.attrs)
				str += '}'
			} else {
				str += ', null'
			}

			if (token.type === 'start') {
				stack.push(token)
			} else {
				str += ')'
			}
		} else if (token.type === 'text') {
			if (stack.length > 0) {
				str += ', '
			}

			if (isVar(token.value)) {
				str += getVarName(token.value)
			} else {
				str += '"' + token.value + '"'
			}
		} else if (token.type === 'end') {
			if (stack.length > 0) {
				var prevType = tokens[i - 1].type

				if (prevType != 'text' && prevType != 'start') {
					str += '\n'
					for (var j = 1; j < stack.length; j++) {
						str += '\t'
					}
				}
				str += ')'
				stack.pop()
			}
		}

		i++
	}

	return str
}

function transpile(text) {
	// console.log('transpile invoke')
	var index = 0
	var ch

	while (index < text.length) {
		ch = text.charAt(index)
		if (ch === OPEN_BRACKET) {
			try {
				var htmlPairTokens = consumeHTMLPair(text.substr(index))
			} catch (e) {
				throw('parse error')
			}
			
			if (htmlPairTokens) {
				var tokens = htmlPairTokens[0]
				var moveLength = htmlPairTokens[1]
				var textBeforePairs = text.substr(0, index)
				var textAfterPairs = text.substr(index + moveLength)
				var replaceString = transform(tokens)
				if (replaceString) {
					// console.log(textBeforePairs, '****************', textAfterPairs)
					text = textBeforePairs + replaceString + textAfterPairs
					index += replaceString.length
				}
			}
		}
		index++
	}

	// console.log(text)
	return text
}

module.exports = transpile