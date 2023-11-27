
/**
* @license
* author: Nikolay Ryabov
* flame-chart-js v3.2.1
* Released under the MIT license.
*/

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active ) ;
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

class UIPlugin extends EventEmitter {
    constructor(name) {
        super();
        this.name = name;
    }
    get fullHeight() {
        return typeof this.height === 'number' ? this.height : 0;
    }
    init(renderEngine, interactionsEngine) {
        this.renderEngine = renderEngine;
        this.interactionsEngine = interactionsEngine;
    }
}

const mergeObjects = (defaultStyles, styles = {}) => Object.keys(defaultStyles).reduce((acc, key) => {
    if (styles[key]) {
        acc[key] = styles[key];
    }
    else {
        acc[key] = defaultStyles[key];
    }
    return acc;
}, {});
const isNumber = (val) => typeof val === 'number';
const last = (array) => array[array.length - 1];
const getTrianglePoints = (width, height, direction) => {
    const side = (width * Math.SQRT2) / 2;
    let points = [];
    switch (direction) {
        case 'top':
            points = [
                { x: 0, y: height },
                { x: width / 2, y: 0 },
                { x: width, y: height },
            ];
            break;
        case 'bottom':
            points = [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width / 2, y: height },
            ];
            break;
        case 'left':
            points = [
                { x: height, y: 0 },
                { x: height, y: width },
                { x: 0, y: width / 2 },
            ];
            break;
        case 'right':
            points = [
                { x: 0, y: 0 },
                { x: 0, y: width },
                { x: height, y: width / 2 },
            ];
            break;
        case 'top-left':
            points = [
                { x: 0, y: 0 },
                { x: side, y: 0 },
                { x: 0, y: side },
            ];
            break;
        case 'top-right':
            points = [
                { x: 0, y: 0 },
                { x: side, y: 0 },
                { x: side, y: side },
            ];
            break;
        case 'bottom-left':
            points = [
                { x: 0, y: 0 },
                { x: 0, y: side },
                { x: side, y: side },
            ];
            break;
        case 'bottom-right':
            points = [
                { x: side, y: 0 },
                { x: 0, y: side },
                { x: side, y: side },
            ];
            break;
    }
    return points;
};

const MIN_BLOCK_SIZE = 1;
const STICK_DISTANCE = 0.25;
const MIN_CLUSTER_SIZE = MIN_BLOCK_SIZE * 2 + STICK_DISTANCE;
const walk = (treeList, cb, parent = null, level = 0) => {
    treeList.forEach((child) => {
        const res = cb(child, parent, level);
        if (child.children) {
            walk(child.children, cb, res || child, level + 1);
        }
    });
};
const flatTree = (treeList) => {
    const result = [];
    let index = 0;
    walk(treeList, (node, parent, level) => {
        const newNode = {
            source: node,
            end: node.start + node.duration,
            parent,
            level,
            index: index++,
        };
        result.push(newNode);
        return newNode;
    });
    return result.sort((a, b) => a.level - b.level || a.source.start - b.source.start);
};
const getFlatTreeMinMax = (flatTree) => {
    let isFirst = true;
    let min = 0;
    let max = 0;
    flatTree.forEach(({ source: { start }, end }) => {
        if (isFirst) {
            min = start;
            max = end;
            isFirst = false;
        }
        else {
            min = min < start ? min : start;
            max = max > end ? max : end;
        }
    });
    return { min, max };
};
const calcClusterDuration = (nodes) => {
    const firstNode = nodes[0];
    const lastNode = last(nodes);
    return lastNode.source.start + lastNode.source.duration - firstNode.source.start;
};
const checkNodeTimeboundNesting = (node, start, end) => (node.source.start < end && node.end > start) || (node.source.start > start && node.end < end);
const checkClusterTimeboundNesting = (node, start, end) => (node.start < end && node.end > start) || (node.start > start && node.end < end);
const defaultClusterizeCondition = (prevNode, node) => prevNode.source.color === node.source.color &&
    prevNode.source.pattern === node.source.pattern &&
    prevNode.source.type === node.source.type;
function metaClusterizeFlatTree(flatTree, condition = defaultClusterizeCondition) {
    return flatTree
        .reduce((acc, node) => {
        const lastCluster = last(acc);
        const lastNode = lastCluster && last(lastCluster);
        if (lastNode && lastNode.level === node.level && condition(lastNode, node)) {
            lastCluster.push(node);
        }
        else {
            acc.push([node]);
        }
        return acc;
    }, [])
        .filter((nodes) => nodes.length)
        .map((nodes) => ({
        nodes,
    }));
}
const clusterizeFlatTree = (metaClusterizedFlatTree, zoom, start = 0, end = 0, stickDistance = STICK_DISTANCE, minBlockSize = MIN_BLOCK_SIZE) => {
    let lastCluster = null;
    let lastNode = null;
    let index = 0;
    return metaClusterizedFlatTree
        .reduce((acc, { nodes }) => {
        lastCluster = null;
        lastNode = null;
        index = 0;
        for (const node of nodes) {
            if (checkNodeTimeboundNesting(node, start, end)) {
                if (lastCluster && !lastNode) {
                    lastCluster[index] = node;
                    index++;
                }
                else if (lastCluster &&
                    lastNode &&
                    (node.source.start - (lastNode.source.start + lastNode.source.duration)) * zoom <
                        stickDistance &&
                    node.source.duration * zoom < minBlockSize &&
                    lastNode.source.duration * zoom < minBlockSize) {
                    lastCluster[index] = node;
                    index++;
                }
                else {
                    lastCluster = [node];
                    index = 1;
                    acc.push(lastCluster);
                }
                lastNode = node;
            }
        }
        return acc;
    }, [])
        .map((nodes) => {
        var _a;
        const node = nodes[0];
        const duration = calcClusterDuration(nodes);
        const badge = (_a = nodes.find((node) => node.source.badge)) === null || _a === void 0 ? void 0 : _a.source.badge;
        return {
            start: node.source.start,
            end: node.source.start + duration,
            duration,
            type: node.source.type,
            color: node.source.color,
            pattern: node.source.pattern,
            level: node.level,
            badge,
            nodes,
        };
    });
};
const reclusterizeClusteredFlatTree = (clusteredFlatTree, zoom, start, end, stickDistance, minBlockSize) => {
    return clusteredFlatTree.reduce((acc, cluster) => {
        if (checkClusterTimeboundNesting(cluster, start, end)) {
            if (cluster.duration * zoom <= MIN_CLUSTER_SIZE) {
                acc.push(cluster);
            }
            else {
                acc.push(...clusterizeFlatTree([cluster], zoom, start, end, stickDistance, minBlockSize));
            }
        }
        return acc;
    }, []);
};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var colorString$1 = {exports: {}};

var colorName = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};

var simpleSwizzle = {exports: {}};

var isArrayish$1 = function isArrayish(obj) {
	if (!obj || typeof obj === 'string') {
		return false;
	}

	return obj instanceof Array || Array.isArray(obj) ||
		(obj.length >= 0 && (obj.splice instanceof Function ||
			(Object.getOwnPropertyDescriptor(obj, (obj.length - 1)) && obj.constructor.name !== 'String')));
};

var isArrayish = isArrayish$1;

var concat = Array.prototype.concat;
var slice = Array.prototype.slice;

var swizzle$1 = simpleSwizzle.exports = function swizzle(args) {
	var results = [];

	for (var i = 0, len = args.length; i < len; i++) {
		var arg = args[i];

		if (isArrayish(arg)) {
			// http://jsperf.com/javascript-array-concat-vs-push/98
			results = concat.call(results, slice.call(arg));
		} else {
			results.push(arg);
		}
	}

	return results;
};

swizzle$1.wrap = function (fn) {
	return function () {
		return fn(swizzle$1(arguments));
	};
};

var simpleSwizzleExports = simpleSwizzle.exports;

/* MIT license */

var colorNames = colorName;
var swizzle = simpleSwizzleExports;
var hasOwnProperty = Object.hasOwnProperty;

var reverseNames = Object.create(null);

// create a list of reverse color names
for (var name in colorNames) {
	if (hasOwnProperty.call(colorNames, name)) {
		reverseNames[colorNames[name]] = name;
	}
}

var cs = colorString$1.exports = {
	to: {},
	get: {}
};

cs.get = function (string) {
	var prefix = string.substring(0, 3).toLowerCase();
	var val;
	var model;
	switch (prefix) {
		case 'hsl':
			val = cs.get.hsl(string);
			model = 'hsl';
			break;
		case 'hwb':
			val = cs.get.hwb(string);
			model = 'hwb';
			break;
		default:
			val = cs.get.rgb(string);
			model = 'rgb';
			break;
	}

	if (!val) {
		return null;
	}

	return {model: model, value: val};
};

cs.get.rgb = function (string) {
	if (!string) {
		return null;
	}

	var abbr = /^#([a-f0-9]{3,4})$/i;
	var hex = /^#([a-f0-9]{6})([a-f0-9]{2})?$/i;
	var rgba = /^rgba?\(\s*([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)(?=[\s,])\s*(?:,\s*)?([+-]?\d+)\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
	var per = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*,?\s*([+-]?[\d\.]+)\%\s*(?:[,|\/]\s*([+-]?[\d\.]+)(%?)\s*)?\)$/;
	var keyword = /^(\w+)$/;

	var rgb = [0, 0, 0, 1];
	var match;
	var i;
	var hexAlpha;

	if (match = string.match(hex)) {
		hexAlpha = match[2];
		match = match[1];

		for (i = 0; i < 3; i++) {
			// https://jsperf.com/slice-vs-substr-vs-substring-methods-long-string/19
			var i2 = i * 2;
			rgb[i] = parseInt(match.slice(i2, i2 + 2), 16);
		}

		if (hexAlpha) {
			rgb[3] = parseInt(hexAlpha, 16) / 255;
		}
	} else if (match = string.match(abbr)) {
		match = match[1];
		hexAlpha = match[3];

		for (i = 0; i < 3; i++) {
			rgb[i] = parseInt(match[i] + match[i], 16);
		}

		if (hexAlpha) {
			rgb[3] = parseInt(hexAlpha + hexAlpha, 16) / 255;
		}
	} else if (match = string.match(rgba)) {
		for (i = 0; i < 3; i++) {
			rgb[i] = parseInt(match[i + 1], 0);
		}

		if (match[4]) {
			if (match[5]) {
				rgb[3] = parseFloat(match[4]) * 0.01;
			} else {
				rgb[3] = parseFloat(match[4]);
			}
		}
	} else if (match = string.match(per)) {
		for (i = 0; i < 3; i++) {
			rgb[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
		}

		if (match[4]) {
			if (match[5]) {
				rgb[3] = parseFloat(match[4]) * 0.01;
			} else {
				rgb[3] = parseFloat(match[4]);
			}
		}
	} else if (match = string.match(keyword)) {
		if (match[1] === 'transparent') {
			return [0, 0, 0, 0];
		}

		if (!hasOwnProperty.call(colorNames, match[1])) {
			return null;
		}

		rgb = colorNames[match[1]];
		rgb[3] = 1;

		return rgb;
	} else {
		return null;
	}

	for (i = 0; i < 3; i++) {
		rgb[i] = clamp(rgb[i], 0, 255);
	}
	rgb[3] = clamp(rgb[3], 0, 1);

	return rgb;
};

cs.get.hsl = function (string) {
	if (!string) {
		return null;
	}

	var hsl = /^hsla?\(\s*([+-]?(?:\d{0,3}\.)?\d+)(?:deg)?\s*,?\s*([+-]?[\d\.]+)%\s*,?\s*([+-]?[\d\.]+)%\s*(?:[,|\/]\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
	var match = string.match(hsl);

	if (match) {
		var alpha = parseFloat(match[4]);
		var h = ((parseFloat(match[1]) % 360) + 360) % 360;
		var s = clamp(parseFloat(match[2]), 0, 100);
		var l = clamp(parseFloat(match[3]), 0, 100);
		var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);

		return [h, s, l, a];
	}

	return null;
};

cs.get.hwb = function (string) {
	if (!string) {
		return null;
	}

	var hwb = /^hwb\(\s*([+-]?\d{0,3}(?:\.\d+)?)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?(?=\.\d|\d)(?:0|[1-9]\d*)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*)?\)$/;
	var match = string.match(hwb);

	if (match) {
		var alpha = parseFloat(match[4]);
		var h = ((parseFloat(match[1]) % 360) + 360) % 360;
		var w = clamp(parseFloat(match[2]), 0, 100);
		var b = clamp(parseFloat(match[3]), 0, 100);
		var a = clamp(isNaN(alpha) ? 1 : alpha, 0, 1);
		return [h, w, b, a];
	}

	return null;
};

cs.to.hex = function () {
	var rgba = swizzle(arguments);

	return (
		'#' +
		hexDouble(rgba[0]) +
		hexDouble(rgba[1]) +
		hexDouble(rgba[2]) +
		(rgba[3] < 1
			? (hexDouble(Math.round(rgba[3] * 255)))
			: '')
	);
};

cs.to.rgb = function () {
	var rgba = swizzle(arguments);

	return rgba.length < 4 || rgba[3] === 1
		? 'rgb(' + Math.round(rgba[0]) + ', ' + Math.round(rgba[1]) + ', ' + Math.round(rgba[2]) + ')'
		: 'rgba(' + Math.round(rgba[0]) + ', ' + Math.round(rgba[1]) + ', ' + Math.round(rgba[2]) + ', ' + rgba[3] + ')';
};

cs.to.rgb.percent = function () {
	var rgba = swizzle(arguments);

	var r = Math.round(rgba[0] / 255 * 100);
	var g = Math.round(rgba[1] / 255 * 100);
	var b = Math.round(rgba[2] / 255 * 100);

	return rgba.length < 4 || rgba[3] === 1
		? 'rgb(' + r + '%, ' + g + '%, ' + b + '%)'
		: 'rgba(' + r + '%, ' + g + '%, ' + b + '%, ' + rgba[3] + ')';
};

cs.to.hsl = function () {
	var hsla = swizzle(arguments);
	return hsla.length < 4 || hsla[3] === 1
		? 'hsl(' + hsla[0] + ', ' + hsla[1] + '%, ' + hsla[2] + '%)'
		: 'hsla(' + hsla[0] + ', ' + hsla[1] + '%, ' + hsla[2] + '%, ' + hsla[3] + ')';
};

// hwb is a bit different than rgb(a) & hsl(a) since there is no alpha specific syntax
// (hwb have alpha optional & 1 is default value)
cs.to.hwb = function () {
	var hwba = swizzle(arguments);

	var a = '';
	if (hwba.length >= 4 && hwba[3] !== 1) {
		a = ', ' + hwba[3];
	}

	return 'hwb(' + hwba[0] + ', ' + hwba[1] + '%, ' + hwba[2] + '%' + a + ')';
};

cs.to.keyword = function (rgb) {
	return reverseNames[rgb.slice(0, 3)];
};

// helpers
function clamp(num, min, max) {
	return Math.min(Math.max(min, num), max);
}

function hexDouble(num) {
	var str = Math.round(num).toString(16).toUpperCase();
	return (str.length < 2) ? '0' + str : str;
}

var colorStringExports = colorString$1.exports;

var conversions$2 = {exports: {}};

/* MIT license */

var cssKeywords = colorName;

// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

var reverseKeywords = {};
for (var key in cssKeywords) {
	if (cssKeywords.hasOwnProperty(key)) {
		reverseKeywords[cssKeywords[key]] = key;
	}
}

var convert$2 = conversions$2.exports = {
	rgb: {channels: 3, labels: 'rgb'},
	hsl: {channels: 3, labels: 'hsl'},
	hsv: {channels: 3, labels: 'hsv'},
	hwb: {channels: 3, labels: 'hwb'},
	cmyk: {channels: 4, labels: 'cmyk'},
	xyz: {channels: 3, labels: 'xyz'},
	lab: {channels: 3, labels: 'lab'},
	lch: {channels: 3, labels: 'lch'},
	hex: {channels: 1, labels: ['hex']},
	keyword: {channels: 1, labels: ['keyword']},
	ansi16: {channels: 1, labels: ['ansi16']},
	ansi256: {channels: 1, labels: ['ansi256']},
	hcg: {channels: 3, labels: ['h', 'c', 'g']},
	apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
	gray: {channels: 1, labels: ['gray']}
};

// hide .channels and .labels properties
for (var model in convert$2) {
	if (convert$2.hasOwnProperty(model)) {
		if (!('channels' in convert$2[model])) {
			throw new Error('missing channels property: ' + model);
		}

		if (!('labels' in convert$2[model])) {
			throw new Error('missing channel labels property: ' + model);
		}

		if (convert$2[model].labels.length !== convert$2[model].channels) {
			throw new Error('channel and label counts mismatch: ' + model);
		}

		var channels = convert$2[model].channels;
		var labels = convert$2[model].labels;
		delete convert$2[model].channels;
		delete convert$2[model].labels;
		Object.defineProperty(convert$2[model], 'channels', {value: channels});
		Object.defineProperty(convert$2[model], 'labels', {value: labels});
	}
}

convert$2.rgb.hsl = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var min = Math.min(r, g, b);
	var max = Math.max(r, g, b);
	var delta = max - min;
	var h;
	var s;
	var l;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert$2.rgb.hsv = function (rgb) {
	var rdif;
	var gdif;
	var bdif;
	var h;
	var s;

	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var v = Math.max(r, g, b);
	var diff = v - Math.min(r, g, b);
	var diffc = function (c) {
		return (v - c) / 6 / diff + 1 / 2;
	};

	if (diff === 0) {
		h = s = 0;
	} else {
		s = diff / v;
		rdif = diffc(r);
		gdif = diffc(g);
		bdif = diffc(b);

		if (r === v) {
			h = bdif - gdif;
		} else if (g === v) {
			h = (1 / 3) + rdif - bdif;
		} else if (b === v) {
			h = (2 / 3) + gdif - rdif;
		}
		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}

	return [
		h * 360,
		s * 100,
		v * 100
	];
};

convert$2.rgb.hwb = function (rgb) {
	var r = rgb[0];
	var g = rgb[1];
	var b = rgb[2];
	var h = convert$2.rgb.hsl(rgb)[0];
	var w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert$2.rgb.cmyk = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var c;
	var m;
	var y;
	var k;

	k = Math.min(1 - r, 1 - g, 1 - b);
	c = (1 - r - k) / (1 - k) || 0;
	m = (1 - g - k) / (1 - k) || 0;
	y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

/**
 * See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
 * */
function comparativeDistance(x, y) {
	return (
		Math.pow(x[0] - y[0], 2) +
		Math.pow(x[1] - y[1], 2) +
		Math.pow(x[2] - y[2], 2)
	);
}

convert$2.rgb.keyword = function (rgb) {
	var reversed = reverseKeywords[rgb];
	if (reversed) {
		return reversed;
	}

	var currentClosestDistance = Infinity;
	var currentClosestKeyword;

	for (var keyword in cssKeywords) {
		if (cssKeywords.hasOwnProperty(keyword)) {
			var value = cssKeywords[keyword];

			// Compute comparative distance
			var distance = comparativeDistance(rgb, value);

			// Check if its less, if so set as closest
			if (distance < currentClosestDistance) {
				currentClosestDistance = distance;
				currentClosestKeyword = keyword;
			}
		}
	}

	return currentClosestKeyword;
};

convert$2.keyword.rgb = function (keyword) {
	return cssKeywords[keyword];
};

convert$2.rgb.xyz = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;

	// assume sRGB
	r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
	g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
	b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);

	var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert$2.rgb.lab = function (rgb) {
	var xyz = convert$2.rgb.xyz(rgb);
	var x = xyz[0];
	var y = xyz[1];
	var z = xyz[2];
	var l;
	var a;
	var b;

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

	l = (116 * y) - 16;
	a = 500 * (x - y);
	b = 200 * (y - z);

	return [l, a, b];
};

convert$2.hsl.rgb = function (hsl) {
	var h = hsl[0] / 360;
	var s = hsl[1] / 100;
	var l = hsl[2] / 100;
	var t1;
	var t2;
	var t3;
	var rgb;
	var val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	t1 = 2 * l - t2;

	rgb = [0, 0, 0];
	for (var i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}
		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert$2.hsl.hsv = function (hsl) {
	var h = hsl[0];
	var s = hsl[1] / 100;
	var l = hsl[2] / 100;
	var smin = s;
	var lmin = Math.max(l, 0.01);
	var sv;
	var v;

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	smin *= lmin <= 1 ? lmin : 2 - lmin;
	v = (l + s) / 2;
	sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert$2.hsv.rgb = function (hsv) {
	var h = hsv[0] / 60;
	var s = hsv[1] / 100;
	var v = hsv[2] / 100;
	var hi = Math.floor(h) % 6;

	var f = h - Math.floor(h);
	var p = 255 * v * (1 - s);
	var q = 255 * v * (1 - (s * f));
	var t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert$2.hsv.hsl = function (hsv) {
	var h = hsv[0];
	var s = hsv[1] / 100;
	var v = hsv[2] / 100;
	var vmin = Math.max(v, 0.01);
	var lmin;
	var sl;
	var l;

	l = (2 - s) * v;
	lmin = (2 - s) * vmin;
	sl = s * vmin;
	sl /= (lmin <= 1) ? lmin : 2 - lmin;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert$2.hwb.rgb = function (hwb) {
	var h = hwb[0] / 360;
	var wh = hwb[1] / 100;
	var bl = hwb[2] / 100;
	var ratio = wh + bl;
	var i;
	var v;
	var f;
	var n;

	// wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	i = Math.floor(6 * h);
	v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	n = wh + f * (v - wh); // linear interpolation

	var r;
	var g;
	var b;
	switch (i) {
		default:
		case 6:
		case 0: r = v; g = n; b = wh; break;
		case 1: r = n; g = v; b = wh; break;
		case 2: r = wh; g = v; b = n; break;
		case 3: r = wh; g = n; b = v; break;
		case 4: r = n; g = wh; b = v; break;
		case 5: r = v; g = wh; b = n; break;
	}

	return [r * 255, g * 255, b * 255];
};

convert$2.cmyk.rgb = function (cmyk) {
	var c = cmyk[0] / 100;
	var m = cmyk[1] / 100;
	var y = cmyk[2] / 100;
	var k = cmyk[3] / 100;
	var r;
	var g;
	var b;

	r = 1 - Math.min(1, c * (1 - k) + k);
	g = 1 - Math.min(1, m * (1 - k) + k);
	b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert$2.xyz.rgb = function (xyz) {
	var x = xyz[0] / 100;
	var y = xyz[1] / 100;
	var z = xyz[2] / 100;
	var r;
	var g;
	var b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// assume sRGB
	r = r > 0.0031308
		? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
		: r * 12.92;

	g = g > 0.0031308
		? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
		: g * 12.92;

	b = b > 0.0031308
		? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
		: b * 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert$2.xyz.lab = function (xyz) {
	var x = xyz[0];
	var y = xyz[1];
	var z = xyz[2];
	var l;
	var a;
	var b;

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

	l = (116 * y) - 16;
	a = 500 * (x - y);
	b = 200 * (y - z);

	return [l, a, b];
};

convert$2.lab.xyz = function (lab) {
	var l = lab[0];
	var a = lab[1];
	var b = lab[2];
	var x;
	var y;
	var z;

	y = (l + 16) / 116;
	x = a / 500 + y;
	z = y - b / 200;

	var y2 = Math.pow(y, 3);
	var x2 = Math.pow(x, 3);
	var z2 = Math.pow(z, 3);
	y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
	x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
	z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

	x *= 95.047;
	y *= 100;
	z *= 108.883;

	return [x, y, z];
};

convert$2.lab.lch = function (lab) {
	var l = lab[0];
	var a = lab[1];
	var b = lab[2];
	var hr;
	var h;
	var c;

	hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert$2.lch.lab = function (lch) {
	var l = lch[0];
	var c = lch[1];
	var h = lch[2];
	var a;
	var b;
	var hr;

	hr = h / 360 * 2 * Math.PI;
	a = c * Math.cos(hr);
	b = c * Math.sin(hr);

	return [l, a, b];
};

convert$2.rgb.ansi16 = function (args) {
	var r = args[0];
	var g = args[1];
	var b = args[2];
	var value = 1 in arguments ? arguments[1] : convert$2.rgb.hsv(args)[2]; // hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	var ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert$2.hsv.ansi16 = function (args) {
	// optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert$2.rgb.ansi16(convert$2.hsv.rgb(args), args[2]);
};

convert$2.rgb.ansi256 = function (args) {
	var r = args[0];
	var g = args[1];
	var b = args[2];

	// we use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	var ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert$2.ansi16.rgb = function (args) {
	var color = args % 10;

	// handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	var mult = (~~(args > 50) + 1) * 0.5;
	var r = ((color & 1) * mult) * 255;
	var g = (((color >> 1) & 1) * mult) * 255;
	var b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert$2.ansi256.rgb = function (args) {
	// handle greyscale
	if (args >= 232) {
		var c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	var rem;
	var r = Math.floor(args / 36) / 5 * 255;
	var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	var b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert$2.rgb.hex = function (args) {
	var integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	var string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert$2.hex.rgb = function (args) {
	var match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
	if (!match) {
		return [0, 0, 0];
	}

	var colorString = match[0];

	if (match[0].length === 3) {
		colorString = colorString.split('').map(function (char) {
			return char + char;
		}).join('');
	}

	var integer = parseInt(colorString, 16);
	var r = (integer >> 16) & 0xFF;
	var g = (integer >> 8) & 0xFF;
	var b = integer & 0xFF;

	return [r, g, b];
};

convert$2.rgb.hcg = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var max = Math.max(Math.max(r, g), b);
	var min = Math.min(Math.min(r, g), b);
	var chroma = (max - min);
	var grayscale;
	var hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma + 4;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert$2.hsl.hcg = function (hsl) {
	var s = hsl[1] / 100;
	var l = hsl[2] / 100;
	var c = 1;
	var f = 0;

	if (l < 0.5) {
		c = 2.0 * s * l;
	} else {
		c = 2.0 * s * (1.0 - l);
	}

	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert$2.hsv.hcg = function (hsv) {
	var s = hsv[1] / 100;
	var v = hsv[2] / 100;

	var c = s * v;
	var f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert$2.hcg.rgb = function (hcg) {
	var h = hcg[0] / 360;
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	var pure = [0, 0, 0];
	var hi = (h % 1) * 6;
	var v = hi % 1;
	var w = 1 - v;
	var mg = 0;

	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert$2.hcg.hsv = function (hcg) {
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;

	var v = c + g * (1.0 - c);
	var f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert$2.hcg.hsl = function (hcg) {
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;

	var l = g * (1.0 - c) + 0.5 * c;
	var s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert$2.hcg.hwb = function (hcg) {
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;
	var v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert$2.hwb.hcg = function (hwb) {
	var w = hwb[1] / 100;
	var b = hwb[2] / 100;
	var v = 1 - b;
	var c = v - w;
	var g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert$2.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert$2.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

convert$2.gray.rgb = function (args) {
	return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert$2.gray.hsl = convert$2.gray.hsv = function (args) {
	return [0, 0, args[0]];
};

convert$2.gray.hwb = function (gray) {
	return [0, 100, gray[0]];
};

convert$2.gray.cmyk = function (gray) {
	return [0, 0, 0, gray[0]];
};

convert$2.gray.lab = function (gray) {
	return [gray[0], 0, 0];
};

convert$2.gray.hex = function (gray) {
	var val = Math.round(gray[0] / 100 * 255) & 0xFF;
	var integer = (val << 16) + (val << 8) + val;

	var string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert$2.rgb.gray = function (rgb) {
	var val = (rgb[0] + rgb[1] + rgb[2]) / 3;
	return [val / 255 * 100];
};

var conversionsExports = conversions$2.exports;

var conversions$1 = conversionsExports;

/*
	this function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
	var graph = {};
	// https://jsperf.com/object-keys-vs-for-in-with-closure/3
	var models = Object.keys(conversions$1);

	for (var len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	var graph = buildGraph();
	var queue = [fromModel]; // unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		var current = queue.pop();
		var adjacents = Object.keys(conversions$1[current]);

		for (var len = adjacents.length, i = 0; i < len; i++) {
			var adjacent = adjacents[i];
			var node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	var path = [graph[toModel].parent, toModel];
	var fn = conversions$1[graph[toModel].parent][toModel];

	var cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions$1[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

var route$1 = function (fromModel) {
	var graph = deriveBFS(fromModel);
	var conversion = {};

	var models = Object.keys(graph);
	for (var len = models.length, i = 0; i < len; i++) {
		var toModel = models[i];
		var node = graph[toModel];

		if (node.parent === null) {
			// no possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};

var conversions = conversionsExports;
var route = route$1;

var convert$1 = {};

var models = Object.keys(conversions);

function wrapRaw(fn) {
	var wrappedFn = function (args) {
		if (args === undefined || args === null) {
			return args;
		}

		if (arguments.length > 1) {
			args = Array.prototype.slice.call(arguments);
		}

		return fn(args);
	};

	// preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	var wrappedFn = function (args) {
		if (args === undefined || args === null) {
			return args;
		}

		if (arguments.length > 1) {
			args = Array.prototype.slice.call(arguments);
		}

		var result = fn(args);

		// we're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (var len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(function (fromModel) {
	convert$1[fromModel] = {};

	Object.defineProperty(convert$1[fromModel], 'channels', {value: conversions[fromModel].channels});
	Object.defineProperty(convert$1[fromModel], 'labels', {value: conversions[fromModel].labels});

	var routes = route(fromModel);
	var routeModels = Object.keys(routes);

	routeModels.forEach(function (toModel) {
		var fn = routes[toModel];

		convert$1[fromModel][toModel] = wrapRounded(fn);
		convert$1[fromModel][toModel].raw = wrapRaw(fn);
	});
});

var colorConvert = convert$1;

var colorString = colorStringExports;
var convert = colorConvert;

var _slice = [].slice;

var skippedModels = [
	// to be honest, I don't really feel like keyword belongs in color convert, but eh.
	'keyword',

	// gray conflicts with some method names, and has its own method defined.
	'gray',

	// shouldn't really be in color-convert either...
	'hex'
];

var hashedModelKeys = {};
Object.keys(convert).forEach(function (model) {
	hashedModelKeys[_slice.call(convert[model].labels).sort().join('')] = model;
});

var limiters = {};

function Color(obj, model) {
	if (!(this instanceof Color)) {
		return new Color(obj, model);
	}

	if (model && model in skippedModels) {
		model = null;
	}

	if (model && !(model in convert)) {
		throw new Error('Unknown model: ' + model);
	}

	var i;
	var channels;

	if (obj == null) { // eslint-disable-line no-eq-null,eqeqeq
		this.model = 'rgb';
		this.color = [0, 0, 0];
		this.valpha = 1;
	} else if (obj instanceof Color) {
		this.model = obj.model;
		this.color = obj.color.slice();
		this.valpha = obj.valpha;
	} else if (typeof obj === 'string') {
		var result = colorString.get(obj);
		if (result === null) {
			throw new Error('Unable to parse color from string: ' + obj);
		}

		this.model = result.model;
		channels = convert[this.model].channels;
		this.color = result.value.slice(0, channels);
		this.valpha = typeof result.value[channels] === 'number' ? result.value[channels] : 1;
	} else if (obj.length) {
		this.model = model || 'rgb';
		channels = convert[this.model].channels;
		var newArr = _slice.call(obj, 0, channels);
		this.color = zeroArray(newArr, channels);
		this.valpha = typeof obj[channels] === 'number' ? obj[channels] : 1;
	} else if (typeof obj === 'number') {
		// this is always RGB - can be converted later on.
		obj &= 0xFFFFFF;
		this.model = 'rgb';
		this.color = [
			(obj >> 16) & 0xFF,
			(obj >> 8) & 0xFF,
			obj & 0xFF
		];
		this.valpha = 1;
	} else {
		this.valpha = 1;

		var keys = Object.keys(obj);
		if ('alpha' in obj) {
			keys.splice(keys.indexOf('alpha'), 1);
			this.valpha = typeof obj.alpha === 'number' ? obj.alpha : 0;
		}

		var hashedKeys = keys.sort().join('');
		if (!(hashedKeys in hashedModelKeys)) {
			throw new Error('Unable to parse color from object: ' + JSON.stringify(obj));
		}

		this.model = hashedModelKeys[hashedKeys];

		var labels = convert[this.model].labels;
		var color = [];
		for (i = 0; i < labels.length; i++) {
			color.push(obj[labels[i]]);
		}

		this.color = zeroArray(color);
	}

	// perform limitations (clamping, etc.)
	if (limiters[this.model]) {
		channels = convert[this.model].channels;
		for (i = 0; i < channels; i++) {
			var limit = limiters[this.model][i];
			if (limit) {
				this.color[i] = limit(this.color[i]);
			}
		}
	}

	this.valpha = Math.max(0, Math.min(1, this.valpha));

	if (Object.freeze) {
		Object.freeze(this);
	}
}

Color.prototype = {
	toString: function () {
		return this.string();
	},

	toJSON: function () {
		return this[this.model]();
	},

	string: function (places) {
		var self = this.model in colorString.to ? this : this.rgb();
		self = self.round(typeof places === 'number' ? places : 1);
		var args = self.valpha === 1 ? self.color : self.color.concat(this.valpha);
		return colorString.to[self.model](args);
	},

	percentString: function (places) {
		var self = this.rgb().round(typeof places === 'number' ? places : 1);
		var args = self.valpha === 1 ? self.color : self.color.concat(this.valpha);
		return colorString.to.rgb.percent(args);
	},

	array: function () {
		return this.valpha === 1 ? this.color.slice() : this.color.concat(this.valpha);
	},

	object: function () {
		var result = {};
		var channels = convert[this.model].channels;
		var labels = convert[this.model].labels;

		for (var i = 0; i < channels; i++) {
			result[labels[i]] = this.color[i];
		}

		if (this.valpha !== 1) {
			result.alpha = this.valpha;
		}

		return result;
	},

	unitArray: function () {
		var rgb = this.rgb().color;
		rgb[0] /= 255;
		rgb[1] /= 255;
		rgb[2] /= 255;

		if (this.valpha !== 1) {
			rgb.push(this.valpha);
		}

		return rgb;
	},

	unitObject: function () {
		var rgb = this.rgb().object();
		rgb.r /= 255;
		rgb.g /= 255;
		rgb.b /= 255;

		if (this.valpha !== 1) {
			rgb.alpha = this.valpha;
		}

		return rgb;
	},

	round: function (places) {
		places = Math.max(places || 0, 0);
		return new Color(this.color.map(roundToPlace(places)).concat(this.valpha), this.model);
	},

	alpha: function (val) {
		if (arguments.length) {
			return new Color(this.color.concat(Math.max(0, Math.min(1, val))), this.model);
		}

		return this.valpha;
	},

	// rgb
	red: getset('rgb', 0, maxfn(255)),
	green: getset('rgb', 1, maxfn(255)),
	blue: getset('rgb', 2, maxfn(255)),

	hue: getset(['hsl', 'hsv', 'hsl', 'hwb', 'hcg'], 0, function (val) { return ((val % 360) + 360) % 360; }), // eslint-disable-line brace-style

	saturationl: getset('hsl', 1, maxfn(100)),
	lightness: getset('hsl', 2, maxfn(100)),

	saturationv: getset('hsv', 1, maxfn(100)),
	value: getset('hsv', 2, maxfn(100)),

	chroma: getset('hcg', 1, maxfn(100)),
	gray: getset('hcg', 2, maxfn(100)),

	white: getset('hwb', 1, maxfn(100)),
	wblack: getset('hwb', 2, maxfn(100)),

	cyan: getset('cmyk', 0, maxfn(100)),
	magenta: getset('cmyk', 1, maxfn(100)),
	yellow: getset('cmyk', 2, maxfn(100)),
	black: getset('cmyk', 3, maxfn(100)),

	x: getset('xyz', 0, maxfn(100)),
	y: getset('xyz', 1, maxfn(100)),
	z: getset('xyz', 2, maxfn(100)),

	l: getset('lab', 0, maxfn(100)),
	a: getset('lab', 1),
	b: getset('lab', 2),

	keyword: function (val) {
		if (arguments.length) {
			return new Color(val);
		}

		return convert[this.model].keyword(this.color);
	},

	hex: function (val) {
		if (arguments.length) {
			return new Color(val);
		}

		return colorString.to.hex(this.rgb().round().color);
	},

	rgbNumber: function () {
		var rgb = this.rgb().color;
		return ((rgb[0] & 0xFF) << 16) | ((rgb[1] & 0xFF) << 8) | (rgb[2] & 0xFF);
	},

	luminosity: function () {
		// http://www.w3.org/TR/WCAG20/#relativeluminancedef
		var rgb = this.rgb().color;

		var lum = [];
		for (var i = 0; i < rgb.length; i++) {
			var chan = rgb[i] / 255;
			lum[i] = (chan <= 0.03928) ? chan / 12.92 : Math.pow(((chan + 0.055) / 1.055), 2.4);
		}

		return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
	},

	contrast: function (color2) {
		// http://www.w3.org/TR/WCAG20/#contrast-ratiodef
		var lum1 = this.luminosity();
		var lum2 = color2.luminosity();

		if (lum1 > lum2) {
			return (lum1 + 0.05) / (lum2 + 0.05);
		}

		return (lum2 + 0.05) / (lum1 + 0.05);
	},

	level: function (color2) {
		var contrastRatio = this.contrast(color2);
		if (contrastRatio >= 7.1) {
			return 'AAA';
		}

		return (contrastRatio >= 4.5) ? 'AA' : '';
	},

	isDark: function () {
		// YIQ equation from http://24ways.org/2010/calculating-color-contrast
		var rgb = this.rgb().color;
		var yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
		return yiq < 128;
	},

	isLight: function () {
		return !this.isDark();
	},

	negate: function () {
		var rgb = this.rgb();
		for (var i = 0; i < 3; i++) {
			rgb.color[i] = 255 - rgb.color[i];
		}
		return rgb;
	},

	lighten: function (ratio) {
		var hsl = this.hsl();
		hsl.color[2] += hsl.color[2] * ratio;
		return hsl;
	},

	darken: function (ratio) {
		var hsl = this.hsl();
		hsl.color[2] -= hsl.color[2] * ratio;
		return hsl;
	},

	saturate: function (ratio) {
		var hsl = this.hsl();
		hsl.color[1] += hsl.color[1] * ratio;
		return hsl;
	},

	desaturate: function (ratio) {
		var hsl = this.hsl();
		hsl.color[1] -= hsl.color[1] * ratio;
		return hsl;
	},

	whiten: function (ratio) {
		var hwb = this.hwb();
		hwb.color[1] += hwb.color[1] * ratio;
		return hwb;
	},

	blacken: function (ratio) {
		var hwb = this.hwb();
		hwb.color[2] += hwb.color[2] * ratio;
		return hwb;
	},

	grayscale: function () {
		// http://en.wikipedia.org/wiki/Grayscale#Converting_color_to_grayscale
		var rgb = this.rgb().color;
		var val = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
		return Color.rgb(val, val, val);
	},

	fade: function (ratio) {
		return this.alpha(this.valpha - (this.valpha * ratio));
	},

	opaquer: function (ratio) {
		return this.alpha(this.valpha + (this.valpha * ratio));
	},

	rotate: function (degrees) {
		var hsl = this.hsl();
		var hue = hsl.color[0];
		hue = (hue + degrees) % 360;
		hue = hue < 0 ? 360 + hue : hue;
		hsl.color[0] = hue;
		return hsl;
	},

	mix: function (mixinColor, weight) {
		// ported from sass implementation in C
		// https://github.com/sass/libsass/blob/0e6b4a2850092356aa3ece07c6b249f0221caced/functions.cpp#L209
		if (!mixinColor || !mixinColor.rgb) {
			throw new Error('Argument to "mix" was not a Color instance, but rather an instance of ' + typeof mixinColor);
		}
		var color1 = mixinColor.rgb();
		var color2 = this.rgb();
		var p = weight === undefined ? 0.5 : weight;

		var w = 2 * p - 1;
		var a = color1.alpha() - color2.alpha();

		var w1 = (((w * a === -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
		var w2 = 1 - w1;

		return Color.rgb(
				w1 * color1.red() + w2 * color2.red(),
				w1 * color1.green() + w2 * color2.green(),
				w1 * color1.blue() + w2 * color2.blue(),
				color1.alpha() * p + color2.alpha() * (1 - p));
	}
};

// model conversion methods and static constructors
Object.keys(convert).forEach(function (model) {
	if (skippedModels.indexOf(model) !== -1) {
		return;
	}

	var channels = convert[model].channels;

	// conversion methods
	Color.prototype[model] = function () {
		if (this.model === model) {
			return new Color(this);
		}

		if (arguments.length) {
			return new Color(arguments, model);
		}

		var newAlpha = typeof arguments[channels] === 'number' ? channels : this.valpha;
		return new Color(assertArray(convert[this.model][model].raw(this.color)).concat(newAlpha), model);
	};

	// 'static' construction methods
	Color[model] = function (color) {
		if (typeof color === 'number') {
			color = zeroArray(_slice.call(arguments), channels);
		}
		return new Color(color, model);
	};
});

function roundTo(num, places) {
	return Number(num.toFixed(places));
}

function roundToPlace(places) {
	return function (num) {
		return roundTo(num, places);
	};
}

function getset(model, channel, modifier) {
	model = Array.isArray(model) ? model : [model];

	model.forEach(function (m) {
		(limiters[m] || (limiters[m] = []))[channel] = modifier;
	});

	model = model[0];

	return function (val) {
		var result;

		if (arguments.length) {
			if (modifier) {
				val = modifier(val);
			}

			result = this[model]();
			result.color[channel] = val;
			return result;
		}

		result = this[model]().color[channel];
		if (modifier) {
			result = modifier(result);
		}

		return result;
	};
}

function maxfn(max) {
	return function (v) {
		return Math.max(0, Math.min(max, v));
	};
}

function assertArray(val) {
	return Array.isArray(val) ? val : [val];
}

function zeroArray(arr, length) {
	for (var i = 0; i < length; i++) {
		if (typeof arr[i] !== 'number') {
			arr[i] = 0;
		}
	}

	return arr;
}

var color = Color;

var Color$1 = /*@__PURE__*/getDefaultExportFromCjs(color);

const DEFAULT_COLOR = Color$1.hsl(180, 30, 70);
class FlameChartPlugin extends UIPlugin {
    constructor({ data, colors = {}, name = 'flameChartPlugin', }) {
        super(name);
        this.height = 'flexible';
        this.flatTree = [];
        this.positionY = 0;
        this.colors = {};
        this.selectedRegion = null;
        this.hoveredRegion = null;
        this.lastRandomColor = DEFAULT_COLOR;
        this.metaClusterizedFlatTree = [];
        this.actualClusterizedFlatTree = [];
        this.initialClusterizedFlatTree = [];
        this.lastUsedColor = null;
        this.renderChartTimeout = -1;
        this.data = data;
        this.userColors = colors;
        this.parseData();
        this.reset();
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        this.interactionsEngine.on('change-position', this.handlePositionChange.bind(this));
        this.interactionsEngine.on('select', this.handleSelect.bind(this));
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
        this.initData();
    }
    handlePositionChange({ deltaX, deltaY }) {
        const startPositionY = this.positionY;
        const startPositionX = this.renderEngine.parent.positionX;
        this.interactionsEngine.setCursor('grabbing');
        if (this.positionY + deltaY >= 0) {
            this.setPositionY(this.positionY + deltaY);
        }
        else {
            this.setPositionY(0);
        }
        this.renderEngine.tryToChangePosition(deltaX);
        if (startPositionX !== this.renderEngine.parent.positionX || startPositionY !== this.positionY) {
            this.renderEngine.parent.render();
        }
    }
    handleMouseUp() {
        this.interactionsEngine.clearCursor();
    }
    setPositionY(y) {
        this.positionY = y;
    }
    reset() {
        this.colors = {};
        this.lastRandomColor = DEFAULT_COLOR;
        this.positionY = 0;
        this.selectedRegion = null;
    }
    calcMinMax() {
        const { flatTree } = this;
        const { min, max } = getFlatTreeMinMax(flatTree);
        this.min = min;
        this.max = max;
    }
    handleSelect(region) {
        var _a, _b;
        const selectedRegion = this.findNodeInCluster(region);
        if (this.selectedRegion !== selectedRegion) {
            this.selectedRegion = selectedRegion;
            this.renderEngine.render();
            this.emit('select', { node: (_b = (_a = this.selectedRegion) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : null, type: 'flame-chart-node' });
        }
    }
    handleHover(region) {
        this.hoveredRegion = this.findNodeInCluster(region);
    }
    findNodeInCluster(region) {
        const mouse = this.interactionsEngine.getMouse();
        if (region && region.type === "cluster" /* RegionTypes.CLUSTER */) {
            const hoveredNode = region.data.nodes.find(({ level, source: { start, duration } }) => {
                const { x, y, w } = this.calcRect(start, duration, level);
                return mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + this.renderEngine.blockHeight;
            });
            if (hoveredNode) {
                return {
                    data: hoveredNode,
                    type: 'node',
                };
            }
        }
        return null;
    }
    getColor(type = '_default', defaultColor) {
        if (defaultColor) {
            return defaultColor;
        }
        else if (this.colors[type]) {
            return this.colors[type];
        }
        else if (this.userColors[type]) {
            const color = new Color$1(this.userColors[type]);
            this.colors[type] = color.rgb().toString();
            return this.colors[type];
        }
        this.lastRandomColor = this.lastRandomColor.rotate(27);
        this.colors[type] = this.lastRandomColor.rgb().toString();
        return this.colors[type];
    }
    setData(data) {
        this.data = data;
        this.parseData();
        this.initData();
        this.reset();
        this.renderEngine.recalcMinMax();
        this.renderEngine.resetParentView();
    }
    parseData() {
        this.flatTree = flatTree(this.data);
        this.calcMinMax();
    }
    initData() {
        this.metaClusterizedFlatTree = metaClusterizeFlatTree(this.flatTree);
        this.initialClusterizedFlatTree = clusterizeFlatTree(this.metaClusterizedFlatTree, this.renderEngine.zoom, this.min, this.max);
        this.reclusterizeClusteredFlatTree();
    }
    reclusterizeClusteredFlatTree() {
        this.actualClusterizedFlatTree = reclusterizeClusteredFlatTree(this.initialClusterizedFlatTree, this.renderEngine.zoom, this.renderEngine.positionX, this.renderEngine.positionX + this.renderEngine.getRealView());
    }
    calcRect(start, duration, level) {
        const w = duration * this.renderEngine.zoom;
        return {
            x: this.renderEngine.timeToPosition(start),
            y: level * (this.renderEngine.blockHeight + 1) - this.positionY,
            w: w <= 0.1 ? 0.1 : w >= 3 ? w - 1 : w - w / 3,
        };
    }
    renderTooltip() {
        if (this.hoveredRegion) {
            if (this.renderEngine.options.tooltip === false) {
                return true;
            }
            else if (typeof this.renderEngine.options.tooltip === 'function') {
                this.renderEngine.options.tooltip(this.hoveredRegion, this.renderEngine, this.interactionsEngine.getGlobalMouse());
            }
            else {
                const { data: { source: { start, duration, name, children }, }, } = this.hoveredRegion;
                const timeUnits = this.renderEngine.getTimeUnits();
                const selfTime = duration - (children ? children.reduce((acc, { duration }) => acc + duration, 0) : 0);
                const nodeAccuracy = this.renderEngine.getAccuracy() + 2;
                const header = `${name}`;
                const dur = `duration: ${duration.toFixed(nodeAccuracy)} ${timeUnits} ${(children === null || children === void 0 ? void 0 : children.length) ? `(self ${selfTime.toFixed(nodeAccuracy)} ${timeUnits})` : ''}`;
                const st = `start: ${start.toFixed(nodeAccuracy)}`;
                this.renderEngine.renderTooltipFromData([{ text: header }, { text: dur }, { text: st }], this.interactionsEngine.getGlobalMouse());
            }
            return true;
        }
        return false;
    }
    render() {
        const { width, blockHeight, height, minTextWidth } = this.renderEngine;
        this.lastUsedColor = null;
        this.reclusterizeClusteredFlatTree();
        const processCluster = (cb) => {
            return (cluster) => {
                const { start, duration, level } = cluster;
                const { x, y, w } = this.calcRect(start, duration, level);
                if (x + w > 0 && x < width && y + blockHeight > 0 && y < height) {
                    cb(cluster, x, y, w);
                }
            };
        };
        const renderCluster = (cluster, x, y, w) => {
            const { type, nodes, color, pattern, badge } = cluster;
            const mouse = this.interactionsEngine.getMouse();
            if (mouse.y >= y && mouse.y <= y + blockHeight) {
                addHitRegion(cluster, x, y, w);
            }
            if (w >= 0.25) {
                this.renderEngine.addRect({ color: this.getColor(type, color), pattern, x, y, w }, 0);
                if (badge) {
                    const badgePatternName = `node-badge-${badge}`;
                    const badgeWidth = (this.renderEngine.styles.badgeSize * 2) / Math.SQRT2;
                    this.renderEngine.createCachedDefaultPattern({
                        name: badgePatternName,
                        type: 'triangles',
                        config: {
                            color: badge,
                            width: badgeWidth,
                            align: 'top',
                            direction: 'top-left',
                        },
                    });
                    this.renderEngine.addRect({
                        pattern: badgePatternName,
                        color: 'transparent',
                        x,
                        y,
                        w: Math.min(badgeWidth, w),
                    }, 1);
                }
            }
            if (w >= minTextWidth && nodes.length === 1) {
                this.renderEngine.addText({ text: nodes[0].source.name, x, y, w }, 2);
            }
        };
        const addHitRegion = (cluster, x, y, w) => {
            this.interactionsEngine.addHitRegion("cluster" /* RegionTypes.CLUSTER */, cluster, x, y, w, blockHeight);
        };
        this.actualClusterizedFlatTree.forEach(processCluster(renderCluster));
        if (this.selectedRegion && this.selectedRegion.type === 'node') {
            const { source: { start, duration }, level, } = this.selectedRegion.data;
            const { x, y, w } = this.calcRect(start, duration, level);
            this.renderEngine.addStroke({ color: 'green', x, y, w, h: this.renderEngine.blockHeight }, 2);
        }
        clearTimeout(this.renderChartTimeout);
        this.renderChartTimeout = window.setTimeout(() => {
            this.interactionsEngine.clearHitRegions();
            this.actualClusterizedFlatTree.forEach(processCluster(addHitRegion));
        }, 16);
    }
}

const defaultTimeGridPluginStyles = {
    font: '10px sans-serif',
    fontColor: 'black',
};
class TimeGridPlugin extends UIPlugin {
    constructor(settings = {}) {
        super('timeGridPlugin');
        this.styles = defaultTimeGridPluginStyles;
        this.height = 0;
        this.setSettings(settings);
    }
    setSettings({ styles }) {
        this.styles = mergeObjects(defaultTimeGridPluginStyles, styles);
        if (this.renderEngine) {
            this.overrideEngineSettings();
        }
    }
    overrideEngineSettings() {
        this.renderEngine.setSettingsOverrides({ styles: this.styles });
        this.height = Math.round(this.renderEngine.charHeight + 10);
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        this.overrideEngineSettings();
    }
    render() {
        this.renderEngine.parent.timeGrid.renderTimes(this.renderEngine);
        this.renderEngine.parent.timeGrid.renderLines(0, this.renderEngine.height, this.renderEngine);
        return true;
    }
}

class MarksPlugin extends UIPlugin {
    constructor({ data, name = 'marksPlugin' }) {
        super(name);
        this.hoveredRegion = null;
        this.selectedRegion = null;
        this.marks = this.prepareMarks(data);
        this.calcMinMax();
    }
    calcMinMax() {
        const { marks } = this;
        if (marks.length) {
            this.min = marks.reduce((acc, { timestamp }) => (timestamp < acc ? timestamp : acc), marks[0].timestamp);
            this.max = marks.reduce((acc, { timestamp }) => (timestamp > acc ? timestamp : acc), marks[0].timestamp);
        }
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.interactionsEngine.on('select', this.handleSelect.bind(this));
    }
    handleHover(region) {
        this.hoveredRegion = region;
    }
    handleSelect(region) {
        var _a;
        if (this.selectedRegion !== region) {
            this.selectedRegion = region;
            this.emit('select', { node: (_a = region === null || region === void 0 ? void 0 : region.data) !== null && _a !== void 0 ? _a : null, type: 'mark' });
            this.renderEngine.render();
        }
    }
    get height() {
        return this.renderEngine.blockHeight + 2;
    }
    prepareMarks(marks) {
        return marks
            .map(({ color, ...rest }) => ({
            ...rest,
            color: new Color$1(color).alpha(0.7).rgb().toString(),
        }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }
    setMarks(marks) {
        this.marks = this.prepareMarks(marks);
        this.calcMinMax();
        this.renderEngine.recalcMinMax();
        this.renderEngine.resetParentView();
    }
    calcMarksBlockPosition(position, prevEnding) {
        if (position > 0) {
            if (prevEnding > position) {
                return prevEnding;
            }
            return position;
        }
        return position;
    }
    render() {
        this.marks.reduce((prevEnding, node) => {
            const { timestamp, color, shortName } = node;
            const { width } = this.renderEngine.ctx.measureText(shortName);
            const fullWidth = width + this.renderEngine.blockPaddingLeftRight * 2;
            const position = this.renderEngine.timeToPosition(timestamp);
            const blockPosition = this.calcMarksBlockPosition(position, prevEnding);
            this.renderEngine.addRect({ color, x: blockPosition, y: 1, w: fullWidth });
            this.renderEngine.addText({ text: shortName, x: blockPosition, y: 1, w: fullWidth });
            this.interactionsEngine.addHitRegion("timestamp" /* RegionTypes.TIMESTAMP */, node, blockPosition, 1, fullWidth, this.renderEngine.blockHeight);
            return blockPosition + fullWidth;
        }, 0);
    }
    postRender() {
        this.marks.forEach((node) => {
            const { timestamp, color } = node;
            const position = this.renderEngine.timeToPosition(timestamp);
            this.renderEngine.parent.setCtxValue('strokeStyle', color);
            this.renderEngine.parent.setCtxValue('lineWidth', 1);
            this.renderEngine.parent.callCtx('setLineDash', [8, 7]);
            this.renderEngine.parent.ctx.beginPath();
            this.renderEngine.parent.ctx.moveTo(position, this.renderEngine.position);
            this.renderEngine.parent.ctx.lineTo(position, this.renderEngine.parent.height);
            this.renderEngine.parent.ctx.stroke();
        });
    }
    renderTooltip() {
        if (this.hoveredRegion && this.hoveredRegion.type === 'timestamp') {
            if (this.renderEngine.options.tooltip === false) {
                return true;
            }
            else if (typeof this.renderEngine.options.tooltip === 'function') {
                this.renderEngine.options.tooltip(this.hoveredRegion, this.renderEngine, this.interactionsEngine.getGlobalMouse());
            }
            else {
                const { data: { fullName, timestamp }, } = this.hoveredRegion;
                const marksAccuracy = this.renderEngine.getAccuracy() + 2;
                const header = `${fullName}`;
                const time = `${timestamp.toFixed(marksAccuracy)} ${this.renderEngine.timeUnits}`;
                this.renderEngine.renderTooltipFromData([{ text: header }, { text: time }], this.interactionsEngine.getGlobalMouse());
            }
            return true;
        }
        return false;
    }
}

const MIN_PIXEL_DELTA = 85;
const defaultTimeGridStyles = {
    color: 'rgba(90,90,90,0.20)',
};
class TimeGrid {
    constructor(settings) {
        this.styles = defaultTimeGridStyles;
        this.timeUnits = 'ms';
        this.start = 0;
        this.end = 0;
        this.accuracy = 0;
        this.delta = 0;
        this.setSettings(settings);
    }
    setDefaultRenderEngine(renderEngine) {
        this.renderEngine = renderEngine;
        this.timeUnits = this.renderEngine.getTimeUnits();
    }
    setSettings({ styles }) {
        this.styles = mergeObjects(defaultTimeGridStyles, styles);
        if (this.renderEngine) {
            this.timeUnits = this.renderEngine.getTimeUnits();
        }
    }
    recalc() {
        const timeWidth = this.renderEngine.max - this.renderEngine.min;
        const initialLinesCount = this.renderEngine.width / MIN_PIXEL_DELTA;
        const initialTimeLineDelta = timeWidth / initialLinesCount;
        const realView = this.renderEngine.getRealView();
        const proportion = realView / (timeWidth || 1);
        this.delta = initialTimeLineDelta / Math.pow(2, Math.floor(Math.log2(1 / proportion)));
        this.start = Math.floor((this.renderEngine.positionX - this.renderEngine.min) / this.delta);
        this.end = Math.ceil(realView / this.delta) + this.start;
        this.accuracy = this.calcNumberFix();
    }
    calcNumberFix() {
        var _a;
        const strTimelineDelta = (this.delta / 2).toString();
        if (strTimelineDelta.includes('e')) {
            return Number((_a = strTimelineDelta.match(/\d+$/)) === null || _a === void 0 ? void 0 : _a[0]);
        }
        const zeros = strTimelineDelta.match(/(0\.0*)/);
        return zeros ? zeros[0].length - 1 : 0;
    }
    getTimelineAccuracy() {
        return this.accuracy;
    }
    forEachTime(cb) {
        for (let i = this.start; i <= this.end; i++) {
            const timePosition = i * this.delta + this.renderEngine.min;
            const pixelPosition = this.renderEngine.timeToPosition(Number(timePosition.toFixed(this.accuracy)));
            cb(pixelPosition, timePosition);
        }
    }
    renderLines(start, height, renderEngine = this.renderEngine) {
        renderEngine.setCtxValue('fillStyle', this.styles.color);
        this.forEachTime((pixelPosition) => {
            renderEngine.fillRect(pixelPosition, start, 1, height);
        });
    }
    renderTimes(renderEngine = this.renderEngine) {
        renderEngine.setCtxValue('fillStyle', renderEngine.styles.fontColor);
        renderEngine.setCtxFont(renderEngine.styles.font);
        this.forEachTime((pixelPosition, timePosition) => {
            renderEngine.fillText(timePosition.toFixed(this.accuracy) + this.timeUnits, pixelPosition + renderEngine.blockPaddingLeftRight, renderEngine.charHeight);
        });
    }
}

function getValueByChoice(array, property, comparator, defaultValue) {
    if (array.length) {
        return array.reduce((acc, { [property]: value }) => comparator(acc, value), array[0][property]);
    }
    return defaultValue;
}
const parseWaterfall = (waterfall) => {
    return waterfall.items
        .map(({ name, intervals, timing, meta }, index) => {
        const resolvedIntervals = typeof intervals === 'string' ? waterfall.intervals[intervals] : intervals;
        const preparedIntervals = resolvedIntervals
            .map(({ start, end, ...rest }) => ({
            start: typeof start === 'string' ? timing[start] : start,
            end: typeof end === 'string' ? timing[end] : end,
            ...rest,
        }))
            .filter(({ start, end }) => typeof start === 'number' && typeof end === 'number');
        const blocks = preparedIntervals.filter(({ type }) => type === 'block');
        const blockStart = getValueByChoice(blocks, 'start', Math.min, 0);
        const blockEnd = getValueByChoice(blocks, 'end', Math.max, 0);
        const min = getValueByChoice(preparedIntervals, 'start', Math.min, 0);
        const max = getValueByChoice(preparedIntervals, 'end', Math.max, 0);
        return {
            intervals: preparedIntervals,
            textBlock: {
                start: blockStart,
                end: blockEnd,
            },
            name,
            timing,
            min,
            max,
            index,
            meta,
        };
    })
        .filter(({ intervals }) => intervals.length)
        .sort((a, b) => a.min - b.min || b.max - a.max);
};

const castLevelToHeight = (level, minLevel, levelHeight, totalheight) => {
    return totalheight - (level - minLevel) * levelHeight;
};
const defaultChartStyle = {
    fillColor: 'rgba(0, 0, 0, 0.1)',
    lineWidth: 1,
    lineDash: [],
    lineColor: 'rgba(0, 0, 0, 0.5)',
    type: 'smooth',
};
const prepareTmeseries = (timeseries) => {
    const timeboxes = [];
    const preparedTimeseries = timeseries.map((chart) => {
        var _a;
        return ({
            group: chart.units && !chart.group ? chart.units : 'default',
            ...chart,
            style: {
                lineWidth: 1,
                fillColor: 'rgba(0, 0, 0, 0.15)',
                lineColor: 'rgba(0, 0, 0, 0.20)',
                lineDash: [],
                type: 'smooth',
                ...((_a = chart.style) !== null && _a !== void 0 ? _a : {}),
            },
        });
    });
    const summary = preparedTimeseries.reduce((acc, { points, group, min, max }, index) => {
        if (!acc[group]) {
            acc[group] = {
                min: min !== null && min !== void 0 ? min : points[0][1],
                max: max !== null && max !== void 0 ? max : points[0][1],
            };
        }
        timeboxes[index] = {
            start: points[0][0],
            end: last(points)[0],
        };
        points.forEach(([time, value]) => {
            if (min === undefined) {
                acc[group].min = Math.min(acc[group].min, value);
            }
            if (max === undefined) {
                acc[group].max = Math.max(acc[group].max, value);
            }
            timeboxes[index].start = Math.min(timeboxes[index].start, time);
            timeboxes[index].end = Math.max(timeboxes[index].end, time);
        });
        return acc;
    }, {});
    const min = Math.min(...timeboxes.map(({ start }) => start));
    const max = Math.max(...timeboxes.map(({ end }) => end));
    return {
        summary,
        total: {
            min,
            max,
        },
        timeseries: preparedTimeseries,
        timeboxes: timeboxes,
    };
};
const getMinMax = (points, chart, summary) => {
    var _a, _b;
    return chart.dynamicMinMax
        ? points.reduce((acc, [, value]) => {
            acc.min = Math.min(acc.min, value);
            acc.max = Math.max(acc.max, value);
            return acc;
        }, { min: (_a = chart.min) !== null && _a !== void 0 ? _a : Infinity, max: (_b = chart.max) !== null && _b !== void 0 ? _b : -Infinity })
        : chart.group
            ? summary[chart.group]
            : {
                min: -Infinity,
                max: Infinity,
            };
};
const renderChartTooltipFields = (timestamp, { timeseries }) => {
    const targetPoints = timeseries.reduce((acc, { points, units, name, group }) => {
        const point = chartPointsBinarySearch(points, timestamp);
        const hasGroup = group !== units && group !== 'default';
        const resolvedGroup = hasGroup ? group : 'default';
        let result = '';
        if (point) {
            if (name) {
                result += name + ': ';
            }
            result += point[1].toFixed(2);
            if (units) {
                result += units;
            }
        }
        if (!acc[resolvedGroup]) {
            acc[resolvedGroup] = [];
        }
        acc[resolvedGroup].push(result);
        return acc;
    }, {});
    return Object.entries(targetPoints).reduce((acc, [group, values]) => {
        if (group !== 'default') {
            acc.push({
                text: group,
                color: 'black',
            });
        }
        values.forEach((value) => {
            acc.push({
                text: value,
            });
        });
        return acc;
    }, []);
};
const renderChart = ({ engine, points, style, min, max, }) => {
    const resolvedStyle = {
        ...defaultChartStyle,
        ...(style !== null && style !== void 0 ? style : {}),
    };
    engine.setCtxValue('strokeStyle', resolvedStyle.lineColor);
    engine.setCtxValue('fillStyle', resolvedStyle.fillColor);
    engine.setCtxValue('lineWidth', resolvedStyle.lineWidth);
    engine.callCtx('setLineDash', resolvedStyle.lineDash);
    engine.ctx.beginPath();
    const levelHeight = (engine.height - engine.charHeight - 4) / (max - min);
    if (points.length > 1) {
        const xy = points.map(([time, level]) => [
            engine.timeToPosition(time),
            castLevelToHeight(level, min, levelHeight, engine.height),
        ]);
        engine.ctx.moveTo(xy[0][0], engine.height);
        engine.ctx.lineTo(xy[0][0], xy[0][1]);
        if (resolvedStyle.type === 'smooth' || !resolvedStyle.type) {
            for (let i = 1; i < xy.length - 2; i++) {
                const xc = (xy[i][0] + xy[i + 1][0]) / 2;
                const yc = (xy[i][1] + xy[i + 1][1]) / 2;
                engine.ctx.quadraticCurveTo(xy[i][0], xy[i][1], xc, yc);
            }
            const preLastPoint = xy[xy.length - 2];
            const lastPoint = last(xy);
            engine.ctx.quadraticCurveTo(preLastPoint[0], preLastPoint[1], lastPoint[0], lastPoint[1]);
            engine.ctx.quadraticCurveTo(lastPoint[0], lastPoint[1], lastPoint[0], engine.height);
        }
        else if (resolvedStyle.type === 'line') {
            for (let i = 1; i < xy.length; i++) {
                engine.ctx.lineTo(xy[i][0], xy[i][1]);
            }
        }
        else if (resolvedStyle.type === 'bar') {
            for (let i = 0; i < xy.length; i++) {
                const currentPoint = xy[i];
                const prevPoint = xy[i - 1] || currentPoint;
                const nextPoint = xy[i + 1];
                const barWidthLeft = (currentPoint[0] - prevPoint[0]) / 2;
                const barWidthRight = nextPoint ? (nextPoint[0] - currentPoint[0]) / 2 : barWidthLeft;
                engine.ctx.lineTo(prevPoint[0] + barWidthLeft, currentPoint[1]);
                engine.ctx.lineTo(currentPoint[0] + barWidthRight, currentPoint[1]);
                if (nextPoint) {
                    engine.ctx.lineTo(currentPoint[0] + barWidthRight, nextPoint[1]);
                }
                else {
                    engine.ctx.lineTo(currentPoint[0] + barWidthRight, engine.height);
                }
            }
            engine.ctx.lineTo(last(xy)[0], engine.height);
        }
    }
    engine.ctx.closePath();
    engine.ctx.stroke();
    engine.ctx.fill();
};
const chartPointsBinarySearch = (array, value, outside = true) => {
    if (array[0][0] >= value) {
        return outside ? array[0] : null;
    }
    if (last(array)[0] <= value) {
        return outside ? last(array) : null;
    }
    if (array.length <= 1) {
        return array[0];
    }
    let start = 0;
    let end = array.length - 1;
    while (start <= end) {
        const mid = Math.ceil((end + start) / 2);
        if (value >= array[mid - 1][0] && value <= array[mid][0]) {
            const index = Math.abs(value - array[mid - 1][0]) < Math.abs(value - array[mid][0]) ? mid - 1 : mid;
            return array[index];
        }
        if (array[mid][0] < value) {
            start = mid + 1;
        }
        else {
            end = mid - 1;
        }
    }
    return null;
};

const TIMEFRAME_STICK_DISTANCE = 2;
const defaultTimeframeSelectorPluginStyles = {
    font: '9px sans-serif',
    fontColor: 'black',
    overlayColor: 'rgba(112, 112, 112, 0.5)',
    graphStrokeColor: 'rgba(0, 0, 0, 0.10)',
    graphFillColor: 'rgba(0, 0, 0, 0.15)',
    flameChartGraphType: 'smooth',
    waterfallStrokeOpacity: 0.4,
    waterfallFillOpacity: 0.35,
    waterfallGraphType: 'smooth',
    bottomLineColor: 'rgba(0, 0, 0, 0.25)',
    knobColor: 'rgb(131, 131, 131)',
    knobStrokeColor: 'white',
    knobSize: 6,
    height: 60,
    backgroundColor: 'white',
};
class TimeframeSelectorPlugin extends UIPlugin {
    constructor({ waterfall, flameChartNodes, timeseries, settings, name = 'timeframeSelectorPlugin', }) {
        super(name);
        this.styles = defaultTimeframeSelectorPluginStyles;
        this.height = 0;
        this.leftKnobMoving = false;
        this.rightKnobMoving = false;
        this.selectingActive = false;
        this.startSelectingPosition = 0;
        this.actualClusters = [];
        this.clusters = [];
        this.flameChartMaxLevel = 0;
        this.flameChartDots = [];
        this.waterfallDots = [];
        this.waterfallMaxLevel = 0;
        this.actualClusterizedFlatTree = [];
        this.hoveredRegion = null;
        this.flameChartNodes = flameChartNodes;
        this.waterfall = waterfall;
        this.timeseries = timeseries;
        this.shouldRender = true;
        this.setSettings(settings);
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        this.interactionsEngine.on('down', this.handleMouseDown.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
        this.interactionsEngine.on('move', this.handleMouseMove.bind(this));
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.setSettings();
    }
    handleHover(region) {
        this.hoveredRegion = region;
    }
    handleMouseDown(region, mouse) {
        if (region) {
            if (region.type === "timeframeKnob" /* RegionTypes.TIMEFRAME_KNOB */) {
                if (region.data === 'left') {
                    this.leftKnobMoving = true;
                }
                else {
                    this.rightKnobMoving = true;
                }
                this.interactionsEngine.setCursor('ew-resize');
            }
            else if (region.type === "timeframeArea" /* RegionTypes.TIMEFRAME_AREA */) {
                this.selectingActive = true;
                this.startSelectingPosition = mouse.x;
            }
        }
    }
    handleMouseUp(_, mouse, isClick) {
        let isDoubleClick = false;
        if (this.timeout) {
            isDoubleClick = true;
        }
        clearTimeout(this.timeout);
        this.timeout = window.setTimeout(() => (this.timeout = void 0), 300);
        this.leftKnobMoving = false;
        this.rightKnobMoving = false;
        this.interactionsEngine.clearCursor();
        if (this.selectingActive && !isClick) {
            this.applyChanges();
        }
        this.selectingActive = false;
        if (isClick && !isDoubleClick) {
            const rightKnobPosition = this.getRightKnobPosition();
            const leftKnobPosition = this.getLeftKnobPosition();
            if (mouse.x > rightKnobPosition) {
                this.setRightKnobPosition(mouse.x);
            }
            else if (mouse.x > leftKnobPosition && mouse.x < rightKnobPosition) {
                if (mouse.x - leftKnobPosition > rightKnobPosition - mouse.x) {
                    this.setRightKnobPosition(mouse.x);
                }
                else {
                    this.setLeftKnobPosition(mouse.x);
                }
            }
            else {
                this.setLeftKnobPosition(mouse.x);
            }
            this.applyChanges();
        }
        if (isDoubleClick) {
            this.renderEngine.parent.setZoom(this.renderEngine.getInitialZoom());
            this.renderEngine.parent.setPositionX(this.renderEngine.min);
            this.renderEngine.parent.render();
        }
    }
    handleMouseMove(_, mouse) {
        if (this.leftKnobMoving) {
            this.setLeftKnobPosition(mouse.x);
            this.applyChanges();
        }
        if (this.rightKnobMoving) {
            this.setRightKnobPosition(mouse.x);
            this.applyChanges();
        }
        if (this.selectingActive) {
            if (this.startSelectingPosition >= mouse.x) {
                this.setLeftKnobPosition(mouse.x);
                this.setRightKnobPosition(this.startSelectingPosition);
            }
            else {
                this.setRightKnobPosition(mouse.x);
                this.setLeftKnobPosition(this.startSelectingPosition);
            }
            this.renderEngine.render();
        }
    }
    postInit() {
        this.offscreenRenderEngine = this.renderEngine.makeChild();
        this.offscreenRenderEngine.setSettingsOverrides({ styles: this.styles });
        this.timeGrid = new TimeGrid({ styles: this.renderEngine.parent.timeGrid.styles });
        this.timeGrid.setDefaultRenderEngine(this.offscreenRenderEngine);
        this.offscreenRenderEngine.on('resize', () => {
            this.offscreenRenderEngine.setZoom(this.renderEngine.getInitialZoom());
            this.offscreenRender();
        });
        this.offscreenRenderEngine.on('min-max-change', () => (this.shouldRender = true));
        this.setData({
            flameChartNodes: this.flameChartNodes,
            waterfall: this.waterfall,
            timeseries: this.timeseries,
        });
    }
    setLeftKnobPosition(mouseX) {
        const maxPosition = this.getRightKnobPosition();
        if (mouseX < maxPosition - 1) {
            const realView = this.renderEngine.getRealView();
            const delta = this.renderEngine.setPositionX(this.offscreenRenderEngine.pixelToTime(mouseX) + this.renderEngine.min);
            const zoom = this.renderEngine.width / (realView - delta);
            this.renderEngine.setZoom(zoom);
        }
    }
    setRightKnobPosition(mouseX) {
        const minPosition = this.getLeftKnobPosition();
        if (mouseX > minPosition + 1) {
            const realView = this.renderEngine.getRealView();
            const delta = this.renderEngine.positionX +
                realView -
                (this.offscreenRenderEngine.pixelToTime(mouseX) + this.renderEngine.min);
            const zoom = this.renderEngine.width / (realView - delta);
            this.renderEngine.setZoom(zoom);
        }
    }
    getLeftKnobPosition() {
        return (this.renderEngine.positionX - this.renderEngine.min) * this.renderEngine.getInitialZoom();
    }
    getRightKnobPosition() {
        return ((this.renderEngine.positionX - this.renderEngine.min + this.renderEngine.getRealView()) *
            this.renderEngine.getInitialZoom());
    }
    applyChanges() {
        this.renderEngine.parent.setPositionX(this.renderEngine.positionX);
        this.renderEngine.parent.setZoom(this.renderEngine.zoom);
        this.renderEngine.parent.render();
    }
    setSettings({ styles } = { styles: this.styles }) {
        this.styles = mergeObjects(defaultTimeframeSelectorPluginStyles, styles);
        this.height = this.styles.height;
        if (this.offscreenRenderEngine) {
            this.offscreenRenderEngine.setSettingsOverrides({ styles: this.styles });
            this.timeGrid.setSettings({ styles: this.renderEngine.parent.timeGrid.styles });
        }
        this.shouldRender = true;
    }
    makeFlameChartDots() {
        if (this.flameChartNodes) {
            const flameChartDots = [];
            const tree = flatTree(this.flameChartNodes);
            const { min, max } = getFlatTreeMinMax(tree);
            this.min = min;
            this.max = max;
            this.clusters = metaClusterizeFlatTree(tree, () => true);
            this.actualClusters = clusterizeFlatTree(this.clusters, this.renderEngine.zoom, this.min, this.max, TIMEFRAME_STICK_DISTANCE, Infinity);
            this.actualClusterizedFlatTree = reclusterizeClusteredFlatTree(this.actualClusters, this.renderEngine.zoom, this.min, this.max, TIMEFRAME_STICK_DISTANCE, Infinity).sort((a, b) => a.start - b.start);
            this.actualClusterizedFlatTree.forEach(({ start, end }) => {
                flameChartDots.push({
                    time: start,
                    type: 'start',
                }, {
                    time: end,
                    type: 'end',
                });
            });
            flameChartDots.sort((a, b) => a.time - b.time);
            const { dots, maxLevel } = this.makeRenderDots(flameChartDots);
            this.flameChartDots = dots;
            this.flameChartMaxLevel = maxLevel;
        }
    }
    makeRenderDots(dots) {
        const renderDots = [];
        let level = 0;
        let maxLevel = 0;
        dots.forEach(({ type, time }) => {
            if (type === 'start' || type === 'end') {
                renderDots.push([time, level]);
            }
            if (type === 'start') {
                level++;
            }
            else {
                level--;
            }
            maxLevel = Math.max(maxLevel, level);
            renderDots.push([time, level]);
        });
        return {
            dots: renderDots,
            maxLevel,
        };
    }
    makeWaterfallDots() {
        if (this.waterfall) {
            const data = parseWaterfall(this.waterfall);
            const intervals = Object.entries(data.reduce((acc, { intervals }) => {
                intervals.forEach((interval) => {
                    const { timeframeChart } = interval;
                    if (timeframeChart) {
                        const key = typeof timeframeChart === 'string' ? timeframeChart : interval.color;
                        if (!acc[key]) {
                            acc[key] = [];
                        }
                        acc[key].push(interval);
                    }
                });
                return acc;
            }, {}));
            const points = intervals.map(([color, intervals]) => {
                const newPoints = [];
                intervals.forEach(({ start, end }) => {
                    newPoints.push({ type: 'start', time: start });
                    newPoints.push({ type: 'end', time: end });
                });
                newPoints.sort((a, b) => a.time - b.time);
                return {
                    color,
                    points: newPoints,
                };
            });
            let globalMaxLevel = 0;
            this.waterfallDots = points.map(({ color, points }) => {
                const { dots, maxLevel } = this.makeRenderDots(points);
                globalMaxLevel = Math.max(globalMaxLevel, maxLevel);
                return {
                    color,
                    dots,
                };
            });
            this.waterfallMaxLevel = globalMaxLevel;
        }
    }
    prepareTimeseries() {
        var _a;
        if ((_a = this.timeseries) === null || _a === void 0 ? void 0 : _a.length) {
            this.preparedTimeseries = prepareTmeseries(this.timeseries);
        }
        else {
            this.preparedTimeseries = undefined;
        }
    }
    setData({ flameChartNodes, waterfall, timeseries, }) {
        this.flameChartNodes = flameChartNodes;
        this.waterfall = waterfall;
        this.timeseries = timeseries;
        this.makeFlameChartDots();
        this.makeWaterfallDots();
        this.prepareTimeseries();
        this.offscreenRender();
    }
    setTimeseries(timeseries) {
        this.timeseries = timeseries;
        this.prepareTimeseries();
        this.offscreenRender();
    }
    setFlameChartNodes(flameChartNodes) {
        this.flameChartNodes = flameChartNodes;
        this.makeFlameChartDots();
        this.offscreenRender();
    }
    setWaterfall(waterfall) {
        this.waterfall = waterfall;
        this.makeWaterfallDots();
        this.offscreenRender();
    }
    offscreenRender() {
        const zoom = this.offscreenRenderEngine.getInitialZoom();
        this.offscreenRenderEngine.setZoom(zoom);
        this.offscreenRenderEngine.setPositionX(this.offscreenRenderEngine.min);
        this.offscreenRenderEngine.clear();
        this.timeGrid.recalc();
        this.timeGrid.renderLines(0, this.offscreenRenderEngine.height);
        this.timeGrid.renderTimes();
        renderChart({
            engine: this.offscreenRenderEngine,
            points: this.flameChartDots,
            min: 0,
            max: this.flameChartMaxLevel,
            style: {
                lineColor: this.styles.graphStrokeColor,
                fillColor: this.styles.graphFillColor,
                type: this.styles.flameChartGraphType,
            },
        });
        this.waterfallDots.forEach(({ color, dots }) => {
            const colorObj = new Color$1(color);
            renderChart({
                engine: this.offscreenRenderEngine,
                points: dots,
                min: 0,
                max: this.waterfallMaxLevel,
                style: {
                    lineColor: colorObj.alpha(this.styles.waterfallStrokeOpacity).rgb().toString(),
                    fillColor: colorObj.alpha(this.styles.waterfallFillOpacity).rgb().toString(),
                    type: this.styles.waterfallGraphType,
                },
            });
        });
        if (this.preparedTimeseries) {
            const { summary, timeseries } = this.preparedTimeseries;
            timeseries.forEach((chart) => {
                const minmax = getMinMax(chart.points, chart, summary);
                renderChart({
                    engine: this.offscreenRenderEngine,
                    points: chart.points,
                    min: minmax.min,
                    max: minmax.max,
                    style: chart.style,
                });
            });
        }
        this.offscreenRenderEngine.setCtxValue('fillStyle', this.styles.bottomLineColor);
        this.offscreenRenderEngine.ctx.fillRect(0, this.height - 1, this.offscreenRenderEngine.width, 1);
    }
    renderTimeframe() {
        const relativePositionX = this.renderEngine.positionX - this.renderEngine.min;
        const currentLeftPosition = relativePositionX * this.renderEngine.getInitialZoom();
        const currentRightPosition = (relativePositionX + this.renderEngine.getRealView()) * this.renderEngine.getInitialZoom();
        const currentLeftKnobPosition = currentLeftPosition - this.styles.knobSize / 2;
        const currentRightKnobPosition = currentRightPosition - this.styles.knobSize / 2;
        const knobHeight = this.renderEngine.height / 3;
        this.renderEngine.setCtxValue('fillStyle', this.styles.overlayColor);
        this.renderEngine.fillRect(0, 0, currentLeftPosition, this.renderEngine.height);
        this.renderEngine.fillRect(currentRightPosition, 0, this.renderEngine.width - currentRightPosition, this.renderEngine.height);
        this.renderEngine.setCtxValue('fillStyle', this.styles.overlayColor);
        this.renderEngine.fillRect(currentLeftPosition - 1, 0, 1, this.renderEngine.height);
        this.renderEngine.fillRect(currentRightPosition + 1, 0, 1, this.renderEngine.height);
        this.renderEngine.setCtxValue('fillStyle', this.styles.knobColor);
        this.renderEngine.fillRect(currentLeftKnobPosition, 0, this.styles.knobSize, knobHeight);
        this.renderEngine.fillRect(currentRightKnobPosition, 0, this.styles.knobSize, knobHeight);
        this.renderEngine.renderStroke(this.styles.knobStrokeColor, currentLeftKnobPosition, 0, this.styles.knobSize, knobHeight);
        this.renderEngine.renderStroke(this.styles.knobStrokeColor, currentRightKnobPosition, 0, this.styles.knobSize, knobHeight);
        this.interactionsEngine.addHitRegion("timeframeKnob" /* RegionTypes.TIMEFRAME_KNOB */, 'left', currentLeftKnobPosition, 0, this.styles.knobSize, knobHeight, "ew-resize" /* CursorTypes.EW_RESIZE */);
        this.interactionsEngine.addHitRegion("timeframeKnob" /* RegionTypes.TIMEFRAME_KNOB */, 'right', currentRightKnobPosition, 0, this.styles.knobSize, knobHeight, "ew-resize" /* CursorTypes.EW_RESIZE */);
        this.interactionsEngine.addHitRegion("timeframeArea" /* RegionTypes.TIMEFRAME_AREA */, null, 0, 0, this.renderEngine.width, this.renderEngine.height, "text" /* CursorTypes.TEXT */);
    }
    renderTooltip() {
        if (this.hoveredRegion) {
            const mouseX = this.interactionsEngine.getMouse().x;
            const currentTimestamp = mouseX / this.renderEngine.getInitialZoom() + this.renderEngine.min;
            const time = `${currentTimestamp.toFixed(this.renderEngine.getAccuracy() + 2)} ${this.renderEngine.timeUnits}`;
            const timeseriesFields = this.preparedTimeseries
                ? renderChartTooltipFields(currentTimestamp, this.preparedTimeseries)
                : [];
            this.renderEngine.renderTooltipFromData([
                {
                    text: time,
                },
                ...timeseriesFields,
            ], this.interactionsEngine.getGlobalMouse());
            return true;
        }
        return false;
    }
    render() {
        if (this.shouldRender) {
            this.shouldRender = false;
            this.offscreenRender();
        }
        this.renderEngine.copy(this.offscreenRenderEngine);
        this.renderTimeframe();
        this.interactionsEngine.addHitRegion("timeframe" /* RegionTypes.TIMEFRAME */, null, 0, 0, this.renderEngine.width, this.height);
        return true;
    }
}

const defaultTimeseriesPluginStyles = {
    height: 56,
};
const EXTRA_POINTS_FOR_RENDER = 2;
class TimeseriesPlugin extends UIPlugin {
    constructor({ name = 'timeseriesPlugin', data, settings, }) {
        super(name);
        this.height = 56;
        this.hoveredRegion = null;
        this.setSettings(settings);
        this.setData(data);
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        this.interactionsEngine.on('change-position', this.handlePositionChange.bind(this));
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
    }
    handlePositionChange(position) {
        const startPositionX = this.renderEngine.parent.positionX;
        this.interactionsEngine.setCursor("grabbing" /* CursorTypes.GRABBING */);
        this.renderEngine.tryToChangePosition(position.deltaX);
        if (startPositionX !== this.renderEngine.parent.positionX) {
            this.renderEngine.parent.render();
        }
    }
    handleMouseUp() {
        this.interactionsEngine.clearCursor();
    }
    setSettings({ styles } = { styles: this.styles }) {
        this.styles = mergeObjects(defaultTimeseriesPluginStyles, styles);
        this.height = this.styles.height;
    }
    setData(data) {
        const preparedTmeseries = prepareTmeseries(data);
        this.data = preparedTmeseries;
        this.min = preparedTmeseries.total.min;
        this.max = preparedTmeseries.total.max;
        if (this.renderEngine) {
            this.renderEngine.recalcMinMax();
            this.renderEngine.resetParentView();
        }
    }
    handleHover(region) {
        this.hoveredRegion = region;
    }
    renderTooltip() {
        if (this.hoveredRegion) {
            const mouseX = this.interactionsEngine.getMouse().x;
            const currentTimestamp = this.renderEngine.pixelToTime(mouseX) + this.renderEngine.positionX;
            const time = `${currentTimestamp.toFixed(this.renderEngine.getAccuracy() + 2)} ${this.renderEngine.timeUnits}`;
            const values = renderChartTooltipFields(currentTimestamp, this.data);
            this.renderEngine.renderTooltipFromData([
                {
                    text: time,
                },
                ...values,
            ], this.interactionsEngine.getGlobalMouse());
            return true;
        }
        return false;
    }
    render() {
        if (this.data.timeseries.length === 0) {
            return;
        }
        const timestampStart = this.renderEngine.positionX;
        const timestampEnd = this.renderEngine.positionX + this.renderEngine.getRealView();
        this.data.timeseries.forEach((chart, index) => {
            if (this.data.timeboxes[index].end < timestampStart || this.data.timeboxes[index].start > timestampEnd) {
                return;
            }
            const leftIndex = timestampStart <= this.data.timeboxes[index].start
                ? 0
                : Math.max(chart.points.findIndex(([timestamp]) => timestamp >= timestampStart) -
                    EXTRA_POINTS_FOR_RENDER, 0);
            const rightIndex = timestampEnd >= this.data.timeboxes[index].end
                ? chart.points.length
                : chart.points.findIndex(([timestamp]) => timestamp >= timestampEnd) + EXTRA_POINTS_FOR_RENDER;
            const visiblePoints = chart.points.slice(leftIndex, rightIndex);
            const minmax = getMinMax(visiblePoints, chart, this.data.summary);
            renderChart({
                engine: this.renderEngine,
                points: visiblePoints,
                min: minmax.min,
                max: minmax.max,
                style: chart.style,
            });
        });
        this.interactionsEngine.addHitRegion("timeseries" /* RegionTypes.TIMESERIES */, null, 0, 0, this.renderEngine.width, this.height);
    }
}

const defaultWaterfallPluginStyles = {
    defaultHeight: 68,
    lineWidth: 1,
    lineHeight: 'inherit',
};
class WaterfallPlugin extends UIPlugin {
    constructor({ data, name = 'waterfallPlugin', settings, }) {
        super(name);
        this.styles = defaultWaterfallPluginStyles;
        this.height = defaultWaterfallPluginStyles.defaultHeight;
        this.data = [];
        this.positionY = 0;
        this.hoveredRegion = null;
        this.selectedRegion = null;
        this.initialData = [];
        this.setData(data);
        this.setSettings(settings);
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        this.interactionsEngine.on('change-position', this.handlePositionChange.bind(this));
        this.interactionsEngine.on('hover', this.handleHover.bind(this));
        this.interactionsEngine.on('select', this.handleSelect.bind(this));
        this.interactionsEngine.on('up', this.handleMouseUp.bind(this));
    }
    handlePositionChange({ deltaX, deltaY }) {
        const startPositionY = this.positionY;
        const startPositionX = this.renderEngine.parent.positionX;
        this.interactionsEngine.setCursor('grabbing');
        if (this.positionY + deltaY >= 0) {
            this.setPositionY(this.positionY + deltaY);
        }
        else {
            this.setPositionY(0);
        }
        this.renderEngine.tryToChangePosition(deltaX);
        if (startPositionX !== this.renderEngine.parent.positionX || startPositionY !== this.positionY) {
            this.renderEngine.parent.render();
        }
    }
    handleMouseUp() {
        this.interactionsEngine.clearCursor();
    }
    handleHover(region) {
        this.hoveredRegion = region;
    }
    handleSelect(region) {
        var _a;
        if (this.selectedRegion !== region) {
            this.selectedRegion = region;
            const index = (_a = region === null || region === void 0 ? void 0 : region.data) !== null && _a !== void 0 ? _a : null;
            this.emit('select', {
                node: index !== null ? this.initialData[index] : null,
                type: 'waterfall-node',
            });
            this.renderEngine.render();
        }
    }
    setPositionY(y) {
        this.positionY = y;
    }
    setSettings({ styles }) {
        this.styles = mergeObjects(defaultWaterfallPluginStyles, styles);
        this.height = this.styles.defaultHeight;
        this.positionY = 0;
    }
    setData(waterfall) {
        this.positionY = 0;
        this.initialData = waterfall.items;
        this.data = parseWaterfall(waterfall);
        if (waterfall.items.length) {
            this.min = this.data.reduce((acc, { min }) => Math.min(acc, min), this.data[0].min);
            this.max = this.data.reduce((acc, { max }) => Math.max(acc, max), this.data[0].max);
        }
        if (this.renderEngine) {
            this.renderEngine.recalcMinMax();
            this.renderEngine.resetParentView();
        }
    }
    calcRect(start, duration, isEnd) {
        const w = duration * this.renderEngine.zoom;
        return {
            x: this.renderEngine.timeToPosition(start),
            w: isEnd ? (w <= 0.1 ? 0.1 : w >= 3 ? w - 1 : w - w / 3) : w,
        };
    }
    renderTooltip() {
        if (this.hoveredRegion) {
            if (this.renderEngine.options.tooltip === false) {
                return true;
            }
            else if (typeof this.renderEngine.options.tooltip === 'function') {
                const { data: index } = this.hoveredRegion;
                const data = { ...this.hoveredRegion };
                // @ts-ignore data type on waterfall item is number but here it is something else?
                data.data = this.data.find(({ index: i }) => index === i);
                this.renderEngine.options.tooltip(data, this.renderEngine, this.interactionsEngine.getGlobalMouse());
            }
            else {
                const { data: index } = this.hoveredRegion;
                const dataItem = this.data.find(({ index: i }) => index === i);
                if (dataItem) {
                    const { name, intervals, timing, meta = [] } = dataItem;
                    const timeUnits = this.renderEngine.getTimeUnits();
                    const nodeAccuracy = this.renderEngine.getAccuracy() + 2;
                    const header = { text: `${name}` };
                    const intervalsHeader = {
                        text: 'intervals',
                        color: this.renderEngine.styles.tooltipHeaderFontColor,
                    };
                    const intervalsTexts = intervals.map(({ name, start, end }) => ({
                        text: `${name}: ${(end - start).toFixed(nodeAccuracy)} ${timeUnits}`,
                    }));
                    const timingHeader = { text: 'timing', color: this.renderEngine.styles.tooltipHeaderFontColor };
                    const timingTexts = Object.entries(timing)
                        .filter(([, time]) => typeof time === 'number')
                        .map(([name, time]) => ({
                        text: `${name}: ${time.toFixed(nodeAccuracy)} ${timeUnits}`,
                    }));
                    const metaHeader = { text: 'meta', color: this.renderEngine.styles.tooltipHeaderFontColor };
                    const metaTexts = meta
                        ? meta.map(({ name, value, color }) => ({
                            text: `${name}: ${value}`,
                            color,
                        }))
                        : [];
                    this.renderEngine.renderTooltipFromData([
                        header,
                        intervalsHeader,
                        ...intervalsTexts,
                        timingHeader,
                        ...timingTexts,
                        ...(metaTexts.length ? [metaHeader, ...metaTexts] : []),
                    ], this.interactionsEngine.getGlobalMouse());
                }
            }
            return true;
        }
        return false;
    }
    render() {
        const rightSide = this.renderEngine.positionX + this.renderEngine.getRealView();
        const leftSide = this.renderEngine.positionX;
        const blockHeight = this.renderEngine.blockHeight + 1;
        const stack = [];
        const viewedData = this.data
            .filter(({ min, max }) => !((rightSide < min && rightSide < max) || (leftSide > max && rightSide > min)))
            .map((entry) => {
            while (stack.length && entry.min - last(stack).max > 0) {
                stack.pop();
            }
            const level = stack.length;
            const result = {
                ...entry,
                level,
            };
            stack.push(entry);
            return result;
        });
        viewedData.forEach(({ name, intervals, textBlock, level, index }) => {
            const y = level * blockHeight - this.positionY;
            if (y + blockHeight >= 0 && y - blockHeight <= this.renderEngine.height) {
                const textStart = this.renderEngine.timeToPosition(textBlock.start);
                const textEnd = this.renderEngine.timeToPosition(textBlock.end);
                this.renderEngine.addText({ text: name, x: textStart, y: y, w: textEnd - textStart });
                const { x, w } = intervals.reduce((acc, { color, pattern, start, end, type }, index) => {
                    const { x, w } = this.calcRect(start, end - start, index === intervals.length - 1);
                    if (type === 'block') {
                        this.renderEngine.addRect({ color, pattern, x, y, w });
                    }
                    else if (type === 'line') {
                        const lineWidth = Math.min(this.styles.lineWidth, w);
                        this.renderEngine.addRect({
                            color,
                            pattern,
                            x: index === 0 ? x + lineWidth : x,
                            y: y + (blockHeight - this.styles.lineWidth) / 2,
                            w: index === intervals.length - 1 ? w - lineWidth : w,
                            h: this.styles.lineWidth,
                        });
                        if (index === 0 || index === intervals.length - 1) {
                            const lineHeight = this.styles.lineHeight === 'inherit' ? blockHeight / 2 : this.styles.lineHeight;
                            this.renderEngine.addRect({
                                color,
                                pattern,
                                x: index === 0 ? x : x + w - lineWidth,
                                y: y + (blockHeight - lineHeight) / 2,
                                w: lineWidth,
                                h: lineHeight,
                            });
                        }
                    }
                    return {
                        x: acc.x === null ? x : acc.x,
                        w: w + acc.w,
                    };
                }, { x: null, w: 0 });
                if (this.selectedRegion && this.selectedRegion.type === 'waterfall-node') {
                    const selectedIndex = this.selectedRegion.data;
                    if (selectedIndex === index) {
                        this.renderEngine.addStroke({
                            color: 'green',
                            x: x !== null && x !== void 0 ? x : 0,
                            y,
                            w,
                            h: this.renderEngine.blockHeight,
                        });
                    }
                }
                this.interactionsEngine.addHitRegion("waterfall-node" /* RegionTypes.WATERFALL_NODE */, index, x !== null && x !== void 0 ? x : 0, y, w, this.renderEngine.blockHeight);
            }
        }, 0);
    }
}

const defaultTogglePluginStyles = {
    height: 16,
    color: 'rgb(202,202,202, 0.25)',
    strokeColor: 'rgb(138,138,138, 0.50)',
    dotsColor: 'rgb(97,97,97)',
    fontColor: 'black',
    font: '10px sans-serif',
    triangleWidth: 10,
    triangleHeight: 7,
    triangleColor: 'black',
    leftPadding: 10,
};
class TogglePlugin extends UIPlugin {
    constructor(title, settings) {
        super('togglePlugin');
        this.styles = defaultTogglePluginStyles;
        this.height = 0;
        this.resizeActive = false;
        this.resizeStartHeight = 0;
        this.resizeStartPosition = 0;
        this.setSettings(settings);
        this.title = title;
    }
    setSettings({ styles } = {}) {
        this.styles = mergeObjects(defaultTogglePluginStyles, styles);
        this.height = this.styles.height + 1;
    }
    init(renderEngine, interactionsEngine) {
        super.init(renderEngine, interactionsEngine);
        const nextEngine = this.getNextEngine();
        nextEngine.setFlexible();
        this.interactionsEngine.on('click', (region) => {
            if (region && region.type === 'toggle' && region.data === this.renderEngine.id) {
                const nextEngine = this.getNextEngine();
                if (nextEngine.collapsed) {
                    nextEngine.expand();
                }
                else {
                    nextEngine.collapse();
                }
                this.renderEngine.parent.recalcChildrenLayout();
                this.renderEngine.parent.render();
            }
        });
        this.interactionsEngine.on('down', (region) => {
            if (region && region.type === 'knob-resize' && region.data === this.renderEngine.id) {
                const prevEngine = this.getPrevEngine();
                this.interactionsEngine.setCursor('row-resize');
                this.resizeActive = true;
                this.resizeStartHeight = prevEngine.height;
                this.resizeStartPosition = this.interactionsEngine.getGlobalMouse().y;
            }
        });
        this.interactionsEngine.parent.on('move', () => {
            if (this.resizeActive) {
                const prevEngine = this.getPrevEngine();
                const mouse = this.interactionsEngine.getGlobalMouse();
                if (prevEngine.flexible) {
                    const newPosition = this.resizeStartHeight - (this.resizeStartPosition - mouse.y);
                    if (newPosition <= 0) {
                        prevEngine.collapse();
                        prevEngine.resize({ height: 0 });
                    }
                    else {
                        if (prevEngine.collapsed) {
                            prevEngine.expand();
                        }
                        prevEngine.resize({ height: newPosition });
                    }
                    this.renderEngine.parent.render();
                }
            }
        });
        this.interactionsEngine.parent.on('up', () => {
            this.interactionsEngine.clearCursor();
            this.resizeActive = false;
        });
    }
    getPrevEngine() {
        var _a;
        const prevRenderEngineId = ((_a = this.renderEngine.id) !== null && _a !== void 0 ? _a : 0) - 1;
        return this.renderEngine.parent.children[prevRenderEngineId];
    }
    getNextEngine() {
        var _a;
        const nextRenderEngineId = ((_a = this.renderEngine.id) !== null && _a !== void 0 ? _a : 0) + 1;
        return this.renderEngine.parent.children[nextRenderEngineId];
    }
    render() {
        const nextEngine = this.getNextEngine();
        const prevEngine = this.getPrevEngine();
        const triangleFullWidth = this.styles.leftPadding + this.styles.triangleWidth;
        const centerW = this.renderEngine.width / 2;
        const centerH = this.styles.height / 2;
        this.renderEngine.setCtxFont(this.styles.font);
        this.renderEngine.setCtxValue('fillStyle', this.styles.color);
        this.renderEngine.setCtxValue('strokeStyle', this.styles.strokeColor);
        this.renderEngine.fillRect(0, 0, this.renderEngine.width, this.styles.height);
        this.renderEngine.setCtxValue('fillStyle', this.styles.fontColor);
        this.renderEngine.addText({ text: this.title, x: triangleFullWidth, y: 0, w: this.renderEngine.width });
        if (!nextEngine.collapsed) {
            this.renderEngine.renderTriangle({
                color: this.styles.triangleColor,
                x: this.styles.leftPadding,
                y: (this.styles.height - this.styles.triangleHeight) / 2,
                width: this.styles.triangleWidth,
                height: this.styles.triangleHeight,
                direction: 'bottom',
            });
        }
        else {
            this.renderEngine.renderTriangle({
                color: this.styles.triangleColor,
                x: this.styles.leftPadding + this.styles.triangleHeight / 2,
                y: (this.styles.height - this.styles.triangleWidth) / 2,
                width: this.styles.triangleWidth,
                height: this.styles.triangleHeight,
                direction: 'right',
            });
        }
        const { width: titleWidth } = this.renderEngine.ctx.measureText(this.title);
        const buttonWidth = titleWidth + triangleFullWidth;
        this.interactionsEngine.addHitRegion("toggle" /* RegionTypes.TOGGLE */, this.renderEngine.id, 0, 0, buttonWidth, this.styles.height, "pointer" /* CursorTypes.POINTER */);
        if (prevEngine.flexible) {
            this.renderEngine.renderCircle(this.styles.dotsColor, centerW, centerH, 1.5);
            this.renderEngine.renderCircle(this.styles.dotsColor, centerW - 10, centerH, 1.5);
            this.renderEngine.renderCircle(this.styles.dotsColor, centerW + 10, centerH, 1.5);
            this.interactionsEngine.addHitRegion("knob-resize" /* RegionTypes.KNOB_RESIZE */, this.renderEngine.id, buttonWidth, 0, this.renderEngine.width - buttonWidth, this.styles.height, "row-resize" /* CursorTypes.ROW_RESIZE */);
        }
    }
}

const createPatternCanvas = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return {
        ctx,
        canvas,
    };
};

const stripesPattern = ({ color = 'black', background = 'rgb(255,255,255, 0)', lineWidth = 6, spacing = 4, angle = 45, dash, } = {}) => (engine) => {
    const { ctx, canvas } = createPatternCanvas();
    const scale = 4;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    canvas.height = engine.blockHeight * scale;
    const realLineWidth = lineWidth * scale;
    const realSpacing = spacing * scale + realLineWidth;
    const angleRad = (angle * Math.PI) / 180.0;
    const isAscending = (angleRad > (Math.PI * 3) / 2 && angleRad < Math.PI * 2) || (angleRad > Math.PI / 2 && angleRad < Math.PI);
    const isStraight = angleRad === Math.PI || angleRad === Math.PI * 2;
    const isPerpendicular = angleRad === Math.PI / 2 || angleRad === (Math.PI * 3) / 2;
    const width = isStraight || isPerpendicular
        ? isStraight
            ? realLineWidth
            : realLineWidth + realSpacing / 2
        : Math.abs(Math.ceil(realSpacing / Math.cos(Math.PI / 2 - angleRad)));
    canvas.width = width;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = realLineWidth;
    ctx.lineCap = 'square';
    let y = 0;
    ctx.beginPath();
    if (dash) {
        ctx.setLineDash(dash.map((value) => value * scale));
    }
    if (isStraight) {
        y = realLineWidth / 2;
        while (y <= canvas.height) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            y += realSpacing;
        }
    }
    else if (isPerpendicular) {
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, canvas.height);
    }
    else {
        const delta = Math.abs(realSpacing / Math.cos(angleRad));
        const fixY = Math.abs(Math.ceil(Math.sin(angleRad) * realLineWidth));
        if (!isAscending) {
            while (y <= canvas.height + realLineWidth) {
                ctx.moveTo(0, y - fixY);
                y += delta;
                ctx.lineTo(width, y - fixY);
            }
        }
        else {
            y = canvas.height;
            while (y >= 0 - realLineWidth) {
                ctx.moveTo(0, y + fixY);
                y -= delta;
                ctx.lineTo(width, y + fixY);
            }
        }
    }
    ctx.stroke();
    const pattern = engine.ctx.createPattern(canvas, 'repeat');
    return {
        pattern,
        width,
        scale,
    };
};

const dotsPattern = ({ color = 'black', background = 'rgb(255,255,255, 0)', size = 2, rows, align = 'center', spacing = 2, verticalSpicing = spacing, horizontalSpicing = spacing, } = {}) => (engine) => {
    const { ctx, canvas } = createPatternCanvas();
    const scale = 4;
    const realSize = size * scale;
    const radius = realSize / 2;
    const realVerticalSpacing = verticalSpicing * scale;
    const realHorizontalSpacing = horizontalSpicing * scale;
    const width = (size + realHorizontalSpacing / 4) * scale;
    const height = engine.blockHeight * scale;
    const rowsCount = rows ? rows : Math.floor(height / (realSize + realVerticalSpacing));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    canvas.height = height;
    canvas.width = width;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    const freeSpace = height - ((realSize + realVerticalSpacing) * rowsCount - realVerticalSpacing);
    const padding = align === 'center' ? freeSpace / 2 : align === 'top' ? 0 : freeSpace;
    for (let row = 0; row < rowsCount; row++) {
        ctx.arc(width / 2, padding + (realSize + realVerticalSpacing) * row + radius, radius, 0, 2 * Math.PI);
        ctx.fill();
    }
    const pattern = engine.ctx.createPattern(canvas, 'repeat');
    return {
        pattern,
        width,
        scale,
    };
};

const gradientPattern = ({ colors }) => (engine) => {
    const { ctx, canvas } = createPatternCanvas();
    const scale = 4;
    const width = scale;
    const height = engine.blockHeight * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    canvas.height = height;
    canvas.width = width;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    for (const { offset, color } of colors) {
        gradient.addColorStop(offset, color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const pattern = engine.ctx.createPattern(canvas, 'repeat');
    return {
        pattern,
        width,
        scale,
    };
};

const trianglesPattern = ({ color = 'black', background = 'rgb(255,255,255, 0)', width = 16, height = width / 2, align = 'center', direction = 'right', spacing = width, }) => (engine) => {
    const { ctx, canvas } = createPatternCanvas();
    const scale = 4;
    const points = getTrianglePoints(width * scale, height * scale, direction);
    const maxWidth = Math.max(...points.map(({ x }) => x));
    const maxHeight = Math.max(...points.map(({ y }) => y));
    const fullWidth = maxWidth + spacing * scale;
    const fullHeight = engine.blockHeight * scale;
    const delta = align === 'center' ? (fullHeight - maxHeight) / 2 : align === 'top' ? 0 : fullHeight - maxHeight;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    canvas.height = fullHeight;
    canvas.width = fullWidth;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y + delta);
    points.slice(1).forEach(({ x, y }) => ctx.lineTo(x, y + delta));
    ctx.closePath();
    ctx.fill();
    const pattern = engine.ctx.createPattern(canvas, 'repeat');
    return {
        pattern,
        width: fullWidth,
        scale,
    };
};

const combinedPatterns = {
    stripes: stripesPattern,
    dots: dotsPattern,
    gradient: gradientPattern,
    triangles: trianglesPattern,
};
function findMinIntegerWidth(arr, max = Infinity) {
    const maxNumber = Math.max(...arr);
    if (arr.every((n) => maxNumber % n === 0)) {
        return maxNumber;
    }
    let num = 1;
    while (num < max) {
        let isDivisor = true;
        for (let i = 0; i < arr.length; i++) {
            if (num % arr[i] !== 0) {
                isDivisor = false;
                break;
            }
        }
        if (isDivisor) {
            return num;
        }
        num++;
    }
    return max;
}
const combinedPattern = (patterns) => (engine) => {
    const { ctx, canvas } = createPatternCanvas();
    const scale = 4;
    const renderedPatterns = patterns.map((pattern) => {
        if ('creator' in pattern) {
            return pattern.creator(engine);
        }
        return combinedPatterns[pattern.type](pattern.config)(engine);
    });
    const height = engine.blockHeight * scale;
    const width = findMinIntegerWidth(renderedPatterns.map(({ width = 1, scale: patternScale = 1 }) => width * (scale / patternScale)), engine.width * scale);
    const maxScale = Math.max(...renderedPatterns.map((pattern) => pattern.scale || 1));
    ctx.setTransform(maxScale, 0, 0, maxScale, 0, 0);
    canvas.height = height;
    canvas.width = width;
    renderedPatterns.forEach(({ scale: patternScale = 1, pattern }) => {
        ctx.fillStyle = pattern;
        pattern.setTransform(new DOMMatrixReadOnly().scale(scale / patternScale, scale / patternScale));
        ctx.fillRect(0, 0, width, height);
    });
    const pattern = engine.ctx.createPattern(canvas, 'repeat');
    return {
        pattern,
        width,
        scale,
    };
};

const defaultPatterns = {
    stripes: stripesPattern,
    dots: dotsPattern,
    gradient: gradientPattern,
    triangles: trianglesPattern,
    combined: combinedPattern,
};

// eslint-disable-next-line prettier/prettier -- prettier complains about escaping of the " character
const allChars = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890_-+()[]{}\\/|\'";:.,?~';
const checkSafari = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('safari') ? !ua.includes('chrome') : false;
};
function getPixelRatio(context) {
    // Unfortunately using any here, since typescript is not aware of all of the browser prefixes
    const ctx = context;
    const dpr = window.devicePixelRatio || 1;
    const bsr = ctx.webkitBackingStorePixelRatio ||
        ctx.mozBackingStorePixelRatio ||
        ctx.msBackingStorePixelRatio ||
        ctx.oBackingStorePixelRatio ||
        ctx.backingStorePixelRatio ||
        1;
    return dpr / bsr;
}
const defaultRenderSettings = {
    tooltip: undefined,
    timeUnits: 'ms',
};
const defaultRenderStyles = {
    blockHeight: 16,
    blockPaddingLeftRight: 4,
    backgroundColor: 'white',
    font: '10px sans-serif',
    fontColor: 'black',
    badgeSize: 8,
    tooltipHeaderFontColor: 'black',
    tooltipBodyFontColor: '#688f45',
    tooltipBackgroundColor: 'white',
    tooltipShadowColor: 'black',
    tooltipShadowBlur: 6,
    tooltipShadowOffsetX: 0,
    tooltipShadowOffsetY: 0,
    headerHeight: 14,
    headerColor: 'rgba(112, 112, 112, 0.25)',
    headerStrokeColor: 'rgba(112, 112, 112, 0.5)',
    headerTitleLeftPadding: 16,
};
class BasicRenderEngine extends EventEmitter {
    constructor(canvas, settings) {
        super();
        this.options = defaultRenderSettings;
        this.timeUnits = 'ms';
        this.styles = defaultRenderStyles;
        this.blockPaddingLeftRight = 0;
        this.blockHeight = 0;
        this.blockPaddingTopBottom = 0;
        this.charHeight = 0;
        this.placeholderWidth = 0;
        this.avgCharWidth = 0;
        this.minTextWidth = 0;
        this.queue = {};
        this.zoom = 0;
        this.positionX = 0;
        this.min = 0;
        this.max = 0;
        this.patterns = {};
        this.ctxCachedSettings = {};
        this.ctxCachedCalls = {};
        this.setCtxValue = (field, value) => {
            if (this.ctxCachedSettings[field] !== value) {
                this.ctx[field] = value;
                this.ctxCachedSettings[field] = value;
            }
        };
        this.callCtx = (fn, value) => {
            if (!this.ctxCachedCalls[fn] || this.ctxCachedCalls[fn] !== value) {
                this.ctx[fn](value);
                this.ctxCachedCalls[fn] = value;
            }
        };
        this.width = canvas.width;
        this.height = canvas.height;
        this.isSafari = checkSafari();
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.pixelRatio = getPixelRatio(this.ctx);
        this.setSettings(settings);
        this.applyCanvasSize();
        this.reset();
    }
    setSettings({ options, styles, patterns }) {
        this.options = mergeObjects(defaultRenderSettings, options);
        this.styles = mergeObjects(defaultRenderStyles, styles);
        if (patterns) {
            const customPatterns = patterns.filter((preset) => 'creator' in preset);
            const defaultPatterns = patterns.filter((preset) => !('creator' in preset));
            defaultPatterns.forEach((pattern) => this.createDefaultPattern(pattern));
            customPatterns.forEach((pattern) => this.createBlockPattern(pattern));
        }
        this.timeUnits = this.options.timeUnits;
        this.blockHeight = this.styles.blockHeight;
        this.ctx.font = this.styles.font;
        const { actualBoundingBoxAscent: fontAscent, actualBoundingBoxDescent: fontDescent, width: allCharsWidth, } = this.ctx.measureText(allChars);
        const { width: placeholderWidth } = this.ctx.measureText('…');
        const fontHeight = fontAscent + fontDescent;
        this.blockPaddingLeftRight = this.styles.blockPaddingLeftRight;
        this.blockPaddingTopBottom = Math.ceil((this.blockHeight - fontHeight) / 2);
        this.charHeight = fontHeight + 1;
        this.placeholderWidth = placeholderWidth;
        this.avgCharWidth = allCharsWidth / allChars.length;
        this.minTextWidth = this.avgCharWidth + this.placeholderWidth;
    }
    reset() {
        this.queue = {};
        this.ctxCachedCalls = {};
        this.ctxCachedSettings = {};
    }
    setCtxShadow(shadow) {
        var _a, _b;
        this.setCtxValue('shadowBlur', shadow.blur);
        this.setCtxValue('shadowColor', shadow.color);
        this.setCtxValue('shadowOffsetY', (_a = shadow.offsetY) !== null && _a !== void 0 ? _a : 0);
        this.setCtxValue('shadowOffsetX', (_b = shadow.offsetX) !== null && _b !== void 0 ? _b : 0);
    }
    setCtxFont(font) {
        if (font && this.ctx.font !== font) {
            this.ctx.font = font;
        }
    }
    fillRect(x, y, w, h) {
        this.ctx.fillRect(x, y, w, h);
    }
    fillText(text, x, y) {
        this.ctx.fillText(text, x, y);
    }
    renderBlock(x, y, w, h) {
        this.ctx.fillRect(x, y, w, h !== null && h !== void 0 ? h : this.blockHeight);
    }
    renderStroke(color, x, y, w, h) {
        this.setCtxValue('strokeStyle', color);
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(x, y, w, h);
    }
    clear(w = this.width, h = this.height, x = 0, y = 0) {
        this.setCtxValue('fillStyle', this.styles.backgroundColor);
        this.ctx.clearRect(x, y, w, h - 1);
        this.ctx.fillRect(x, y, w, h);
        this.ctxCachedCalls = {};
        this.ctxCachedSettings = {};
        this.emit('clear');
    }
    timeToPosition(time) {
        return time * this.zoom - this.positionX * this.zoom;
    }
    pixelToTime(width) {
        return width / this.zoom;
    }
    setZoom(zoom) {
        this.zoom = zoom;
    }
    setPositionX(x) {
        const currentPos = this.positionX;
        this.positionX = x;
        return x - currentPos;
    }
    getQueue(priority = 0) {
        const queue = this.queue[priority];
        if (!queue) {
            this.queue[priority] = { text: [], stroke: [], rect: {} };
        }
        return this.queue[priority];
    }
    addRect(rect, priority = 0) {
        const queue = this.getQueue(priority);
        rect.pattern = rect.pattern || 'none';
        if (!queue.rect[rect.pattern]) {
            queue.rect[rect.pattern] = {};
        }
        if (!queue.rect[rect.pattern][rect.color]) {
            queue.rect[rect.pattern][rect.color] = [];
        }
        queue.rect[rect.pattern][rect.color].push(rect);
    }
    addText({ text, x, y, w }, priority = 0) {
        if (text) {
            const textMaxWidth = w - (this.blockPaddingLeftRight * 2 - (x < 0 ? x : 0));
            if (textMaxWidth > 0) {
                const queue = this.getQueue(priority);
                queue.text.push({ text, x, y, w, textMaxWidth });
            }
        }
    }
    addStroke(stroke, priority = 0) {
        const queue = this.getQueue(priority);
        queue.stroke.push(stroke);
    }
    resolveQueue() {
        Object.keys(this.queue)
            .map((priority) => parseInt(priority))
            .sort()
            .forEach((priority) => {
            const { rect, text, stroke } = this.queue[priority];
            this.renderRects(rect);
            this.renderTexts(text);
            this.renderStrokes(stroke);
        });
        this.queue = {};
    }
    renderRects(rects) {
        Object.entries(rects).forEach(([patternName, colors]) => {
            var _a;
            let matrix = new DOMMatrixReadOnly();
            let scale = 1;
            let pattern;
            if (patternName !== 'none' && this.patterns[patternName]) {
                scale = (_a = this.patterns[patternName].scale) !== null && _a !== void 0 ? _a : scale;
                pattern = this.patterns[patternName].pattern;
                if (scale !== 1) {
                    matrix = matrix.scale(1 / scale, 1 / scale);
                }
                this.ctx.fillStyle = pattern;
                this.ctxCachedSettings['fillStyle'] = patternName;
            }
            Object.entries(colors).forEach(([color, items]) => {
                if (!pattern) {
                    this.setCtxValue('fillStyle', color);
                }
                items.forEach((rect) => {
                    if (pattern) {
                        pattern.setTransform(matrix.translate(rect.x * scale, rect.y * scale));
                    }
                    this.renderBlock(rect.x, rect.y, rect.w, rect.h);
                });
            });
        });
    }
    renderTexts(texts) {
        this.setCtxValue('fillStyle', this.styles.fontColor);
        texts.forEach(({ text, x, y, textMaxWidth }) => {
            const { width: textWidth } = this.ctx.measureText(text);
            if (textWidth > textMaxWidth) {
                const avgCharWidth = textWidth / text.length;
                const maxChars = Math.floor((textMaxWidth - this.placeholderWidth) / avgCharWidth);
                const halfChars = (maxChars - 1) / 2;
                if (halfChars > 0) {
                    text =
                        text.slice(0, Math.ceil(halfChars)) +
                            '…' +
                            text.slice(text.length - Math.floor(halfChars), text.length);
                }
                else {
                    text = '';
                }
            }
            if (text) {
                this.ctx.fillText(text, (x < 0 ? 0 : x) + this.blockPaddingLeftRight, y + this.blockHeight - this.blockPaddingTopBottom);
            }
        });
    }
    renderStrokes(strokes) {
        strokes.forEach(({ color, x, y, w, h }) => {
            this.renderStroke(color, x, y, w, h);
        });
    }
    setMinMax(min, max) {
        const hasChanges = min !== this.min || max !== this.max;
        this.min = min;
        this.max = max;
        if (hasChanges) {
            this.emit('min-max-change', min, max);
        }
    }
    getTimeUnits() {
        return this.timeUnits;
    }
    tryToChangePosition(positionDelta) {
        const realView = this.getRealView();
        if (this.positionX + positionDelta + realView <= this.max && this.positionX + positionDelta >= this.min) {
            this.setPositionX(this.positionX + positionDelta);
        }
        else if (this.positionX + positionDelta <= this.min) {
            this.setPositionX(this.min);
        }
        else if (this.positionX + positionDelta + realView >= this.max) {
            this.setPositionX(this.max - realView);
        }
    }
    getInitialZoom() {
        if (this.max - this.min > 0) {
            return this.width / (this.max - this.min);
        }
        return 1;
    }
    getRealView() {
        return this.width / this.zoom;
    }
    resetView() {
        this.setZoom(this.getInitialZoom());
        this.setPositionX(this.min);
    }
    resize(width, height) {
        const resolvedWidth = Math.max(0, width || 0);
        const resolvedHeight = Math.max(0, height || 0);
        const isWidthChanged = typeof width === 'number' && this.width !== resolvedWidth;
        const isHeightChanged = typeof height === 'number' && this.height !== resolvedHeight;
        if (isWidthChanged || isHeightChanged) {
            this.width = isWidthChanged ? resolvedWidth : this.width;
            this.height = isHeightChanged ? resolvedHeight : this.height;
            this.applyCanvasSize();
            this.emit('resize', { width: this.width, height: this.height });
            return isHeightChanged;
        }
        return false;
    }
    applyCanvasSize() {
        this.canvas.style.backgroundColor = 'white';
        this.canvas.style.overflow = 'hidden';
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        this.ctx.font = this.styles.font;
    }
    copy(engine) {
        const ratio = this.isSafari ? 1 : engine.pixelRatio;
        if (engine.canvas.height) {
            this.ctx.drawImage(engine.canvas, 0, 0, engine.canvas.width * ratio, engine.canvas.height * ratio, 0, engine.position || 0, engine.width * ratio, engine.height * ratio);
        }
    }
    createDefaultPattern({ name, type, config }) {
        const defaultPattern = defaultPatterns[type];
        if (defaultPattern) {
            this.createBlockPattern({
                name,
                creator: defaultPattern(config),
            });
        }
    }
    createCachedDefaultPattern(pattern) {
        if (!this.patterns[pattern.name]) {
            this.createDefaultPattern(pattern);
        }
    }
    createBlockPattern({ name, creator }) {
        this.patterns[name] = creator(this);
    }
    renderTooltipFromData(fields, mouse) {
        const mouseX = mouse.x + 10;
        const mouseY = mouse.y + 10;
        const maxWidth = fields
            .map(({ text }) => text)
            .map((text) => this.ctx.measureText(text))
            .reduce((acc, { width }) => Math.max(acc, width), 0);
        const fullWidth = maxWidth + this.blockPaddingLeftRight * 2;
        this.setCtxShadow({
            color: this.styles.tooltipShadowColor,
            blur: this.styles.tooltipShadowBlur,
            offsetX: this.styles.tooltipShadowOffsetX,
            offsetY: this.styles.tooltipShadowOffsetY,
        });
        this.setCtxValue('fillStyle', this.styles.tooltipBackgroundColor);
        this.ctx.fillRect(mouseX, mouseY, fullWidth + this.blockPaddingLeftRight * 2, (this.charHeight + 2) * fields.length + this.blockPaddingLeftRight * 2);
        this.setCtxShadow({
            color: 'transparent',
            blur: 0,
        });
        fields.forEach(({ text, color }, index) => {
            if (color) {
                this.setCtxValue('fillStyle', color);
            }
            else if (!index) {
                this.setCtxValue('fillStyle', this.styles.tooltipHeaderFontColor);
            }
            else {
                this.setCtxValue('fillStyle', this.styles.tooltipBodyFontColor);
            }
            this.ctx.fillText(text, mouseX + this.blockPaddingLeftRight, mouseY + this.blockHeight - this.blockPaddingTopBottom + (this.charHeight + 2) * index);
        });
    }
    renderShape(color, dots, posX, posY) {
        this.setCtxValue('fillStyle', color);
        this.ctx.beginPath();
        this.ctx.moveTo(dots[0].x + posX, dots[0].y + posY);
        dots.slice(1).forEach(({ x, y }) => this.ctx.lineTo(x + posX, y + posY));
        this.ctx.closePath();
        this.ctx.fill();
    }
    renderTriangle({ color, x, y, width, height, direction, }) {
        this.renderShape(color, getTrianglePoints(width, height, direction), x, y);
    }
    renderCircle(color, x, y, radius) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        this.setCtxValue('fillStyle', color);
        this.ctx.fill();
    }
}

class OffscreenRenderEngine extends BasicRenderEngine {
    constructor({ width, height, parent, id }) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        super(canvas, { options: parent.options, styles: parent.styles });
        this.flexible = false;
        this.collapsed = false;
        this.position = 0;
        this.savedHeight = null;
        this.width = width;
        this.height = height;
        this.parent = parent;
        this.id = id;
        this.children = [];
        this.applyCanvasSize();
    }
    makeChild() {
        const child = new OffscreenRenderEngine({
            width: this.width,
            height: this.height,
            parent: this.parent,
            id: void 0,
        });
        this.children.push(child);
        child.setMinMax(this.min, this.max);
        child.resetView();
        return child;
    }
    setFlexible() {
        this.flexible = true;
    }
    collapse() {
        this.collapsed = true;
        this.savedHeight = this.height;
        this.clear();
    }
    expand() {
        this.collapsed = false;
        if (this.savedHeight) {
            this.resize({ height: this.savedHeight });
        }
    }
    setSettingsOverrides(settings) {
        this.setSettings({
            styles: mergeObjects(this.styles, settings.styles),
            options: mergeObjects(this.options, settings.options),
        });
        this.children.forEach((child) => child.setSettingsOverrides(settings));
    }
    // @ts-ignore - overrides a parent function which has different signature
    resize({ width, height, position }, isParentCall) {
        const isHeightChanged = super.resize(width, height);
        if ((height !== null && height !== void 0 ? height : 0) <= 0) {
            this.collapsed = true;
        }
        if (!isParentCall && isHeightChanged) {
            this.parent.recalcChildrenLayout();
        }
        if (typeof position === 'number') {
            this.position = position;
        }
        this.children.forEach((child) => child.resize({ width, height, position }));
    }
    setMinMax(min, max) {
        super.setMinMax(min, max);
        this.children.forEach((child) => child.setMinMax(min, max));
    }
    setSettings(settings) {
        super.setSettings(settings);
        if (this.children) {
            this.children.forEach((child) => child.setSettings(settings));
        }
    }
    tryToChangePosition(positionDelta) {
        this.parent.tryToChangePosition(positionDelta);
    }
    recalcMinMax() {
        this.parent.calcMinMax();
    }
    getTimeUnits() {
        return this.parent.getTimeUnits();
    }
    getAccuracy() {
        return this.parent.timeGrid.accuracy;
    }
    renderTimeGrid() {
        this.parent.timeGrid.renderLines(0, this.height, this);
    }
    renderTimeGridTimes() {
        this.parent.timeGrid.renderTimes(this);
    }
    standardRender() {
        this.resolveQueue();
        this.renderTimeGrid();
    }
    renderTooltipFromData(fields, mouse) {
        this.parent.renderTooltipFromData(fields, mouse);
    }
    resetParentView() {
        this.parent.resetView();
        this.parent.render();
    }
    render() {
        this.parent.partialRender(this.id);
    }
}

const MAX_ACCURACY = 6;
class RenderEngine extends BasicRenderEngine {
    constructor({ canvas, settings, timeGrid, plugins }) {
        super(canvas, settings);
        this.freeSpace = 0;
        this.lastPartialAnimationFrame = null;
        this.lastGlobalAnimationFrame = null;
        this.plugins = plugins;
        this.children = [];
        this.requestedRenders = [];
        this.timeGrid = timeGrid;
        this.timeGrid.setDefaultRenderEngine(this);
    }
    makeInstance() {
        const offscreenRenderEngine = new OffscreenRenderEngine({
            width: this.width,
            height: 0,
            id: this.children.length,
            parent: this,
        });
        offscreenRenderEngine.setMinMax(this.min, this.max);
        offscreenRenderEngine.resetView();
        this.children.push(offscreenRenderEngine);
        return offscreenRenderEngine;
    }
    calcMinMax() {
        const mins = this.plugins.map(({ min }) => min).filter(isNumber);
        const min = mins.length ? mins.reduce((acc, min) => Math.min(acc, min)) : 0;
        const maxs = this.plugins.map(({ max }) => max).filter(isNumber);
        const max = maxs.length ? maxs.reduce((acc, max) => Math.max(acc, max)) : 0;
        this.setMinMax(min, max);
    }
    calcTimeGrid() {
        this.timeGrid.recalc();
    }
    setMinMax(min, max) {
        super.setMinMax(min, max);
        this.children.forEach((engine) => engine.setMinMax(min, max));
    }
    setSettings(data) {
        super.setSettings(data);
        if (this.children) {
            this.children.forEach((engine) => engine.setSettings(data));
            this.recalcChildrenLayout();
        }
    }
    resize(width, height) {
        const currentWidth = this.width;
        super.resize(width, height);
        this.recalcChildrenLayout();
        if (this.getInitialZoom() > this.zoom) {
            this.resetView();
        }
        else if (this.positionX > this.min) {
            this.tryToChangePosition(-this.pixelToTime((width - currentWidth) / 2));
        }
        return true;
    }
    recalcChildrenLayout() {
        const childrenLayout = this.getChildrenLayout();
        if (childrenLayout.freeSpace > 0) {
            this.expandGrowingChildrenLayout(childrenLayout);
        }
        else if (childrenLayout.freeSpace < 0) {
            this.truncateChildrenLayout(childrenLayout);
        }
        this.freeSpace = childrenLayout.freeSpace;
        this.children.forEach((engine, index) => {
            engine.resize(childrenLayout.placements[index], true);
        });
    }
    getChildrenLayout() {
        return this.children.reduce((acc, engine, index) => {
            var _a;
            const plugin = this.plugins[index];
            const pluginHeight = plugin.fullHeight;
            let type = 'static';
            let height = 0;
            if (engine.flexible && typeof plugin.height === 'number') {
                type = 'flexibleStatic';
            }
            else if (plugin.height === 'flexible') {
                type = 'flexibleGrowing';
            }
            if (engine.collapsed) {
                height = 0;
            }
            else {
                switch (type) {
                    case 'static':
                        height = pluginHeight;
                        break;
                    case 'flexibleGrowing':
                        height = engine.height || 0;
                        break;
                    case 'flexibleStatic':
                        height = (_a = (engine.height || pluginHeight)) !== null && _a !== void 0 ? _a : 0;
                        break;
                }
            }
            acc.placements.push({
                width: this.width,
                position: acc.position,
                height,
                type,
            });
            acc.position += height;
            acc.freeSpace -= height;
            return acc;
        }, {
            position: 0,
            placements: [],
            freeSpace: this.height,
        });
    }
    expandGrowingChildrenLayout(childrenLayout) {
        const { placements, freeSpace } = childrenLayout;
        const last = placements[placements.length - 1];
        const growingChildren = placements.map(({ type, height }, index) => type === 'flexibleGrowing' && !this.children[index].collapsed && height === 0);
        const growingChildrenCount = growingChildren.filter(Boolean).length;
        if (growingChildrenCount) {
            const vacantSpacePart = Math.max(0, Math.floor(freeSpace / growingChildrenCount));
            growingChildren.forEach((isGrowing, index) => {
                if (isGrowing) {
                    placements[index].height += vacantSpacePart;
                    childrenLayout.freeSpace -= vacantSpacePart;
                    for (let nextIndex = index + 1; nextIndex < placements.length; nextIndex++) {
                        placements[nextIndex].position += vacantSpacePart;
                    }
                }
            });
        }
        if (last.type === 'flexibleGrowing' && !this.children[this.children.length - 1].collapsed) {
            last.height = Math.max(0, this.height - last.position);
            childrenLayout.freeSpace = 0;
        }
        return childrenLayout;
    }
    truncateChildrenLayout(childrenLayout) {
        const { placements, freeSpace } = childrenLayout;
        let diff = Math.abs(freeSpace);
        while (diff > 0) {
            const lastFlexibleIndex = placements.findLastIndex(({ height, type }) => height > 0 && type !== 'static');
            if (lastFlexibleIndex !== -1) {
                const size = placements[lastFlexibleIndex];
                const newHeight = Math.max(0, size.height - diff);
                const delta = size.height - newHeight;
                size.height = newHeight;
                diff -= delta;
                childrenLayout.freeSpace += delta;
                placements.forEach((size, index) => {
                    if (index > lastFlexibleIndex) {
                        size.position -= delta;
                    }
                });
            }
        }
        return childrenLayout;
    }
    getAccuracy() {
        return this.timeGrid.accuracy;
    }
    setZoom(zoom) {
        if (this.getAccuracy() < MAX_ACCURACY || zoom <= this.zoom) {
            super.setZoom(zoom);
            this.children.forEach((engine) => engine.setZoom(zoom));
            return true;
        }
        return false;
    }
    setPositionX(x) {
        const res = super.setPositionX(x);
        this.children.forEach((engine) => engine.setPositionX(x));
        return res;
    }
    renderPlugin(index) {
        var _a;
        const plugin = this.plugins[index];
        const engine = this.children[index];
        engine === null || engine === void 0 ? void 0 : engine.clear();
        if (!engine.collapsed) {
            const isFullRendered = (_a = plugin === null || plugin === void 0 ? void 0 : plugin.render) === null || _a === void 0 ? void 0 : _a.call(plugin);
            if (!isFullRendered) {
                engine.standardRender();
            }
        }
    }
    partialRender(id) {
        if (typeof id === 'number') {
            this.requestedRenders.push(id);
        }
        if (!this.lastPartialAnimationFrame) {
            this.lastPartialAnimationFrame = requestAnimationFrame(() => {
                this.requestedRenders.forEach((index) => this.renderPlugin(index));
                this.shallowRender();
                this.requestedRenders = [];
                this.lastPartialAnimationFrame = null;
            });
        }
    }
    shallowRender() {
        this.clear();
        this.timeGrid.renderLines(this.height - this.freeSpace, this.freeSpace);
        this.children.forEach((engine) => {
            if (!engine.collapsed) {
                this.copy(engine);
            }
        });
        let tooltipRendered = false;
        this.plugins.forEach((plugin) => {
            if (plugin.postRender) {
                plugin.postRender();
            }
        });
        this.plugins.forEach((plugin) => {
            if (plugin.renderTooltip) {
                tooltipRendered = tooltipRendered || Boolean(plugin.renderTooltip());
            }
        });
        if (!tooltipRendered && typeof this.options.tooltip === 'function') {
            // notify tooltip of nothing to render
            this.options.tooltip(null, this, null);
        }
    }
    render(prepare) {
        if (typeof this.lastPartialAnimationFrame === 'number') {
            cancelAnimationFrame(this.lastPartialAnimationFrame);
        }
        this.requestedRenders = [];
        this.lastPartialAnimationFrame = null;
        if (!this.lastGlobalAnimationFrame) {
            this.lastGlobalAnimationFrame = requestAnimationFrame(() => {
                prepare === null || prepare === void 0 ? void 0 : prepare();
                this.timeGrid.recalc();
                this.children.forEach((_, index) => this.renderPlugin(index));
                this.shallowRender();
                this.lastGlobalAnimationFrame = null;
            });
        }
    }
}

const EVENT_NAMES = ['down', 'up', 'move', 'click', 'select'];

class SeparatedInteractionsEngine extends EventEmitter {
    static getId() {
        return SeparatedInteractionsEngine.count++;
    }
    constructor(parent, renderEngine) {
        super();
        this.id = SeparatedInteractionsEngine.getId();
        this.parent = parent;
        this.renderEngine = renderEngine;
        renderEngine.on('clear', () => this.clearHitRegions());
        EVENT_NAMES.forEach((eventName) => parent.on(eventName, (region, mouse, isClick) => {
            if (!region || region.id === this.id) {
                this.resend(eventName, region, mouse, isClick);
            }
        }));
        ['hover'].forEach((eventName) => parent.on(eventName, (region, mouse) => {
            if (!region || region.id === this.id) {
                this.emit(eventName, region, mouse);
            }
        }));
        parent.on('change-position', (data, startMouse, endMouse, instance) => {
            if (instance === this) {
                this.emit('change-position', data, startMouse, endMouse);
            }
        });
        this.hitRegions = [];
    }
    resend(event, ...args) {
        if (this.renderEngine.position <= this.parent.mouse.y &&
            this.renderEngine.height + this.renderEngine.position >= this.parent.mouse.y) {
            this.emit(event, ...args);
        }
    }
    getMouse() {
        const { x, y } = this.parent.mouse;
        return {
            x,
            y: y - this.renderEngine.position,
        };
    }
    getGlobalMouse() {
        return this.parent.mouse;
    }
    clearHitRegions() {
        this.hitRegions = [];
    }
    addHitRegion(type, data, x, y, w, h, cursor) {
        this.hitRegions.push({
            type,
            data,
            x,
            y,
            w,
            h,
            cursor,
            id: this.id,
        });
    }
    setCursor(cursor) {
        this.parent.setCursor(cursor);
    }
    clearCursor() {
        this.parent.clearCursor();
    }
}
SeparatedInteractionsEngine.count = 0;

class InteractionsEngine extends EventEmitter {
    constructor(canvas, renderEngine) {
        super();
        this.selectedRegion = null;
        this.hoveredRegion = null;
        this.moveActive = false;
        this.currentCursor = null;
        this.renderEngine = renderEngine;
        this.canvas = canvas;
        this.hitRegions = [];
        this.instances = [];
        this.mouse = {
            x: 0,
            y: 0,
        };
        this.handleMouseWheel = this.handleMouseWheel.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.initListeners();
        this.reset();
    }
    makeInstance(renderEngine) {
        const separatedInteractionsEngine = new SeparatedInteractionsEngine(this, renderEngine);
        this.instances.push(separatedInteractionsEngine);
        return separatedInteractionsEngine;
    }
    reset() {
        this.selectedRegion = null;
        this.hoveredRegion = null;
        this.hitRegions = [];
    }
    destroy() {
        this.removeListeners();
    }
    initListeners() {
        if (this.canvas) {
            this.canvas.addEventListener('wheel', this.handleMouseWheel);
            this.canvas.addEventListener('mousedown', this.handleMouseDown);
            this.canvas.addEventListener('mouseup', this.handleMouseUp);
            this.canvas.addEventListener('mouseleave', this.handleMouseUp);
            this.canvas.addEventListener('mousemove', this.handleMouseMove);
        }
    }
    removeListeners() {
        if (this.canvas) {
            this.canvas.removeEventListener('wheel', this.handleMouseWheel);
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        }
    }
    handleMouseWheel(e) {
        const { deltaY, deltaX } = e;
        e.preventDefault();
        const realView = this.renderEngine.getRealView();
        const initialZoom = this.renderEngine.getInitialZoom();
        const startPosition = this.renderEngine.positionX;
        const startZoom = this.renderEngine.zoom;
        const positionScrollDelta = deltaX / this.renderEngine.zoom;
        let zoomDelta = (deltaY / 1000) * this.renderEngine.zoom;
        this.renderEngine.tryToChangePosition(positionScrollDelta);
        zoomDelta =
            this.renderEngine.zoom - zoomDelta >= initialZoom ? zoomDelta : this.renderEngine.zoom - initialZoom;
        if (zoomDelta !== 0) {
            const zoomed = this.renderEngine.setZoom(this.renderEngine.zoom - zoomDelta);
            if (zoomed) {
                const proportion = this.mouse.x / this.renderEngine.width;
                const timeDelta = realView - this.renderEngine.width / this.renderEngine.zoom;
                const positionDelta = timeDelta * proportion;
                this.renderEngine.tryToChangePosition(positionDelta);
            }
        }
        this.checkRegionHover();
        if (startPosition !== this.renderEngine.positionX || startZoom !== this.renderEngine.zoom) {
            this.renderEngine.render();
        }
    }
    handleMouseDown() {
        this.moveActive = true;
        this.mouseDownPosition = {
            x: this.mouse.x,
            y: this.mouse.y,
        };
        this.mouseDownHoveredInstance = this.hoveredInstance;
        this.emit('down', this.hoveredRegion, this.mouse);
    }
    handleMouseUp() {
        this.moveActive = false;
        const isClick = this.mouseDownPosition &&
            this.mouseDownPosition.x === this.mouse.x &&
            this.mouseDownPosition.y === this.mouse.y;
        if (isClick) {
            this.handleRegionHit();
        }
        this.emit('up', this.hoveredRegion, this.mouse, isClick);
        if (isClick) {
            this.emit('click', this.hoveredRegion, this.mouse);
        }
    }
    handleMouseMove(e) {
        if (this.moveActive) {
            const mouseDeltaY = this.mouse.y - e.offsetY;
            const mouseDeltaX = (this.mouse.x - e.offsetX) / this.renderEngine.zoom;
            if (mouseDeltaY || mouseDeltaX) {
                this.emit('change-position', {
                    deltaX: mouseDeltaX,
                    deltaY: mouseDeltaY,
                }, this.mouseDownPosition, this.mouse, this.mouseDownHoveredInstance);
            }
        }
        this.mouse.x = e.offsetX;
        this.mouse.y = e.offsetY;
        this.checkRegionHover();
        this.emit('move', this.hoveredRegion, this.mouse);
    }
    handleRegionHit() {
        const selectedRegion = this.getHoveredRegion();
        this.emit('select', selectedRegion, this.mouse);
    }
    checkRegionHover() {
        const hoveredRegion = this.getHoveredRegion();
        if (hoveredRegion && this.hoveredRegion && hoveredRegion.id !== this.hoveredRegion.id) {
            this.emit('hover', null, this.mouse);
        }
        if (hoveredRegion) {
            if (!this.currentCursor && hoveredRegion.cursor) {
                this.renderEngine.canvas.style.cursor = hoveredRegion.cursor;
            }
            else if (!this.currentCursor) {
                this.clearCursor();
            }
            this.hoveredRegion = hoveredRegion;
            this.emit('hover', hoveredRegion, this.mouse);
            this.renderEngine.partialRender();
        }
        else if (this.hoveredRegion && !hoveredRegion) {
            if (!this.currentCursor) {
                this.clearCursor();
            }
            this.hoveredRegion = null;
            this.emit('hover', null, this.mouse);
            this.renderEngine.partialRender();
        }
    }
    getHoveredRegion() {
        const hoveredRegion = this.hitRegions.find(({ x, y, w, h }) => this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h);
        if (hoveredRegion) {
            return hoveredRegion;
        }
        const hoveredInstance = this.instances.find(({ renderEngine }) => renderEngine.position <= this.mouse.y && renderEngine.height + renderEngine.position >= this.mouse.y);
        this.hoveredInstance = hoveredInstance;
        if (hoveredInstance) {
            const offsetTop = hoveredInstance.renderEngine.position;
            return hoveredInstance.hitRegions.find(({ x, y, w, h }) => this.mouse.x >= x &&
                this.mouse.x <= x + w &&
                this.mouse.y >= y + offsetTop &&
                this.mouse.y <= y + h + offsetTop);
        }
        return null;
    }
    clearHitRegions() {
        this.hitRegions = [];
    }
    addHitRegion(type, data, x, y, w, h, cursor) {
        this.hitRegions.push({
            type,
            data,
            x,
            y,
            w,
            h,
            cursor,
        });
    }
    setCursor(cursor) {
        this.renderEngine.canvas.style.cursor = cursor;
        this.currentCursor = cursor;
    }
    clearCursor() {
        const hoveredRegion = this.getHoveredRegion();
        this.currentCursor = null;
        if (hoveredRegion === null || hoveredRegion === void 0 ? void 0 : hoveredRegion.cursor) {
            this.renderEngine.canvas.style.cursor = hoveredRegion.cursor;
        }
        else {
            this.renderEngine.canvas.style.cursor = '';
        }
    }
}

class FlameChartContainer extends EventEmitter {
    constructor({ canvas, plugins, settings }) {
        var _a;
        super();
        const styles = (_a = settings === null || settings === void 0 ? void 0 : settings.styles) !== null && _a !== void 0 ? _a : {};
        this.timeGrid = new TimeGrid({ styles: styles === null || styles === void 0 ? void 0 : styles.timeGrid });
        this.renderEngine = new RenderEngine({
            canvas,
            settings: {
                styles: styles === null || styles === void 0 ? void 0 : styles.main,
                options: settings === null || settings === void 0 ? void 0 : settings.options,
            },
            plugins,
            timeGrid: this.timeGrid,
        });
        this.interactionsEngine = new InteractionsEngine(canvas, this.renderEngine);
        this.plugins = plugins;
        const children = Array(this.plugins.length)
            .fill(null)
            .map(() => {
            const renderEngine = this.renderEngine.makeInstance();
            const interactionsEngine = this.interactionsEngine.makeInstance(renderEngine);
            return { renderEngine, interactionsEngine };
        });
        this.plugins.forEach((plugin, index) => {
            plugin.init(children[index].renderEngine, children[index].interactionsEngine);
        });
        this.renderEngine.calcMinMax();
        this.renderEngine.resetView();
        this.renderEngine.recalcChildrenLayout();
        this.renderEngine.calcTimeGrid();
        this.plugins.forEach((plugin) => { var _a; return (_a = plugin.postInit) === null || _a === void 0 ? void 0 : _a.call(plugin); });
        this.renderEngine.render();
    }
    render() {
        this.renderEngine.render();
    }
    resize(width, height) {
        this.renderEngine.render(() => this.renderEngine.resize(width, height));
    }
    execOnPlugins(fnName, ...args) {
        let index = 0;
        while (index < this.plugins.length) {
            if (this.plugins[index][fnName]) {
                this.plugins[index][fnName](...args);
            }
            index++;
        }
    }
    setSettings(settings) {
        var _a, _b;
        this.timeGrid.setSettings({ styles: (_a = settings.styles) === null || _a === void 0 ? void 0 : _a.timeGrid });
        this.renderEngine.setSettings({
            options: settings.options,
            styles: (_b = settings.styles) === null || _b === void 0 ? void 0 : _b.main,
            patterns: settings.patterns,
        });
        this.plugins.forEach((plugin) => { var _a, _b; return (_a = plugin.setSettings) === null || _a === void 0 ? void 0 : _a.call(plugin, { styles: (_b = settings.styles) === null || _b === void 0 ? void 0 : _b[plugin.name] }); });
        this.renderEngine.render();
    }
    setZoom(start, end) {
        const zoom = this.renderEngine.width / (end - start);
        this.renderEngine.setPositionX(start);
        this.renderEngine.setZoom(zoom);
        this.renderEngine.render();
    }
}

const defaultSettings = {};
class FlameChart extends FlameChartContainer {
    constructor({ canvas, data, marks, waterfall, timeframeTimeseries, timeseries, colors, settings = defaultSettings, plugins = [], }) {
        var _a;
        const activePlugins = [];
        const { headers: { waterfall: waterfallName = 'waterfall', flameChart: flameChartName = 'flame chart' } = {} } = settings;
        const styles = (_a = settings === null || settings === void 0 ? void 0 : settings.styles) !== null && _a !== void 0 ? _a : {};
        const timeGridPlugin = new TimeGridPlugin({ styles: styles === null || styles === void 0 ? void 0 : styles.timeGridPlugin });
        activePlugins.push(timeGridPlugin);
        let marksPlugin;
        let waterfallPlugin;
        let timeframeSelectorPlugin;
        let flameChartPlugin;
        let timeseriesPlugin;
        if (timeseries) {
            timeseriesPlugin = new TimeseriesPlugin({
                data: timeseries,
                settings: { styles: styles === null || styles === void 0 ? void 0 : styles.timeseriesPlugin },
            });
            activePlugins.push(timeseriesPlugin);
        }
        if (marks) {
            marksPlugin = new MarksPlugin({ data: marks });
            marksPlugin.on('select', (data) => this.emit('select', data));
            activePlugins.push(marksPlugin);
        }
        if (waterfall) {
            waterfallPlugin = new WaterfallPlugin({ data: waterfall, settings: { styles: styles === null || styles === void 0 ? void 0 : styles.waterfallPlugin } });
            waterfallPlugin.on('select', (data) => this.emit('select', data));
            if (data) {
                activePlugins.push(new TogglePlugin(waterfallName, { styles: styles === null || styles === void 0 ? void 0 : styles.togglePlugin }));
            }
            activePlugins.push(waterfallPlugin);
        }
        if (data) {
            flameChartPlugin = new FlameChartPlugin({ data, colors });
            flameChartPlugin.on('select', (data) => this.emit('select', data));
            if (waterfall) {
                activePlugins.push(new TogglePlugin(flameChartName, { styles: styles === null || styles === void 0 ? void 0 : styles.togglePlugin }));
            }
            activePlugins.push(flameChartPlugin);
        }
        if (data || waterfall || timeframeTimeseries) {
            timeframeSelectorPlugin = new TimeframeSelectorPlugin({
                flameChartNodes: data,
                waterfall: waterfall,
                timeseries: timeframeTimeseries,
                settings: { styles: styles === null || styles === void 0 ? void 0 : styles.timeframeSelectorPlugin },
            });
            activePlugins.unshift(timeframeSelectorPlugin);
        }
        super({
            canvas,
            settings,
            plugins: [...activePlugins, ...plugins],
        });
        if (flameChartPlugin && timeframeSelectorPlugin) {
            this.setNodes = (data) => {
                if (flameChartPlugin) {
                    flameChartPlugin.setData(data);
                }
                if (timeframeSelectorPlugin) {
                    timeframeSelectorPlugin.setFlameChartNodes(data);
                }
            };
            this.setFlameChartPosition = ({ x, y }) => {
                if (typeof x === 'number') {
                    this.renderEngine.setPositionX(x);
                }
                if (typeof y === 'number' && flameChartPlugin) {
                    flameChartPlugin.setPositionY(y);
                }
                this.renderEngine.render();
            };
        }
        if (marksPlugin) {
            this.setMarks = (data) => {
                if (marksPlugin) {
                    marksPlugin.setMarks(data);
                }
            };
        }
        if (waterfallPlugin) {
            this.setWaterfall = (data) => {
                if (waterfallPlugin) {
                    waterfallPlugin.setData(data);
                }
                if (timeframeSelectorPlugin) {
                    timeframeSelectorPlugin.setWaterfall(data);
                }
            };
        }
        if (timeseriesPlugin) {
            this.setTimeseries = (data) => {
                if (timeseriesPlugin) {
                    timeseriesPlugin.setData(data);
                }
            };
        }
        if (timeframeSelectorPlugin) {
            this.setTimeframeTimeseries = (data) => {
                timeframeSelectorPlugin === null || timeframeSelectorPlugin === void 0 ? void 0 : timeframeSelectorPlugin.setTimeseries(data);
            };
        }
    }
}
