"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ImportResult {
  success: boolean;
  created: number;
  skipped: number;
  total:   number;
  errors:  Array<{ row: number; email: string; reason: string }>;
}

export function ImportUsersDialog({
  open,
  onOpenChange,
}: {
  open:         boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc         = useQueryClient();
  const inputRef   = useRef<HTMLInputElement>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [sendEmails, setSendEmails] = useState(false);
  const [result, setResult]     = useState<ImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sendEmails", String(sendEmails));
      const resp = await fetch("/api/import/users", { method: "POST", body: fd });
      return resp.json() as Promise<ImportResult>;
    },
    onSuccess: (res) => {
      setResult(res);
      if (res.success) {
        toast.success(`Imported ${res.created} user(s)`);
        qc.invalidateQueries({ queryKey: ["users"] });
      } else {
        toast.error("Import encountered errors");
      }
    },
    onError: () => toast.error("Import failed"),
  });

  function handleClose() {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Bulk Import Users
          </DialogTitle>
        </DialogHeader>

        {result ? (
          /* Result view */
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Created",   value: result.created, color: "text-green-600", bg: "bg-green-50" },
                { label: "Skipped",   value: result.skipped, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Errors",    value: result.errors.length, color: "text-red-600", bg: "bg-red-50" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-lg ${bg} px-3 py-3 text-center`}>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-1.5">Errors:</p>
                {result.errors.map((e) => (
                  <p key={e.row} className="text-[11px] text-red-600 leading-snug">
                    Row {e.row} ({e.email}): {e.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {result.created > 0
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                : <XCircle className="h-3.5 w-3.5 text-red-400" />}
              Processed {result.total} row(s) from file
            </div>
          </div>
        ) : (
          /* Upload view */
          <div className="space-y-4 py-2">
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    className="mt-2 text-xs text-red-500 hover:underline"
                    onClick={() => setFile(null)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-2">
                    Upload an Excel or CSV file
                  </p>
                  <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                    Browse file
                  </Button>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
              <p className="font-semibold mb-1">Required columns:</p>
              <p><code className="font-mono">name</code>, <code className="font-mono">email</code> (must end with @universalbank.uz)</p>
              <p className="mt-0.5">Optional: <code className="font-mono">role</code> (EMPLOYEE / HR_MANAGER / etc.)</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={sendEmails}
                onChange={(e) => setSendEmails(e.target.checked)}
                className="rounded border-gray-300"
              />
              Send welcome emails with temporary passwords
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              disabled={!file || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Importing…</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1.5" />Import</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
