// shape-library.js

const SPEC = {
  "colors": {
    "SKU_DEMAND": "#26dd4b",
    "SKU_COMPONENT": "#4db7e4",
    "BOM": "#9b9ea1",
    "RESOURCE": "#45f2de",
    "PURCH": "#5e548e",
    "BROKEN": "#e63946",
    "BOTTLENECK": "#fca30d"
  },
  "globalBevel": {
    "angle": 41,
    "depth": 5.7,
    "blur": 1.5,
    "highlight": 0,
    "shadow": 0.17
  },
  "icons": {
    "SKU": "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12",
    "RESOURCE": "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    "PURCH": "M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
  },
  "shapes": {
    "skuHex": {
      "defaultSize": { "r": 35 },
      "icon": { "iconScale": 0.95, "iconRotation": 0 }
    },
    "resGearCircle": {
      "defaultSize": { "r": 25 },
      "icon": { "iconScale": 0.6, "iconRotation": 0 }
    },
    "bomListCircle": {
      "defaultSize": { "r": 25 },
      "icon": { "iconScale": 0.9, "iconRotation": 0 }
    },
    "purchTruckCircle": {
      "defaultSize": { "r": 25 },
      "icon": { "iconScale": 0.7, "iconRotation": 0 }
    }
  }
};

function buildBevelFilter() {
  const { angle, depth, blur, highlight, shadow } = SPEC.globalBevel;
  const rad = (angle % 360) * Math.PI / 180;
  const dx = +(Math.cos(rad) * depth).toFixed(3);
  const dy = +(Math.sin(rad) * depth).toFixed(3);
  return `
    <filter id="inner-emboss" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="aBlur"/>
      <feOffset in="aBlur" dx="${dx}" dy="${dy}" result="aShadow"/>
      <feComposite in="aShadow" in2="SourceAlpha" operator="out" result="innerShadow"/>
      <feFlood flood-color="#000" flood-opacity="${shadow}" result="shadowColor"/>
      <feComposite in="shadowColor" in2="innerShadow" operator="in" result="shadowPaint"/>
      <feOffset in="aBlur" dx="${-dx}" dy="${-dy}" result="aHighlight"/>
      <feComposite in="aHighlight" in2="SourceAlpha" operator="out" result="innerHighlight"/>
      <feFlood flood-color="#fff" flood-opacity="${highlight}" result="highlightColor"/>
      <feComposite in="highlightColor" in2="innerHighlight" operator="in" result="highlightPaint"/>
      <feMerge>
        <feMergeNode in="shadowPaint"/>
        <feMergeNode in="highlightPaint"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;
}

function hexPoints(r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts.map(p => p.join(',')).join(' ');
}

export function createNodeIcon(node) {
    const props = node.properties;
    let color = '#eef3f9';
    let baseShapeSvg = '';
    let iconSvg = '';
    let r = 30;
    let shapeSpec;
    let vadjust = 0; // Set a more neutral default

    if (node.labels.includes('SKU')) {
        shapeSpec = SPEC.shapes.skuHex;
        r = shapeSpec.defaultSize.r;
        color = props.demand_sku ? SPEC.colors.SKU_DEMAND : SPEC.colors.SKU_COMPONENT;
        if (props.broken_bom) color = SPEC.colors.BROKEN;
        else if (props.bottleneck) color = SPEC.colors.BOTTLENECK;
        baseShapeSvg = `<polygon points="${hexPoints(r)}" fill="${color}" filter="url(#inner-emboss)"/>`;
        iconSvg = `<path fill="white" stroke="none" d="${SPEC.icons.SKU}"/>`;
        vadjust = r - 20; // Hardcoded new value
    } else if (node.labels.includes('Res')) {
        shapeSpec = SPEC.shapes.resGearCircle;
        r = shapeSpec.defaultSize.r;
        color = props.bottleneck ? SPEC.colors.BOTTLENECK : SPEC.colors.RESOURCE;
        baseShapeSvg = `<circle cx="0" cy="0" r="${r}" fill="${color}" filter="url(#inner-emboss)"/>`;
        iconSvg = `<path fill="white" stroke="none" d="${SPEC.icons.RESOURCE}"/>`;
        vadjust = r - 20; // Hardcoded new value
    } else if (node.labels.includes('BOM')) {
        shapeSpec = SPEC.shapes.bomListCircle;
        r = shapeSpec.defaultSize.r;
        color = SPEC.colors.BOM;
        baseShapeSvg = `<circle cx="0" cy="0" r="${r}" fill="${color}" filter="url(#inner-emboss)"/>`;
        iconSvg = `<g stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="-12" y1="-8" x2="-6" y2="-8" /><line x1="0" y1="-8" x2="18" y2="-8" /><line x1="-12" y1="2" x2="-6" y2="2" /><line x1="0" y1="2" x2="12" y2="2" /><line x1="-12" y1="12" x2="-6" y2="12" /><line x1="0" y1="12" x2="18" y2="12" /></g>`;
        vadjust = r - 20; // Hardcoded new value
    } else if (node.labels.includes('PurchGroup')) {
        shapeSpec = SPEC.shapes.purchTruckCircle;
        r = shapeSpec.defaultSize.r;
        color = SPEC.colors.PURCH;
        baseShapeSvg = `<circle cx="0" cy="0" r="${r}" fill="${color}" filter="url(#inner-emboss)"/>`;
        iconSvg = `<path fill="white" stroke="none" d="${SPEC.icons.PURCH}"/>`;
        vadjust = r - 20; // Hardcoded new value
    }

    const scale = shapeSpec.icon?.iconScale || 1;
    const rotation = shapeSpec.icon?.iconRotation || 0;
    const iconTransform = `transform="scale(${scale}) rotate(${rotation})"`;
    const finalIconSvg = `<g ${iconTransform}>${iconSvg}</g>`;
    
    const size = r * 2.6;
    const viewBox = `-${size / 2} -${size / 2} ${size} ${size}`;
    const finalSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
            <defs>${buildBevelFilter()}</defs>
            ${baseShapeSvg}
            ${finalIconSvg}
        </svg>`;

    return {
        image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvg)}`,
        size: r,
        vadjust: vadjust
    };
}