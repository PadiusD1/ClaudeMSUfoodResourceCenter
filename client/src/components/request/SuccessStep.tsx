import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2Icon, PlusCircleIcon, SearchIcon } from "lucide-react";

type SuccessStepProps = {
  variant?: "default" | "kiosk";
  requestId: string;
  onNewRequest: () => void;
  onCheckStatus: () => void;
};

export function SuccessStep({
  variant = "default",
  requestId,
  onNewRequest,
  onCheckStatus,
}: SuccessStepProps) {
  const isKiosk = variant === "kiosk";
  const shortId = requestId.slice(0, 8);

  return (
    <Card className="glass-panel">
      <CardContent className={`text-center ${isKiosk ? "py-12" : "py-8"}`}>
        <div className="space-y-4">
          <div className="mx-auto">
            <CheckCircle2Icon
              className={`mx-auto text-green-500 ${isKiosk ? "h-20 w-20" : "h-16 w-16"}`}
            />
          </div>

          <div className="space-y-2">
            <h2
              className={`font-bold ${isKiosk ? "text-3xl" : "text-2xl"}`}
              data-testid="text-success-heading"
            >
              Request Submitted!
            </h2>
            <p
              className={`text-muted-foreground ${isKiosk ? "text-lg" : "text-sm"}`}
              data-testid="text-success-id"
            >
              Your request ID: <span className="font-mono font-semibold">#{shortId}</span>
            </p>
            <p className={`text-muted-foreground ${isKiosk ? "text-base" : "text-sm"}`}>
              We'll review your request and notify you when it's ready.
            </p>
          </div>

          <div className={`flex flex-col gap-2 mx-auto ${isKiosk ? "max-w-sm" : "max-w-xs"} pt-4`}>
            <Button
              type="button"
              onClick={onNewRequest}
              className={`flex items-center justify-center gap-1.5 ${isKiosk ? "h-14 text-lg" : ""}`}
              data-testid="button-success-new"
            >
              <PlusCircleIcon className={isKiosk ? "h-5 w-5" : "h-4 w-4"} />
              Submit Another Request
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCheckStatus}
              className={`flex items-center justify-center gap-1.5 ${isKiosk ? "h-14 text-lg" : ""}`}
              data-testid="button-success-status"
            >
              <SearchIcon className={isKiosk ? "h-5 w-5" : "h-4 w-4"} />
              Check Request Status
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
