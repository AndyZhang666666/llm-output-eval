"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { DIMENSIONS, SCORED_DIMENSIONS } from "@/lib/dimensions";

export interface RadarSeries {
  name: string;
  /** Score per scored dimension, in SCORED_DIMENSIONS order. */
  values: number[];
  color: string;
}

/**
 * Radar over the five scored dimensions. Safety is not plotted — it is a
 * category, and putting it on a 1-5 axis would imply a score that does not exist.
 */
export function ScoreRadar({ series, height = 280 }: { series: RadarSeries[]; height?: number }) {
  const data = SCORED_DIMENSIONS.map((id, i) => {
    const row: Record<string, string | number> = { dim: DIMENSIONS[id].labelZh };
    for (const s of series) row[s.name] = s.values[i];
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e4e4e7" />
        <PolarAngleAxis dataKey="dim" tick={{ fontSize: 12, fill: "#3f3f46" }} />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} />
        {series.map((s) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </RadarChart>
    </ResponsiveContainer>
  );
}
