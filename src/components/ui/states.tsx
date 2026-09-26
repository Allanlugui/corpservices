"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "./button";

export function ErrorState({
  title = "Algo deu errado",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <CircleAlert aria-hidden className="mx-auto text-red-600" size={28} />
      <p className="mt-2 font-semibold text-red-900">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-red-800">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
