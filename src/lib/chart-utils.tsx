import React from "react";

/**
 * Recharts <Pie label> renderer that prints the slice value
 * centred inside each sector. Uses a stroke halo so the number
 * stays legible on any fill colour.
 */
export const renderPieValueLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;
  if (value === undefined || value === null || value === 0) return null;
  const RADIAN = Math.PI / 180;
  // For donut charts (innerRadius > 0) place label in the ring midpoint,
  // for solid pies place it ~60% out from the centre.
  const radius =
    innerRadius > 0
      ? innerRadius + (outerRadius - innerRadius) * 0.55
      : outerRadius * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
      style={{
        paintOrder: "stroke",
        stroke: "rgba(0,0,0,0.55)",
        strokeWidth: 3,
        strokeLinejoin: "round",
      }}
    >
      {value}
    </text>
  );
};
