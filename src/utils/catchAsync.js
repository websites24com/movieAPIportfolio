module.exports = function catchAsync(fn) {

  // We return a new function for Express
  return function(req, res, next) {

    // 1. Call the controller function (fn)
    // 2. Wrap it in Promise.resolve so that:
    //    - normal async results become a resolved Promise
    //    - thrown errors (sync or async) become rejected Promises
    Promise.resolve(fn(req, res, next))

      // 3. If ANYTHING inside fn throws an error,
      //    Express will receive it through next(err)
      .catch(next);
  };
};
