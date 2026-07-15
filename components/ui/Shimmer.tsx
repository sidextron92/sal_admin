"use client";

import React from "react";

interface ShimmerProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A single shimmer block. Use inside a relative or overflow-hidden container.
 */
export function ShimmerBlock({ className = "", style }: ShimmerProps) {
  return (
    <div
      className={`shimmer-bg rounded-lg ${className}`}
      style={{
        backgroundColor: "#F0EBE0",
        ...style,
      }}
    />
  );
}

/**
 * A shimmer row that mimics a table row.
 */
export function ShimmerRow({ columns = 6 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      {Array.from({ length: columns }).map((_, i) => (
        <ShimmerBlock
          key={i}
          className="h-3.5"
          style={{
            width:
              i === 0
                ? "28px"
                : i === 1
                ? "35%"
                : i === columns - 1
                ? "36px"
                : `${14 + (i % 3) * 8}%`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A shimmer circle (for avatars / images).
 */
export function ShimmerCircle({ size = 32 }: { size?: number }) {
  return (
    <ShimmerBlock
      className="rounded-full shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Generic page skeleton for dashboard routes.
 * Mimics: page header + filter bar + table/card area.
 */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <ShimmerBlock className="h-6 w-40" />
          <ShimmerBlock className="h-4 w-24" />
        </div>
        <ShimmerBlock className="h-9 w-32 rounded-[22px]" />
      </div>

      {/* Summary cards (3-up) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl px-5 py-4 space-y-2"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
              border: "1px solid #E2E2E2",
            }}
          >
            <ShimmerBlock className="h-3 w-24" />
            <ShimmerBlock className="h-6 w-20" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <ShimmerBlock className="h-9 w-64 rounded-xl" />
        <ShimmerBlock className="h-9 w-28 rounded-[22px]" />
        <ShimmerBlock className="h-9 w-28 rounded-[22px]" />
        <ShimmerBlock className="h-9 w-24 rounded-[22px]" />
      </div>

      {/* Table header */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          border: "1px solid #E2E2E2",
        }}
      >
        <div
          className="flex items-center gap-4 px-5 py-3"
          style={{ borderBottom: "1px solid #F0EBE0" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBlock
              key={i}
              className="h-3"
              style={{
                width:
                  i === 0
                    ? "28px"
                    : i === 1
                    ? "30%"
                    : i === 5
                    ? "36px"
                    : `${12 + (i % 2) * 10}%`,
              }}
            />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <ShimmerRow key={i} columns={6} />
        ))}

        {/* Pagination bar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: "1px solid #F0EBE0" }}
        >
          <ShimmerBlock className="h-3 w-32" />
          <div className="flex gap-2">
            <ShimmerBlock className="h-8 w-20 rounded-lg" />
            <ShimmerBlock className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
