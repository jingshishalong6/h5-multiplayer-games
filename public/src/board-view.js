(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BoardView = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function isFlipped(role) {
    return role === 'black';
  }

  function toView(pos, role) {
    return isFlipped(role) ? { x: 8 - pos.x, y: 9 - pos.y } : { x: pos.x, y: pos.y };
  }

  function fromView(pos, role) {
    return toView(pos, role);
  }

  return { isFlipped, toView, fromView };
});
