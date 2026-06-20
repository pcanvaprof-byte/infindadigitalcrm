import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function SignaturePad({ value, onChange }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fff";
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    setDrawing(true);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function up() {
    if (!drawing) return;
    setDrawing(false);
    const c = ref.current!;
    onChange(c.toDataURL("image/png"));
  }
  function clear() {
    const c = ref.current!;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card/40">
        <canvas
          ref={ref}
          width={720}
          height={220}
          className="block h-[180px] w-full cursor-crosshair touch-none rounded-lg"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Assine no quadro acima com o mouse ou dedo.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 text-xs">
          <Eraser className="mr-1.5 h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>
    </div>
  );
}