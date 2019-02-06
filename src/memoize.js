export function memoize(numArgs, f) {
  const cache = {};
  
  const memf = function() {
    const key = JSON.stringify(arguments);
    if (cache.hasOwnProperty(key)) {
      return cache[key];
    } else {
      const value = f.apply(this, arguments);
      cache[key] = value;
      return value;
    }
  };
  
  return memf;
}

export function memoize2(numArgs, f) {
  const cache = {};
  let lastKey = null;
  let lastValue = null;
  
  const memf = function() {
    const key = JSON.stringify(arguments);
    if (lastKey === key) {
      return lastValue;
    } else if (cache.hasOwnProperty(key)) {
      return cache[key];
    } else {
      const value = f.apply(this, arguments);
      cache[key] = value;
      lastKey = key;
      lastValue = value;
      return value;
    }
  };
  
  return memf;
}

export function memoize3(numArgs, f) {
  let lastValue = function() {
    const value = f.apply(this, arguments);
    lastValue = function() { return value; };
    return value;
  };
  
  if (numArgs > 0) {
    return memoize(numArgs, f);
  } else {
	return function() { return lastValue(); };
  }
  
  return memf;
}