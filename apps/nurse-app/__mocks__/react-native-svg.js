const React = require('react');

const createComponent = (name) => {
  const Component = (props) => React.createElement(name, props, props.children);
  Component.displayName = name;
  return Component;
};

module.exports = {
  __esModule: true,
  default: createComponent('Svg'),
  Svg: createComponent('Svg'),
  Circle: createComponent('Circle'),
  Ellipse: createComponent('Ellipse'),
  G: createComponent('G'),
  Text: createComponent('Text'),
  TSpan: createComponent('TSpan'),
  TextPath: createComponent('TextPath'),
  Path: createComponent('Path'),
  Polygon: createComponent('Polygon'),
  Polyline: createComponent('Polyline'),
  Line: createComponent('Line'),
  Rect: createComponent('Rect'),
  Use: createComponent('Use'),
  Image: createComponent('Image'),
  Symbol: createComponent('Symbol'),
  Defs: createComponent('Defs'),
  LinearGradient: createComponent('LinearGradient'),
  RadialGradient: createComponent('RadialGradient'),
  Stop: createComponent('Stop'),
  ClipPath: createComponent('ClipPath'),
  Pattern: createComponent('Pattern'),
  Mask: createComponent('Mask'),
};
