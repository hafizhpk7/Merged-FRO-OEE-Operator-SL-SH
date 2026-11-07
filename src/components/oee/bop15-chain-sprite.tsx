import React, { useEffect, useMemo, useState } from "react";
import { BOP15_CHAIN_SPRITE } from "@/lib/oee/bop15ChainSprite";
import { DEFAULT_ELEVATION_DEG } from "@/lib/oee/j2-layout-config";
import { STATUS_HEX, type Status } from "@/lib/oee/config";

const BOP15_CHAIN_URL = "/bop15-chain.webp";

interface Bop15ChainSpriteProps {
  layoutX: number;
  layoutY: number;
  blockW: number;
  blockD: number;
  gap: number;
  isoScale: number;
  statusSource: (code: string) => Status;
  hoveredMachine: string | null;
  selectedMachine?: string | null;
  onMachineHover?: (mCode: string | null, e?: React.MouseEvent) => void;
  onMachineClick?: (mCode: string) => void;
  onLineLeave?: () => void;
  isDimmed?: boolean;
}

function projectIsoPoint(
  x: number,
  y: number,
  h: number,
  scale: number,
  elevationDeg: number = DEFAULT_ELEVATION_DEG,
) {
  const cos30 = 0.8660254;
  const sinFactor = Math.sin((elevationDeg * Math.PI) / 180) * 0.72;
  return {
    x: Math.round((x - y) * scale * cos30),
    y: Math.round((x + y) * scale * sinFactor - h),
  };
}

let globalImageStatus: "loading" | "valid" | "invalid" | null = null;

export function Bop15ChainSprite({
  layoutX,
  layoutY,
  blockW,
  blockD,
  gap,
  isoScale,
  statusSource,
  hoveredMachine,
  selectedMachine,
  onMachineHover,
  onMachineClick,
  onLineLeave,
  isDimmed,
}: Bop15ChainSpriteProps) {
  const meta = BOP15_CHAIN_SPRITE;

  const [imageStatus, setImageStatus] = useState<"loading" | "valid" | "invalid">(
    () => globalImageStatus ?? "loading",
  );

  useEffect(() => {
    if (globalImageStatus) {
      setImageStatus(globalImageStatus);
      return;
    }

    const img = new Image();
    img.src = BOP15_CHAIN_URL;

    const onLoaded = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (nw >= 1000 && nh >= 1000) {
        globalImageStatus = "valid";
        setImageStatus("valid");
      } else {
        console.error("bop15-chain.webp missing or invalid", {
          naturalWidth: nw,
          naturalHeight: nh,
        });
        globalImageStatus = "invalid";
        setImageStatus("invalid");
      }
    };

    const onError = () => {
      console.error("bop15-chain.webp missing or invalid", {
        naturalWidth: img.naturalWidth || 0,
        naturalHeight: img.naturalHeight || 0,
      });
      globalImageStatus = "invalid";
      setImageStatus("invalid");
    };

    if (img.complete && img.naturalWidth !== undefined) {
      if (img.naturalWidth > 0) {
        onLoaded();
      } else {
        onError();
      }
    } else {
      img.onload = onLoaded;
      img.onerror = onError;
    }
  }, []);

  // Placement Math:
  // xMin = layoutX; Y0 = layoutY + blockD / 2 (center axis on floor)
  const xMin = layoutX;
  const y0 = layoutY + blockD / 2;
  const anchor = useMemo(() => projectIsoPoint(xMin, y0, 0, isoScale), [xMin, y0, isoScale]);

  // Chain length in layout units: Lunits = (gap * 4) + blockW
  // k (layout units per metre) = min(Lunits / 7.95, (blockD + 0.2) / 1.1)
  const lunits = gap * 4 + blockW;
  const k = Math.min(lunits / 7.95, (blockD + 0.2) / 1.1);

  // Display factor f and image display dimensions
  const f = (0.866 * isoScale * k) / meta.pxPerMetreHorizontalAxis;
  const displayW = meta.imageWidth * f;
  const displayH = meta.imageHeight * f;

  // Image top-left in SVG space
  const imageX = anchor.x - meta.axisStartFloorPoint[0] * displayW;
  const imageY = anchor.y - meta.axisStartFloorPoint[1] * displayH;

  const isDebug =
    typeof window !== "undefined" &&
    (window.location.search.includes("debug=1") || window.location.search.includes("debug=bop15"));

  // Log only in debug mode
  useEffect(() => {
    if (isDebug) {
      console.log("[BOP15 sprite]", {
        view: isoScale > 20 ? "Zone View" : "Plant View",
        k,
        displayWidth: displayW,
        displayHeight: displayH,
        imageX,
        imageY,
      });
    }
  }, [isDebug, isoScale, k, displayW, displayH, imageX, imageY]);

  // Machine mappings
  const machineEntries = useMemo(() => {
    return [
      { key: "BOP15-LCM", shortCode: "LCM", mIdx: 0 },
      { key: "BOP15-LBC", shortCode: "LBC", mIdx: 1 },
      { key: "BOP15-LBF15-1", shortCode: "LBF15-1", mIdx: 2 },
      { key: "BOP15-LBF15-2", shortCode: "LBF15-2", mIdx: 3 },
      { key: "BOP15-LBF15-3", shortCode: "LBF15-3", mIdx: 4 },
    ];
  }, []);

  // Integrity Guard Fallback: If image fails or has invalid dimensions, render legacy 3D blocks
  if (imageStatus === "invalid") {
    const isDevOrDebug =
      typeof window !== "undefined" && (Boolean((import.meta as any).env?.DEV) || isDebug);

    const baseH = isoScale > 20 ? 14 : 10;

    return (
      <g
        data-testid="bop15-chain"
        opacity={isDimmed ? 0.35 : 1}
        className="transition-opacity duration-150"
      >
        {isDevOrDebug && (
          <text
            x={anchor.x}
            y={anchor.y - 15}
            fill="#EF4444"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            pointerEvents="none"
          >
            BOP15 image unavailable
          </text>
        )}

        {machineEntries.map(({ shortCode, key, mIdx }) => {
          const isHovered = hoveredMachine === shortCode || hoveredMachine === key;
          const status = statusSource(shortCode);
          const color = STATUS_HEX[status] ?? "#10B981";

          const blockX = layoutX + mIdx * gap;
          const blockY = layoutY;
          const blockH =
            baseH +
            (status === "running"
              ? isoScale > 20
                ? 6
                : 4
              : status === "slow"
                ? isoScale > 20
                  ? 3
                  : 2
                : 0);

          const t1 = projectIsoPoint(blockX, blockY, blockH, isoScale);
          const t2 = projectIsoPoint(blockX + blockW, blockY, blockH, isoScale);
          const t3 = projectIsoPoint(blockX + blockW, blockY + blockD, blockH, isoScale);
          const t4 = projectIsoPoint(blockX, blockY + blockD, blockH, isoScale);
          const b4 = projectIsoPoint(blockX, blockY + blockD, 0, isoScale);
          const b3 = projectIsoPoint(blockX + blockW, blockY + blockD, 0, isoScale);
          const b2 = projectIsoPoint(blockX + blockW, blockY, 0, isoScale);

          const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");

          return (
            <g
              key={key}
              id={`bop15-m-${shortCode}`}
              className="cursor-pointer select-none"
              onClick={() => onMachineClick?.(shortCode)}
              onMouseEnter={(e) => onMachineHover?.(shortCode, e)}
              onMouseLeave={onLineLeave}
              style={{
                filter: isHovered ? "brightness(1.2)" : undefined,
              }}
            >
              {/* Top Face */}
              <polygon
                points={pts([t1, t2, t3, t4])}
                fill={color}
                stroke={isHovered ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.15)"}
                strokeWidth={isHovered ? 1.5 : 0.5}
              />
              {/* Front-Left Face */}
              <polygon
                points={pts([t4, t3, b3, b4])}
                fill={color}
                stroke="rgba(0,0,0,0.2)"
                strokeWidth={0.5}
                style={{ filter: "brightness(0.72)" }}
              />
              {/* Front-Right Face */}
              <polygon
                points={pts([t3, t2, b2, b3])}
                fill={color}
                stroke="rgba(0,0,0,0.2)"
                strokeWidth={0.5}
                style={{ filter: "brightness(0.85)" }}
              />
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <g
      data-testid="bop15-chain"
      opacity={isDimmed ? 0.35 : 1}
      className="transition-opacity duration-150"
    >
      {/* Sprite Image */}
      <image
        href={BOP15_CHAIN_URL}
        x={imageX}
        y={imageY}
        width={displayW}
        height={displayH}
        preserveAspectRatio="none"
        pointerEvents="none"
      />

      {/* Debug outline shown only when ?debug=1 */}
      {isDebug && (
        <rect
          x={imageX}
          y={imageY}
          width={displayW}
          height={displayH}
          fill="none"
          stroke="#FF00FF"
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}

      {/* Interactive Hit Polygons & Stack Lights per Machine */}
      {machineEntries.map(({ key, shortCode }) => {
        const mM = meta.machines[key];
        if (!mM) return null;

        const isHovered = hoveredMachine === shortCode || hoveredMachine === key;
        const isSelected = selectedMachine === shortCode || selectedMachine === key;
        const status = statusSource(shortCode);

        // Convert normalized hitPolygon points to SVG coords
        const polyPoints = mM.hitPolygon
          .map(([hx, hy]) => `${imageX + hx * displayW},${imageY + hy * displayH}`)
          .join(" ");

        return (
          <g key={key} id={`bop15-m-${shortCode}`}>
            {/* Machine Hit Polygon */}
            <polygon
              points={polyPoints}
              fill={isHovered || isSelected ? "rgba(255, 255, 255, 0.22)" : "transparent"}
              stroke={isHovered || isSelected ? "#FFFFFF" : "transparent"}
              strokeWidth={isHovered || isSelected ? 1.5 : 0}
              className="cursor-pointer transition-colors duration-150"
              onClick={() => onMachineClick?.(shortCode)}
              onMouseEnter={(e) => onMachineHover?.(shortCode, e)}
              onMouseLeave={onLineLeave}
            />

            {/* Lit Stack Light Lamps */}
            {mM.lamps.map((lamp, lIdx) => {
              const isLampLit =
                (status === "down" && lamp.color === "red") ||
                (status === "slow" && lamp.color === "amber") ||
                (status === "running" && lamp.color === "green");

              if (!isLampLit) return null;

              const cx = imageX + lamp.center[0] * displayW;
              const cy = imageY + lamp.center[1] * displayH;
              const r = Math.max(lamp.radius * displayW, 2.5);

              const colorHex =
                lamp.color === "red" ? "#EF4444" : lamp.color === "amber" ? "#F59E0B" : "#10B981";

              return (
                <g key={`lamp-${shortCode}-${lIdx}`} pointerEvents="none">
                  {/* Glow circle */}
                  <circle cx={cx} cy={cy} r={r * 1.8} fill={colorHex} opacity={0.4} />
                  {/* Lit bulb */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={colorHex}
                    stroke="#FFFFFF"
                    strokeWidth={0.75}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
