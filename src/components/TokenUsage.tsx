import { formatCompact } from "../lib/format";

interface TokenUsageProps {
  used: number;
  limit: number;
  billed: number;
}

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Compact context-window indicator, modelled on opencode's progress circle.
 * The ring shows the latest prompt estimate against the compaction ceiling.
 */
export function TokenUsage({ used, limit, billed }: TokenUsageProps) {
  const percentage =
    limit > 0 ? Math.max(0, Math.min(100, Math.round((used / limit) * 100))) : 0;
  const size = 18;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);
  const tone = percentage >= 95 ? "critical" : percentage >= 75 ? "warn" : "normal";
  const label =
    limit > 0
      ? `${used.toLocaleString()} of ${limit.toLocaleString()} context tokens (${percentage}%) · ${billed.toLocaleString()} billed`
      : `${used.toLocaleString()} context tokens · ${billed.toLocaleString()} billed`;

  return (
    <span
      className="token-usage"
      data-tone={tone}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg
        className="token-usage-ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          className="token-usage-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="token-usage-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
        />
      </svg>
      <span className="token-usage-value">{formatCompact(used)}</span>
    </span>
  );
}
